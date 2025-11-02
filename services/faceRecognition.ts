import { db } from './firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { Employee } from '../types';

// The face-api.js library is loaded via a script tag in index.html and attaches itself to the window object.
// We explicitly reference it from the window object to ensure we're accessing the global instance.
const faceapi = (window as any).faceapi;

const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
let modelsLoaded = false;

// Load all the required models for face detection and recognition
export const loadModels = async () => {
    if (modelsLoaded) return;

    // Add a guard to check if the face-api.js script has loaded successfully.
    if (!faceapi) {
        console.error("face-api.js not loaded. Please check the script tag in index.html.");
        return;
    }

    try {
        await Promise.all([
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoaded = true;
        console.log("Face recognition models loaded successfully.");
    } catch (error) {
        console.error("Error loading face recognition models:", error);
    }
};

// Detects a face in a video feed and generates a unique descriptor for it.
export const enrollFace = async (videoElement: HTMLVideoElement): Promise<number[] | null> => {
    if (!modelsLoaded) {
        console.warn("Models not loaded yet. Attempting to load...");
        await loadModels();
    }
    
    if (!faceapi) return null; // Guard against library not being loaded

    const detection = await faceapi
        .detectSingleFace(videoElement, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        return null;
    }

    // Return the descriptor as a plain array of numbers for Firestore storage
    return Array.from(detection.descriptor);
};

// Verifies a face from a video feed against all enrolled employees in the database.
export const verifyFace = async (videoElement: HTMLVideoElement): Promise<(Employee & { matchConfidence: number }) | null> => {
    if (!modelsLoaded) return null;
    if (!faceapi) return null; // Guard against library not being loaded

    const detection = await faceapi
        .detectSingleFace(videoElement, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor();

    if (!detection) {
        return null;
    }

    const currentDescriptor = detection.descriptor;

    // Fetch all employees who have face data enrolled
    const employeesSnapshot = await getDocs(
        query(collection(db, 'employees'), where('isFaceRegistered', '==', true))
    );
    
    if (employeesSnapshot.empty) {
        return null;
    }

    let bestMatch: (Employee & { matchConfidence: number }) | null = null;
    // Set a threshold for matching. Lower is stricter. 0.6 is a good default.
    let bestDistance = 0.55; 

    for (const employeeDoc of employeesSnapshot.docs) {
        const employee = { id: employeeDoc.id, ...employeeDoc.data() } as Employee;

        // Ensure employee has valid face data
        if (employee.faceData?.descriptor) {
            const storedDescriptor = new Float32Array(employee.faceData.descriptor);
            
            // Calculate the similarity (distance) between the live face and the stored face
            const distance = faceapi.euclideanDistance(currentDescriptor, storedDescriptor);
            
            if (distance < bestDistance) {
                bestDistance = distance;
                bestMatch = {
                    ...employee,
                    // Convert distance to a confidence percentage
                    matchConfidence: (1 - distance) * 100
                };
            }
        }
    }

    return bestMatch;
};