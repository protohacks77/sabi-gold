import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/firebase';
import { collection, getDocs, doc, updateDoc, addDoc, Timestamp, query, orderBy, limit, where } from 'firebase/firestore';
import type { Employee, AttendanceLog, LeaveRequest } from '../types';
import Spinner from './common/Spinner';
import { Icons } from './common/Icons';
import { loadModels, verifyFace } from '../services/faceRecognition';
import { verifyFingerprint, checkBiometricSupport } from '../services/fingerprintService';
import Modal from './common/Modal';
import Toast from './common/Toast';
import LeaveStatusModal from './LeaveStatusModal';

type KioskView = 'main' | 'selectingMethod' | 'scanning' | 'confirmation';
type LoginMethod = 'face' | 'fingerprint' | 'pin';
type AuthPurpose = 'attendance' | 'leaveStatus';

interface KioskProps {
  setView: (view: 'kiosk' | 'admin') => void;
}

const Kiosk: React.FC<KioskProps> = ({ setView }) => {
    const [currentTime, setCurrentTime] = useState(new Date());
    const [kioskView, setKioskView] = useState<KioskView>('main');
    const [scanMethod, setScanMethod] = useState<'face' | 'fingerprint' | null>(null);
    const [lastAction, setLastAction] = useState<{ employee: Employee, log: AttendanceLog } | null>(null);
    const [scanStatus, setScanStatus] = useState('Waiting for input...');
    const [isFingerprintSupported, setIsFingerprintSupported] = useState(false);
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinError, setPinError] = useState('');
    const [isPinLoading, setIsPinLoading] = useState(false);
    const [isChangePinOpen, setIsChangePinOpen] = useState(false);
    const [isLeaveRequestOpen, setIsLeaveRequestOpen] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
    const [loginMethod, setLoginMethod] = useState<LoginMethod | null>(null);
    const [pinModalReason, setPinModalReason] = useState<'failed' | 'unsupported' | null>(null);
    
    const [authPurpose, setAuthPurpose] = useState<AuthPurpose>('attendance');
    const [isLeaveStatusModalOpen, setIsLeaveStatusModalOpen] = useState(false);
    const [authenticatedEmployee, setAuthenticatedEmployee] = useState<Employee | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const verificationIntervalRef = useRef<number | null>(null);
    
    useEffect(() => {
        loadModels();
        checkBiometricSupport().then(setIsFingerprintSupported);
    }, []);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => {
            clearInterval(timer);
            stopVerificationProcess();
        };
    }, []);

    useEffect(() => {
        if (kioskView === 'confirmation' && lastAction?.log.type === 'out') {
            const timer = setTimeout(() => {
                closeConfirmation();
            }, 3000); // 3 seconds
    
            return () => clearTimeout(timer);
        }
    }, [kioskView, lastAction]);

    const stopVerificationProcess = () => {
        if (verificationIntervalRef.current) {
            clearInterval(verificationIntervalRef.current);
            verificationIntervalRef.current = null;
        }
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };

    const handleLoginClick = () => {
        setAuthPurpose('attendance');
        setKioskView('selectingMethod');
    };
    
    const handleLeaveStatusClick = () => {
        setAuthPurpose('leaveStatus');
        setKioskView('selectingMethod');
    };

    const handleMethodSelect = async (method: 'face' | 'fingerprint') => {
        setScanMethod(method);
        setKioskView('scanning');
        
        if (method === 'face') {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                         verificationIntervalRef.current = window.setInterval(async () => {
                            if (!videoRef.current) return;
                            
                            setScanStatus('Scanning...');
                            const matchedEmployee = await verifyFace(videoRef.current);
                            
                            if (matchedEmployee) {
                                setScanStatus(`Match Found: ${matchedEmployee.firstName}`);
                                setLoginMethod('face');
                                handleAuthSuccess(matchedEmployee);
                            } else {
                                setScanStatus('No match found. Please position your face clearly.');
                            }
                        }, 2000);
                    };
                }
            } catch (err) {
                console.error("Camera error:", err);
                setScanStatus('Camera not available. Please grant permission.');
            }
        } else {
            setScanStatus('Waiting for fingerprint...');
            const result = await verifyFingerprint();
            
            if (result.success && result.employee) {
                setScanStatus(`Welcome, ${result.employee.firstName}`);
                setLoginMethod('fingerprint');
                handleAuthSuccess(result.employee);
            } else {
                setScanStatus(result.error || 'Fingerprint not recognized. Please try your PIN.');
                setPinModalReason('failed');
                setIsPinModalOpen(true);
            }
        }
    };
    
    const handleAuthSuccess = (employee: Employee) => {
        stopVerificationProcess();
        if (authPurpose === 'attendance') {
            handleAttendanceSuccess(employee);
        } else {
            setAuthenticatedEmployee(employee);
            setIsLeaveStatusModalOpen(true);
            setKioskView('main');
        }
    };

    const handleAttendanceSuccess = async (targetEmployee: Employee) => {
        try {
            const isLoggingIn = targetEmployee.status !== 'Logged In';
            const newStatus = isLoggingIn ? 'Logged In' : 'Logged Out';
            const logType = isLoggingIn ? 'in' : 'out';

            const employeeRef = doc(db, 'employees', targetEmployee.id);
            const updatePayload: any = { status: newStatus };
            if (isLoggingIn) updatePayload.lastLoginTime = Timestamp.now();
            await updateDoc(employeeRef, updatePayload);
            
            const newLog = {
                employeeDocId: targetEmployee.id,
                employeeName: `${targetEmployee.firstName} ${targetEmployee.surname}`,
                employeePosition: targetEmployee.position,
                timestamp: Timestamp.now(),
                type: logType
            };
            await addDoc(collection(db, 'attendance'), newLog);
            
            const fullEmployeeData = { ...targetEmployee, status: newStatus };
            if(isLoggingIn) fullEmployeeData.lastLoginTime = Timestamp.now();
            setLastAction({ employee: fullEmployeeData, log: newLog as AttendanceLog });

        } catch (error) {
            console.error("Attendance processing error:", error);
        } finally {
            setKioskView('confirmation');
        }
    };
    
    const handlePinLogin = async () => {
        if(!pinInput || pinInput.length !== 4) {
            setPinError("A 4-digit PIN is required.");
            return;
        }
        setIsPinLoading(true);
        setPinError('');
        try {
            const q = query(collection(db, 'employees'), where('pin', '==', pinInput));
            const querySnapshot = await getDocs(q);
            if(querySnapshot.empty || querySnapshot.docs.length > 1) {
                setPinError("Invalid PIN.");
                setIsPinLoading(false);
                return;
            }
            const employee = { id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() } as Employee;
            
            setLoginMethod('pin');
            handleAuthSuccess(employee);
            setIsPinModalOpen(false);
            setPinInput('');

        } catch (error) {
            console.error("PIN login error:", error);
            setPinError("An error occurred. Please try again.");
        }
        setIsPinLoading(false);
    };

    const handlePinMethodSelect = () => {
        setPinModalReason('unsupported');
        setIsPinModalOpen(true);
    };
    
    const handleChangePin = async (currentPin: string, newPin: string) => {
        if (!lastAction) return { success: false, error: "No employee context." };
        const employee = lastAction.employee;
        if (employee.pin !== currentPin) {
            return { success: false, error: "Current PIN is incorrect." };
        }
         const q = query(collection(db, 'employees'), where('pin', '==', newPin));
         const querySnapshot = await getDocs(q);
         if (!querySnapshot.empty) {
             return { success: false, error: "New PIN is already in use. Choose another." };
         }
        try {
            const employeeRef = doc(db, 'employees', employee.id);
            await updateDoc(employeeRef, { pin: newPin });
            setLastAction(prev => prev ? ({ ...prev, employee: { ...prev.employee, pin: newPin } }) : null);
            setIsChangePinOpen(false);
            return { success: true };
        } catch (error) {
            return { success: false, error: "Failed to update PIN." };
        }
    };

    const handleLeaveRequestSubmit = async (leaveDetails: Omit<LeaveRequest, 'employeeDocId' | 'employeeName' | 'status'>) => {
        if (!lastAction) return;
        try {
            await addDoc(collection(db, 'leave_requests'), {
                ...leaveDetails,
                employeeDocId: lastAction.employee.id,
                employeeName: `${lastAction.employee.firstName} ${lastAction.employee.surname}`,
                status: 'pending'
            });
            setNotification({ message: 'Leave request submitted successfully!', type: 'success' });
            setIsLeaveRequestOpen(false);
        } catch (error) {
            setNotification({ message: 'Failed to submit leave request.', type: 'error' });
        }
    };
    
    const closeConfirmation = () => {
        setKioskView('main');
        setScanStatus('Waiting for input...');
        setLastAction(null);
        setLoginMethod(null);
    };

    const handleCancelScan = () => {
        stopVerificationProcess();
        setKioskView('main');
    };

    const handleBackToSelection = () => {
        stopVerificationProcess();
        setKioskView('selectingMethod');
    };
    
    const renderKioskView = () => {
        switch(kioskView) {
            case 'main': {
                const timeString = currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                     <div className="w-full h-full flex flex-col justify-center items-center text-center p-4 overflow-hidden">
                        <div className="opacity-0 animate-slide-down">
                            <Icons.LogoGold className="w-24 h-24 sm:w-32 sm:h-32"/>
                        </div>
                        <h1 
                            className="text-2xl sm:text-3xl font-bold mt-4 opacity-0 animate-slide-down" 
                            style={{ animationDelay: '100ms' }}>
                            Sabi Gold Mine
                        </h1>
                        
                        <div className="my-6 sm:my-8"></div>
                        
                        <p 
                            className="text-xl sm:text-2xl text-gray-400 opacity-0 animate-slide-in-left" 
                            style={{ animationDelay: '300ms' }}>
                            {currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>

                        <div 
                            className="flex justify-center text-7xl md:text-9xl font-bold font-mono tracking-tighter my-2" 
                            aria-label={timeString}>
                             {timeString.split('').map((char, index) => (
                                 <span
                                     key={index}
                                     className="opacity-0 animate-slide-in-right"
                                     style={{ animationDelay: `${400 + index * 50}ms` }}
                                     aria-hidden="true"
                                 >
                                     {char === ' ' ? '\u00A0' : char}
                                 </span>
                             ))}
                        </div>

                        <div className="mt-8 flex flex-col gap-4 w-full max-w-sm">
                            <button 
                                onClick={handleLoginClick} 
                                className="flex items-center justify-center gap-3 w-full px-8 md:px-16 py-4 md:py-5 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-bold rounded-xl text-xl md:text-2xl transition-transform transform hover:scale-105 shadow-lg shadow-yellow-400/20 opacity-0 animate-slide-up"
                                style={{ animationDelay: '700ms' }}
                            >
                                <Icons.Login />
                                <span>LOG IN / LOG OUT</span>
                            </button>
                            <button 
                                onClick={handleLeaveStatusClick} 
                                className="flex items-center justify-center gap-3 w-full px-8 md:px-16 py-3 md:py-4 bg-gray-700 hover:bg-gray-600 text-yellow-300 font-bold rounded-xl text-lg md:text-xl transition-transform transform hover:scale-105 opacity-0 animate-slide-up"
                                style={{ animationDelay: '800ms' }}
                            >
                                <Icons.Leave />
                                <span>Check My Leave Status</span>
                            </button>
                            <button 
                                onClick={() => setView('admin')} 
                                className="flex items-center justify-center gap-3 w-full px-4 py-2 bg-gray-800 border border-gray-700 text-yellow-400 rounded-lg hover:bg-gray-700 transition-colors font-semibold text-sm sm:text-base opacity-0 animate-slide-up"
                                style={{ animationDelay: '900ms' }}
                            >
                                <Icons.Administration />
                                <span>Admin Panel</span>
                            </button>
                        </div>
                     </div>
                );
            }
             case 'selectingMethod': return (
                <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex justify-center items-center z-50 animate-fade-in-fast">
                   <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md m-4 border border-gray-700 p-8 text-center">
                        <h2 className="text-2xl font-semibold text-gray-100 mb-2">Biometric Verification</h2>
                        <p className="text-gray-400 mb-8">Select your authentication method.</p>
                        <div className="space-y-4">
                            <button onClick={() => handleMethodSelect('face')} className="w-full flex items-center gap-4 p-4 bg-gray-700/50 border border-gray-600 rounded-lg hover:border-yellow-400 transition-colors group">
                               <div className="p-2 bg-gray-600 rounded-full text-yellow-400"><Icons.FaceScan className="w-8 h-8"/></div>
                               <span className="text-lg font-semibold text-gray-200 group-hover:text-yellow-400">Scan Face</span>
                           </button>
                            {isFingerprintSupported ? (
                                <button 
                                    onClick={() => handleMethodSelect('fingerprint')} 
                                    className="w-full flex items-center gap-4 p-4 bg-gray-700/50 border border-gray-600 rounded-lg hover:border-yellow-400 transition-colors group"
                                >
                                    <div className="p-2 bg-gray-600 rounded-full text-yellow-400"><Icons.FingerprintScan className="w-8 h-8"/></div>
                                    <div className="text-left">
                                        <span className="text-lg font-semibold text-gray-200 group-hover:text-yellow-400">Scan Fingerprint</span>
                                    </div>
                                </button>
                            ) : (
                                <button 
                                    onClick={handlePinMethodSelect} 
                                    className="w-full flex items-center gap-4 p-4 bg-gray-700/50 border border-gray-600 rounded-lg hover:border-yellow-400 transition-colors group"
                                >
                                    <div className="p-2 bg-gray-600 rounded-full text-yellow-400"><Icons.Lock className="w-8 h-8"/></div>
                                    <div className="text-left">
                                        <span className="text-lg font-semibold text-gray-200 group-hover:text-yellow-400">Enter PIN</span>
                                        <p className="text-xs text-gray-500">Fingerprint not supported</p>
                                    </div>
                                </button>
                            )}
                        </div>
                        <button onClick={handleCancelScan} className="mt-8 text-gray-400 hover:text-white">Cancel</button>
                   </div>
                </div>
             );
            case 'scanning': return (
                <div className="w-full h-full flex flex-col justify-center items-center text-center p-8 bg-gray-900">
                    <header className="absolute top-8 left-8 flex items-center gap-3">
                        <Icons.LogoGold />
                        <h1 className="text-2xl font-bold">Sabi Gold Mine</h1>
                    </header>
                    <main className="flex flex-col items-center">
                        <h2 className="text-4xl font-bold">Biometric Authentication</h2>
                        <p className="text-gray-400 mt-2">Please present your selected biometric.</p>

                         <div className="mt-12 flex flex-col items-center">
                            <div className="relative w-80 h-80">
                                <div className="absolute inset-0 border-4 border-gray-700 rounded-full"></div>
                                <div className="absolute inset-2 border-2 border-dashed border-yellow-400 rounded-full animate-spin-slow"></div>
                                {scanMethod === 'face' && <div className="w-full h-full rounded-full bg-gray-800 overflow-hidden"><video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]"></video></div>}
                                {scanMethod === 'fingerprint' && <div className="w-full h-full flex items-center justify-center"><Icons.FingerprintScan className="w-48 h-48 text-yellow-400 animate-pulse" /></div>}
                            </div>
                             <p className="mt-8 text-xl text-gray-300 font-semibold h-8">
                                {scanStatus}
                             </p>
                         </div>
                    </main>
                    <footer className="absolute bottom-8">
                        <button onClick={handleBackToSelection} className="text-gray-400 hover:text-white">&larr; Change Method</button>
                    </footer>
                </div>
            );
            case 'confirmation': return (
                 <div className="w-full h-full flex flex-col justify-center items-center text-center p-8 bg-gray-800 animate-fade-in">
                    {lastAction && (
                        <div className="w-full max-w-md animate-card-enter">
                            <ConfirmationCard 
                                type={lastAction.log.type}
                                name={lastAction.log.employeeName || "Unknown"}
                                time={lastAction.log.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                showActions={lastAction.log.type === 'in'}
                                onChangePinClick={() => setIsChangePinOpen(true)}
                                onRequestLeaveClick={() => setIsLeaveRequestOpen(true)}
                                onCloseClick={closeConfirmation}
                                hasPin={!!lastAction.employee.pin}
                            />
                        </div>
                    )}
                </div>
            );
        }
    };
    
    const handleSwitchToFace = () => {
        setIsPinModalOpen(false);
        setPinInput('');
        setPinError('');
        handleMethodSelect('face');
    };

    const closeLeaveStatusModal = () => {
        setIsLeaveStatusModalOpen(false);
        setAuthenticatedEmployee(null);
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center font-inter relative">
            {notification && <Toast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            {renderKioskView()}
            {isLeaveStatusModalOpen && authenticatedEmployee && (
                <LeaveStatusModal
                    employee={authenticatedEmployee}
                    onClose={closeLeaveStatusModal}
                />
            )}
            <PinModal 
                isOpen={isPinModalOpen}
                onClose={() => { setIsPinModalOpen(false); setKioskView('main'); setPinModalReason(null); }}
                onSubmit={handlePinLogin}
                pinInput={pinInput}
                setPinInput={setPinInput}
                error={pinError}
                isLoading={isPinLoading}
                onSwitchToFace={handleSwitchToFace}
                reason={pinModalReason}
            />
            {lastAction && <ChangePinModal
                isOpen={isChangePinOpen}
                onClose={() => setIsChangePinOpen(false)}
                onSubmit={handleChangePin}
            />}
             {lastAction && <LeaveRequestModal
                isOpen={isLeaveRequestOpen}
                onClose={() => setIsLeaveRequestOpen(false)}
                onSubmit={handleLeaveRequestSubmit}
            />}
            <footer className="absolute bottom-4 left-0 right-0 text-center text-xs text-gray-500">
                For assistance, please contact IT Support at extension 555
            </footer>
        </div>
    );
};

const ConfirmationCard: React.FC<{
    type: 'in' | 'out', 
    name: string, 
    time: string,
    showActions: boolean,
    onChangePinClick: () => void,
    onRequestLeaveClick: () => void,
    onCloseClick: () => void,
    hasPin: boolean,
}> = ({ type, name, time, showActions, onChangePinClick, onRequestLeaveClick, onCloseClick, hasPin }) => {
    const isLogin = type === 'in';
    return (
        <div className="bg-gray-900 rounded-2xl p-8 relative overflow-hidden shadow-2xl">
            <div className="flex flex-col items-center text-center">
                {isLogin ? (
                    <>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-green-500/20 text-green-400`}>
                            <Icons.CheckCircle className="w-10 h-10" />
                        </div>
                        <h2 className="text-4xl font-bold">Welcome</h2>
                        <p className="text-2xl text-gray-300 mt-2">{name}</p>
                        <p className="text-gray-400 mt-1">Successfully clocked {type} at {time}</p>
                    </>
                ) : (
                    <>
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-orange-500/20 text-orange-400 opacity-0 animate-slide-down`} style={{ animationDelay: '200ms' }}>
                            <Icons.Logout className="w-10 h-10" />
                        </div>
                        <h2 className="text-4xl font-bold flex overflow-hidden py-1">
                            {'Goodbye'.split('').map((char, index) => (
                                <span key={index} className="opacity-0 animate-letter-slide" style={{ animationDelay: `${300 + index * 50}ms` }}>
                                    {char}
                                </span>
                            ))}
                        </h2>
                        <p className="text-2xl text-gray-300 mt-2 opacity-0 animate-slide-in-right" style={{ animationDelay: '700ms' }}>{name}</p>
                        <p className="text-gray-400 mt-1 opacity-0 animate-slide-up" style={{ animationDelay: '800ms' }}>Successfully clocked {type} at {time}</p>
                    </>
                )}
                {showActions && (
                     <div className="mt-6 bg-gray-800/50 p-3 rounded-lg w-full space-y-3">
                        {hasPin && (
                            <button onClick={onChangePinClick} className="w-full px-4 py-2 bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-300 font-semibold rounded-md text-sm transition-colors">
                                Change PIN
                            </button>
                        )}
                        <button onClick={onRequestLeaveClick} className="w-full px-4 py-2 bg-blue-400/20 hover:bg-blue-400/40 text-blue-300 font-semibold rounded-md text-sm transition-colors">
                            Request Leave
                        </button>
                         <button onClick={onCloseClick} className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 font-semibold rounded-md text-sm transition-colors">
                            Close
                        </button>
                    </div>
                )}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-yellow-400"></div>
        </div>
    );
};

const PinModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    onSubmit: () => void,
    pinInput: string,
    setPinInput: (pin: string) => void,
    error: string,
    isLoading: boolean,
    onSwitchToFace: () => void,
    reason: 'failed' | 'unsupported' | null;
}> = ({ isOpen, onClose, onSubmit, pinInput, setPinInput, error, isLoading, onSwitchToFace, reason }) => {
     const inputClasses = "w-full p-3 bg-gray-700 text-center tracking-[1em] rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400";
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="PIN Authentication">
            <div className="space-y-4">
                {reason === 'failed' && (
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 text-center mb-4">
                        <p className="text-sm text-yellow-300 flex items-center justify-center gap-2"><Icons.Help className="w-5 h-5"/><span>Fingerprint scan failed. Please enter your PIN.</span></p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <span className="text-xs text-gray-400">or</span>
                            <button onClick={onSwitchToFace} className="text-xs font-semibold text-yellow-300 hover:text-yellow-200 flex items-center gap-1">
                                <Icons.FaceScan className="w-4 h-4" /> Switch to Facial Recognition
                            </button>
                        </div>
                    </div>
                )}
                 {reason === 'unsupported' && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center mb-4">
                        <p className="text-sm text-blue-300 flex items-center justify-center gap-2"><Icons.Help className="w-5 h-5"/><span>Fingerprint is not supported. Please use your PIN.</span></p>
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2 text-center">4-Digit PIN</label>
                    <input 
                        type="password" 
                        maxLength={4} 
                        value={pinInput} 
                        onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))} 
                        className={inputClasses}
                        autoFocus
                    />
                </div>
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                 <div className="flex justify-end space-x-4 pt-2">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">Cancel</button>
                    <button onClick={onSubmit} className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold transition-colors flex items-center min-w-[80px] justify-center" disabled={isLoading}>
                        {isLoading ? <Spinner /> : 'Login'}
                    </button>
                </div>
            </div>
        </Modal>
    )
};

const ChangePinModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    onSubmit: (currentPin: string, newPin: string) => Promise<{success: boolean, error?: string}>
}> = ({ isOpen, onClose, onSubmit }) => {
    const [pins, setPins] = useState({ current: '', new: '', confirm: '' });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        if (pins.new !== pins.confirm) {
            setError("New PINs do not match.");
            return;
        }
        if (pins.new.length !== 4) {
             setError("PIN must be 4 digits.");
            return;
        }
        setIsLoading(true);
        const result = await onSubmit(pins.current, pins.new);
        if(result.success) {
            setSuccess("PIN changed successfully!");
            setTimeout(() => {
                onClose();
                setPins({ current: '', new: '', confirm: '' });
                setSuccess('');
            }, 2000);
        } else {
            setError(result.error || "Failed to change PIN.");
        }
        setIsLoading(false);
    };

    const inputClasses = "w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400";
    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Change Your PIN">
             <div className="space-y-4">
                <input type="password" placeholder="Current PIN" maxLength={4} value={pins.current} onChange={e => setPins(p => ({...p, current: e.target.value.replace(/\D/g, '')}))} className={inputClasses}/>
                <input type="password" placeholder="New PIN" maxLength={4} value={pins.new} onChange={e => setPins(p => ({...p, new: e.target.value.replace(/\D/g, '')}))} className={inputClasses}/>
                <input type="password" placeholder="Confirm New PIN" maxLength={4} value={pins.confirm} onChange={e => setPins(p => ({...p, confirm: e.target.value.replace(/\D/g, '')}))} className={inputClasses}/>
                
                {error && <p className="text-red-400 text-sm text-center">{error}</p>}
                {success && <p className="text-green-400 text-sm text-center">{success}</p>}

                <div className="flex justify-end space-x-4 pt-2">
                     <button onClick={onClose} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">Cancel</button>
                    <button onClick={handleSubmit} className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold transition-colors flex items-center min-w-[80px] justify-center" disabled={isLoading}>
                        {isLoading ? <Spinner /> : 'Update'}
                    </button>
                </div>
            </div>
        </Modal>
    )
};

const LeaveRequestModal: React.FC<{
    isOpen: boolean,
    onClose: () => void,
    onSubmit: (details: Omit<LeaveRequest, 'id' | 'employeeDocId' | 'employeeName' | 'status'>) => void;
}> = ({ isOpen, onClose, onSubmit }) => {
    const [leaveType, setLeaveType] = useState<'Sick' | 'Vacation' | 'Unpaid'>('Sick');
    const [customDays, setCustomDays] = useState('');
    const [startDate, setStartDate] = useState(new Date());
    const [reason, setReason] = useState('');

    const calculateEndDate = (days: number): Date => {
        const result = new Date(startDate);
        result.setDate(result.getDate() + days - 1); // -1 because start day is included
        return result;
    };
    
    const handleSubmit = () => {
        const days = parseInt(customDays, 10);
        if(!isNaN(days) && days > 0) {
            onSubmit({
                type: leaveType,
                startDate: Timestamp.fromDate(startDate),
                endDate: Timestamp.fromDate(calculateEndDate(days)),
                reason,
            });
        } else {
            alert('Please enter a valid number of days.');
        }
    };
    
    const handlePresetClick = (days: number) => {
        onSubmit({
            type: leaveType,
            startDate: Timestamp.fromDate(startDate),
            endDate: Timestamp.fromDate(calculateEndDate(days)),
            reason
        });
    }

    const presets = [
        { label: '1 Week', days: 7 }, { label: '2 Weeks', days: 14 },
        { label: '1 Month', days: 30 }, { label: '3 Months', days: 90 },
    ];

    const inputClasses = "w-full p-2 bg-gray-800 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Request Leave of Absence">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Type of Leave</label>
                    <select value={leaveType} onChange={e => setLeaveType(e.target.value as any)} className={inputClasses}>
                        <option>Sick</option>
                        <option>Vacation</option>
                        <option>Unpaid</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Duration</label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                        {presets.map(p => (
                            <button key={p.label} onClick={() => handlePresetClick(p.days)} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">{p.label}</button>
                        ))}
                    </div>
                     <div className="flex items-center gap-2">
                        <input type="number" value={customDays} onChange={e => setCustomDays(e.target.value)} placeholder="Or enter custom days" className={inputClasses} />
                        <button onClick={handleSubmit} className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold transition-colors">
                            Submit
                        </button>
                    </div>
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Reason (Optional)</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Briefly state the reason for leave..." className={`${inputClasses} h-20`}></textarea>
                </div>

                 <div className="pt-2 text-center">
                    <button onClick={onClose} className="text-gray-400 hover:text-white">Cancel</button>
                </div>
            </div>
        </Modal>
    )
}


export default Kiosk;