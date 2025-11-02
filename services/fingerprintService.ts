import { db } from './firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type { Employee } from '../types';

// Helper functions to convert between ArrayBuffer and Hex String for Firestore storage
const bufferToHex = (buffer: ArrayBuffer): string => {
    return Array.from(new Uint8Array(buffer))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
};

const hexToBuffer = (hex: string): ArrayBuffer => {
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    return bytes.buffer;
};

// 1. Check if the browser and device support WebAuthn with a platform authenticator
export const checkBiometricSupport = async (): Promise<boolean> => {
    // WebAuthn requires a secure context (HTTPS or localhost)
    if (!window.isSecureContext) {
        console.warn("Biometric check failed: Not in a secure context (HTTPS or localhost).");
        return false;
    }
    if (!window.PublicKeyCredential) {
        return false;
    }
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (error) {
        console.error("Error checking biometric support:", error);
        return false;
    }
};

// 2. Enroll a new fingerprint using WebAuthn
export const enrollFingerprint = async (employeeId: string, employeeName: string): Promise<{ success: boolean; data?: { credentialId: string; publicKey: string }; error?: string }> => {
    if (!window.isSecureContext) {
        return { success: false, error: "Fingerprint enrollment requires a secure connection (HTTPS)." };
    }

    try {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
            challenge,
            rp: {
                name: "Sabi Gold Mine",
                id: window.location.hostname,
            },
            user: {
                id: new TextEncoder().encode(employeeId),
                name: employeeName,
                displayName: employeeName,
            },
            pubKeyCredParams: [
                { alg: -7, type: "public-key" }, // ES256
                { alg: -257, type: "public-key" }, // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                requireResidentKey: false,
                userVerification: "required",
            },
            timeout: 60000,
            attestation: "direct",
        };

        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions,
        });

        if (!credential || !(credential instanceof PublicKeyCredential)) {
            return { success: false, error: 'Credential creation failed.' };
        }

        const credentialId = bufferToHex(credential.rawId);
        const response = credential.response as AuthenticatorAttestationResponse;
        const publicKey = bufferToHex(response.getPublicKey()!);

        return { success: true, data: { credentialId, publicKey } };

    } catch (error: any) {
        console.error("Fingerprint enrollment failed:", error);
        let errorMessage = 'An unknown error occurred during enrollment.';
        if (error instanceof DOMException) {
            switch (error.name) {
                case 'NotAllowedError':
                    errorMessage = 'Authentication was cancelled or multiple attempts failed.';
                    break;
                case 'InvalidStateError':
                    errorMessage = 'This fingerprint may have already been registered.';
                    break;
                case 'SecurityError':
                    errorMessage = `A SecurityError occurred. If running in an iframe, ensure the parent frame has the correct Permissions Policy, e.g., <iframe allow="publickey-credentials-create *; publickey-credentials-get *">. Original error: ${error.message}`;
                    break;
                default:
                    errorMessage = `Enrollment failed: ${error.message}`;
            }
        }
        return { success: false, error: errorMessage };
    }
};

// 3. Verify a fingerprint using WebAuthn
export const verifyFingerprint = async (): Promise<{ success: boolean; employee?: Employee; error?: string }> => {
    if (!window.isSecureContext) {
        return { success: false, error: "Fingerprint verification requires a secure connection (HTTPS)." };
    }

    try {
        const q = query(collection(db, 'employees'), where('biometricCredentialId', '!=', null));
        const snapshot = await getDocs(q);
        const enrolledEmployees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));

        if (enrolledEmployees.length === 0) {
            return { success: false, error: "No fingerprints are enrolled in the system." };
        }

        const allowCredentials = enrolledEmployees
            .filter(emp => emp.biometricCredentialId) // Ensure credentialId is not null or undefined
            .map(emp => ({
                id: hexToBuffer(emp.biometricCredentialId!),
                type: 'public-key' as const,
                transports: ['internal'] as AuthenticatorTransport[],
            }));

        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
            challenge,
            allowCredentials,
            timeout: 60000,
            userVerification: "required",
        };

        const assertion = await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions,
        });

        if (!assertion || !(assertion instanceof PublicKeyCredential)) {
            return { success: false, error: "Verification assertion failed." };
        }

        const assertionCredentialId = bufferToHex(assertion.rawId);
        const matchedEmployee = enrolledEmployees.find(emp => emp.biometricCredentialId === assertionCredentialId);

        if (matchedEmployee) {
            return { success: true, employee: matchedEmployee };
        } else {
            return { success: false, error: "Fingerprint not recognized." };
        }

    } catch (error: any) {
        console.error("Fingerprint verification failed:", error);
        let errorMessage = 'An unknown error occurred during verification.';
        if (error instanceof DOMException) {
            switch (error.name) {
                case 'NotAllowedError':
                    errorMessage = 'Authentication was cancelled or failed.';
                    break;
                case 'SecurityError':
                    errorMessage = `A SecurityError occurred. If running in an iframe, ensure the parent frame has the correct Permissions Policy, e.g., <iframe allow="publickey-credentials-create *; publickey-credentials-get *">. Original error: ${error.message}`;
                    break;
                default:
                    errorMessage = `Verification failed: ${error.message}`;
            }
        }
        return { success: false, error: errorMessage };
    }
};
