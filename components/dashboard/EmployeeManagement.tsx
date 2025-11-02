import React, { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, orderBy, query, where, getDocs } from 'firebase/firestore';
import type { Employee } from '../../types';
import Modal from '../common/Modal';
import Spinner from '../common/Spinner';
import { Icons } from '../common/Icons';
import { enrollFace, loadModels } from '../../services/faceRecognition';
import { enrollFingerprint, checkBiometricSupport } from '../../services/fingerprintService';
import ConfirmationModal from '../common/ConfirmationModal';
import Toast from '../common/Toast';


const EmployeeManagement: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [positionFilter, setPositionFilter] = useState('All');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBioModalOpen, setIsBioModalOpen] = useState(false);
    const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
    const [currentEmployee, setCurrentEmployee] = useState<Partial<Employee> | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [bioStep, setBioStep] = useState<'face' | 'fingerprint' | null>(null);
    const [bioStatus, setBioStatus] = useState('');
    const [isFingerprintSupported, setIsFingerprintSupported] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);
    const [showPin, setShowPin] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    
    useEffect(() => {
        loadModels();
        checkBiometricSupport().then(setIsFingerprintSupported);
        const q = query(collection(db, 'employees'), orderBy('firstName'));
        const unsub = onSnapshot(q, (snapshot) => {
            const employeeList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));
            setEmployees(employeeList);
        });
        return () => unsub();
    }, []);
    
    const openModal = (employee: Partial<Employee> | null = null) => {
        if (employee) {
            setCurrentEmployee({ ...employee });
        } else {
            const newId = `SGM-${Date.now().toString().slice(-6)}`;
            setCurrentEmployee({ status: 'Logged Out', employeeId: newId, avatarUrl: '' });
        }
        setShowPin(false);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setCurrentEmployee(null);
    };

    const handleSave = async () => {
        if (!currentEmployee || !currentEmployee.firstName || !currentEmployee.surname || !currentEmployee.position || !currentEmployee.employeeId) {
            setNotification({ message: "Please fill all required fields.", type: 'error' });
            return;
        }
        
        setIsLoading(true);

        if (currentEmployee.pin && currentEmployee.pin.length === 4) {
            const q = query(collection(db, 'employees'), where('pin', '==', currentEmployee.pin));
            const querySnapshot = await getDocs(q);
            const pinExists = !querySnapshot.empty;
            let isOwnPin = false;
            if(pinExists && currentEmployee.id) {
                isOwnPin = querySnapshot.docs[0].id === currentEmployee.id;
            }

            if (pinExists && !isOwnPin) {
                setNotification({ message: "PIN already in use. Please choose another.", type: 'error' });
                setIsLoading(false);
                return;
            }
        } else if (currentEmployee.pin && currentEmployee.pin.length > 0) {
             setNotification({ message: "PIN must be exactly 4 digits.", type: 'error' });
             setIsLoading(false);
             return;
        }

        try {
            const employeeData = { ...currentEmployee };
            if(!employeeData.avatarUrl) {
                employeeData.avatarUrl = `https://api.dicebear.com/8.x/initials/svg?seed=${employeeData.firstName} ${employeeData.surname}`;
            }
            if (!employeeData.pin || employeeData.pin.length !== 4) {
                delete employeeData.pin;
            }

            if (employeeData.id) {
                const { id, ...data } = employeeData;
                await updateDoc(doc(db, 'employees', id), data);
            } else {
                await addDoc(collection(db, 'employees'), employeeData);
            }
            closeModal();
        } catch (error) {
            console.error("Error saving employee: ", error);
        }
        setIsLoading(false);
    };
    
    const handleDelete = async () => {
        if (!employeeToDelete) return;
        setIsLoading(true);
        await deleteDoc(doc(db, 'employees', employeeToDelete.id));
        setEmployeeToDelete(null);
        setIsLoading(false);
    };
    
    const openBioModal = (employee: Employee, type: 'face' | 'fingerprint') => {
        if(type === 'fingerprint' && !isFingerprintSupported) {
            setNotification({ message: "This device does not support fingerprint scanning.", type: 'info' });
            return;
        }
        setCurrentEmployee(employee);
        setBioStep(type);
        setIsBioModalOpen(true);
    };

    const closeBioModal = useCallback(() => {
        if (videoRef.current && videoRef.current.srcObject) {
            (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
        setIsBioModalOpen(false);
        setBioStep(null);
        setCurrentEmployee(null);
        setBioStatus('');
    }, []);

    useEffect(() => {
        if (!isBioModalOpen || !bioStep || !currentEmployee?.id) return;
        
        let registrationInterval: number;

        const performFaceRegistration = async () => {
            setBioStatus('Starting camera...');
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch (err) {
                setBioStatus('Camera access denied.');
                setTimeout(closeBioModal, 3000);
                return;
            }

            setBioStatus('Position your face in the frame...');
            registrationInterval = window.setInterval(async () => {
                if (!videoRef.current) return;

                setBioStatus('Detecting face...');
                const descriptor = await enrollFace(videoRef.current);

                if (descriptor) {
                    clearInterval(registrationInterval);
                    setBioStatus('Face detected. Saving data...');
                    try {
                        const employeeRef = doc(db, 'employees', currentEmployee.id!);
                        await updateDoc(employeeRef, {
                            isFaceRegistered: true,
                            faceData: { descriptor }
                        });
                        setBioStatus('Registration Successful!');
                    } catch (error) {
                        setBioStatus('Save failed. Please try again.');
                    }
                    setTimeout(closeBioModal, 2000);
                } else {
                    setBioStatus('No face detected. Please try again.');
                }
            }, 1000);
        };
        
        const performFingerprintRegistration = async () => {
            setBioStatus('Waiting for fingerprint sensor...');
            const result = await enrollFingerprint(currentEmployee.id!, `${currentEmployee.firstName} ${currentEmployee.surname}`);

            if (result.success && result.data) {
                setBioStatus('Saving credential...');
                try {
                    const employeeRef = doc(db, 'employees', currentEmployee.id!);
                    await updateDoc(employeeRef, {
                        biometricCredentialId: result.data.credentialId,
                        biometricPublicKey: result.data.publicKey,
                    });
                    setBioStatus('Registration Successful!');
                } catch (error) {
                    setBioStatus('Save failed. Please try again.');
                }
            } else {
                setBioStatus(result.error || 'Registration Failed or Cancelled.');
            }
            setTimeout(closeBioModal, 3000);
        };

        if (bioStep === 'face') {
            performFaceRegistration();
        } else {
            performFingerprintRegistration();
        }

        return () => {
            clearInterval(registrationInterval);
        };

    }, [isBioModalOpen, bioStep, currentEmployee, closeBioModal]);

    const positions = ['All', ...Array.from(new Set(employees.map(e => e.position)))];

    const filteredEmployees = employees.filter(emp => {
        const term = searchTerm.toLowerCase();
        const nameMatch = (
            emp.firstName.toLowerCase().includes(term) ||
            emp.surname.toLowerCase().includes(term) ||
            emp.employeeId.toLowerCase().includes(term)
        );
        const positionMatch = positionFilter === 'All' || emp.position === positionFilter;
        return nameMatch && positionMatch;
    });

    const ActionButton: React.FC<{ onClick: () => void, className: string, label: string, children: React.ReactNode, disabled?: boolean, title?: string }> = 
    ({ onClick, className, label, children, disabled, title }) => (
        <div className="relative group">
            <button onClick={onClick} className={className} aria-label={label} disabled={disabled} title={title}>
                {children}
            </button>
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 hidden group-hover:block px-2 py-1 bg-gray-600 text-white text-xs rounded-md whitespace-nowrap shadow-lg">
                {title || label}
            </div>
        </div>
    );

    return (
        <>
            {notification && <Toast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
            <ConfirmationModal
                isOpen={!!employeeToDelete}
                onClose={() => setEmployeeToDelete(null)}
                onConfirm={handleDelete}
                title="Confirm Deletion"
                message={<>Are you sure you want to delete <strong>{employeeToDelete?.firstName} {employeeToDelete?.surname}</strong>? This action cannot be undone.</>}
                confirmText="Delete"
                isLoading={isLoading}
            />
            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <div className="flex flex-col md:flex-row w-full gap-4">
                        <div className="relative w-full md:max-w-xs">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                               <Icons.Search />
                            </div>
                            <input 
                                type="search"
                                placeholder="Search by name or ID..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full p-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-400"
                            />
                        </div>
                         <select
                            value={positionFilter}
                            onChange={e => setPositionFilter(e.target.value)}
                            className="w-full md:max-w-xs p-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-400"
                         >
                            {positions.map(p => <option key={p} value={p}>{p === 'All' ? 'All Positions' : p}</option>)}
                         </select>
                    </div>
                    <button onClick={() => openModal()} className="w-full md:w-auto flex-shrink-0 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-md">
                        <span>Add New Employee</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="border-b border-gray-700">
                            <tr>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee ID</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Biometrics</th>
                                <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map(emp => (
                                <tr key={emp.id} className="hover:bg-gray-800/50 transition-colors border-b border-gray-700 last:border-b-0">
                                    <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <img className="w-10 h-10 rounded-full object-cover bg-gray-700" src={emp.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${emp.firstName} ${emp.surname}`} alt={`${emp.firstName} ${emp.surname}`} />
                                            <div>
                                                <p className="text-white font-medium">{emp.firstName} {emp.surname}</p>
                                                <p className="text-gray-400 text-sm">{emp.position}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap text-gray-400 font-mono text-sm">{emp.employeeId}</td>
                                    <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="flex items-center space-x-2">
                                            <ActionButton onClick={() => openBioModal(emp, 'face')} className={`p-2 rounded-full transition-colors ${emp.isFaceRegistered ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'}`} label="Register Face">
                                                <Icons.FaceScan className="w-5 h-5"/>
                                            </ActionButton>
                                            <ActionButton onClick={() => openBioModal(emp, 'fingerprint')} className={`p-2 rounded-full transition-colors ${!!emp.biometricCredentialId ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'} disabled:opacity-50 disabled:cursor-not-allowed`} label="Register Fingerprint" disabled={!isFingerprintSupported} title={isFingerprintSupported ? "Register Fingerprint" : "Fingerprint not supported on this device"}>
                                                <Icons.FingerprintScan className="w-5 h-5"/>
                                            </ActionButton>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="flex items-center justify-end space-x-2">
                                            <ActionButton onClick={() => openModal(emp)} className="p-2 bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-400 rounded-full transition-colors" label="Edit Employee">
                                                <Icons.Administration className="w-5 h-5"/>
                                            </ActionButton>
                                            <ActionButton onClick={() => setEmployeeToDelete(emp)} className="p-2 bg-red-500/10 hover:bg-red-500/30 text-red-500 rounded-full transition-colors" label="Delete Employee">
                                                <Icons.Trash className="w-5 h-5"/>
                                            </ActionButton>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <Modal isOpen={isModalOpen} onClose={closeModal} title={currentEmployee?.id ? "Edit Employee" : "Add New Employee"}>
                    <div className="space-y-4">
                         <input type="text" placeholder="First Name" value={currentEmployee?.firstName || ''} onChange={e => setCurrentEmployee(p => ({ ...p, firstName: e.target.value }))} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400"/>
                         <input type="text" placeholder="Surname" value={currentEmployee?.surname || ''} onChange={e => setCurrentEmployee(p => ({ ...p, surname: e.target.value }))} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400"/>
                         <input type="text" placeholder="Position" value={currentEmployee?.position || ''} onChange={e => setCurrentEmployee(p => ({ ...p, position: e.target.value }))} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400"/>
                         <input type="text" placeholder="Department" value={currentEmployee?.department || ''} onChange={e => setCurrentEmployee(p => ({...p, department: e.target.value}))} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400" />
                         <div className="relative">
                             <input 
                                type={showPin ? 'text' : 'password'}
                                placeholder="4-Digit PIN (optional)" 
                                value={currentEmployee?.pin || ''} 
                                onChange={e => setCurrentEmployee(p => ({ ...p, pin: e.target.value.replace(/\D/g, '') }))} 
                                maxLength={4}
                                className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400"
                             />
                              <button type="button" onClick={() => setShowPin(!showPin)} className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white">
                                 {showPin ? <Icons.EyeOff /> : <Icons.Eye />}
                              </button>
                         </div>
                         <input type="text" placeholder="Avatar URL (optional)" value={currentEmployee?.avatarUrl || ''} onChange={e => setCurrentEmployee(p => ({...p, avatarUrl: e.target.value}))} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400" />
                         <input type="text" placeholder="Employee ID" value={currentEmployee?.employeeId || ''} readOnly={!!currentEmployee?.id} className="w-full p-3 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400 read-only:bg-gray-800 read-only:cursor-not-allowed"/>
                        <div className="flex justify-end space-x-4 pt-2">
                            <button onClick={closeModal} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">Cancel</button>
                            <button onClick={handleSave} className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold transition-colors flex items-center" disabled={isLoading}>
                                {isLoading ? <Spinner /> : 'Save'}
                            </button>
                        </div>
                    </div>
                </Modal>
                
                <Modal isOpen={isBioModalOpen} onClose={closeBioModal} title={`Register ${bioStep === 'face' ? 'Face' : 'Fingerprint'}`}>
                    <div className="text-center p-4">
                        {bioStep === 'face' && (
                            <div className="relative w-full aspect-square bg-gray-900 rounded-lg overflow-hidden flex justify-center items-center">
                                <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]"></video>
                            </div>
                        )}
                        {bioStep === 'fingerprint' && (
                             <div className="flex justify-center items-center text-yellow-400 py-8">
                               <Icons.FingerprintScan className="w-24 h-24 animate-pulse" />
                            </div>
                        )}
                        <p className="text-xl font-semibold mt-4 h-8">{bioStatus}</p>
                    </div>
                </Modal>
            </div>
        </>
    );
};

export default EmployeeManagement;