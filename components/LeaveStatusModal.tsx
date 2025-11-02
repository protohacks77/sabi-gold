import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import type { Employee, Leave, LeaveRequest, Settings } from '../types';
import Modal from './common/Modal';
import AreaChart from './common/AreaChart';
import Spinner from './common/Spinner';
import { Icons } from './common/Icons';
import Toast from './common/Toast';

interface LeaveStatusModalProps {
    employee: Employee;
    onClose: () => void;
}

type Period = 'This Year' | 'All Time';

const LeaveStatusModal: React.FC<LeaveStatusModalProps> = ({ employee, onClose }) => {
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [period, setPeriod] = useState<Period>('This Year');
    const [isLoading, setIsLoading] = useState(true);
    const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
    const [currentLeaveForExtension, setCurrentLeaveForExtension] = useState<Leave | null>(null);
    const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' | 'success' } | null>(null);

    useEffect(() => {
        setIsLoading(true);
        // FIX: The original query required a composite index. To resolve the Firestore error,
        // the orderBy clause has been removed from the query, and sorting is now handled client-side.
        const q = query(collection(db, 'leave'), where('employeeDocId', '==', employee.id));
        const unsubLeaves = onSnapshot(q, snapshot => {
            const fetchedLeaves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leave));
            fetchedLeaves.sort((a, b) => b.startDate.toMillis() - a.startDate.toMillis());
            setLeaves(fetchedLeaves);
            setIsLoading(false);
        });

        const fetchSettings = async () => {
            const settingsDoc = await getDoc(doc(db, 'app-settings', 'main'));
            if (settingsDoc.exists()) setSettings(settingsDoc.data() as Settings);
        };
        fetchSettings();

        const qRequests = query(collection(db, 'leave_requests'), where('employeeDocId', '==', employee.id));
        const unsubRequests = onSnapshot(qRequests, snapshot => {
            snapshot.docChanges().forEach(change => {
                 if (change.type === "modified" && change.doc.data().status !== 'pending') {
                     const req = change.doc.data();
                     setNotification({ message: `Your leave request for ${req.startDate.toDate().toLocaleDateString()} was ${req.status}.`, type: 'success' });
                 }
            });
        });

        return () => { unsubLeaves(); unsubRequests(); };
    }, [employee]);

    const { daysTaken, daysRemaining, chartData, chartLabels } = useMemo(() => {
        const annualLeaveDays = settings?.annualLeaveDays || 0;
        const currentYear = new Date().getFullYear();

        const leavesThisYear = leaves.filter(l => l.startDate.toDate().getFullYear() === currentYear && l.type === 'Vacation');
        
        const calcDuration = (start: Date, end: Date) => (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1;
        
        const daysTaken = Math.round(leavesThisYear.reduce((acc, l) => acc + calcDuration(l.startDate.toDate(), l.endDate.toDate()), 0));
        const daysRemaining = annualLeaveDays - daysTaken;
        
        const filteredLeaves = period === 'This Year' ? leavesThisYear : leaves.filter(l => l.type === 'Vacation');
        
        const monthlyData = Array(12).fill(0);
        const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        filteredLeaves.forEach(l => {
            const start = l.startDate.toDate();
            const end = l.endDate.toDate();
            let current = new Date(start);
            while(current <= end) {
                if (current.getFullYear() === currentYear) {
                    monthlyData[current.getMonth()]++;
                }
                current.setDate(current.getDate() + 1);
            }
        });
        
        return { daysTaken, daysRemaining, chartData: monthlyData, chartLabels: monthLabels };

    }, [leaves, settings, period]);

    const currentLeave = useMemo(() => {
        const now = new Date();
        return leaves.find(l => {
            const start = l.startDate.toDate();
            const end = l.endDate.toDate();
            return now >= start && now <= end;
        });
    }, [leaves]);

    const handleExtensionRequest = async (details: { newEndDate: string, reason: string }) => {
        if (!currentLeaveForExtension) return;
        
        await addDoc(collection(db, 'leave_requests'), {
            employeeDocId: employee.id,
            employeeName: `${employee.firstName} ${employee.surname}`,
            startDate: currentLeaveForExtension.startDate,
            endDate: Timestamp.fromDate(new Date(details.newEndDate)),
            type: currentLeaveForExtension.type,
            status: 'pending',
            reason: details.reason,
            isExtension: true,
            originalLeaveId: currentLeaveForExtension.id,
        });

        setNotification({ message: 'Extension request submitted successfully!', type: 'success' });
        setIsExtensionModalOpen(false);
    };

    const StatCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
        <div className="bg-gray-800/50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    );

    return (
        <Modal isOpen={true} onClose={onClose} title={`Leave Status for ${employee.firstName}`} size="3xl">
            {notification && <Toast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
             {isExtensionModalOpen && currentLeaveForExtension && (
                <ExtensionRequestModal 
                    leave={currentLeaveForExtension}
                    onClose={() => setIsExtensionModalOpen(false)}
                    onSubmit={handleExtensionRequest}
                />
            )}
            <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                    <StatCard title="Annual Leave Days Taken" value={daysTaken} />
                    <StatCard title="Annual Leave Days Remaining" value={daysRemaining < 0 ? 0 : daysRemaining} />
                </div>

                <div className="bg-gray-800/50 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-semibold text-gray-200">Vacation Leave Usage ({period})</h4>
                         {/* Filter might be added here in future */}
                    </div>
                    <div className="h-48">
                        {isLoading ? <Spinner /> : <AreaChart labels={chartLabels} data={chartData} gradientColors={['rgba(139, 92, 246, 0.6)', 'rgba(31, 41, 55, 0.1)']} lineColor="#8B5CF6" />}
                    </div>
                </div>

                <div>
                    <h4 className="font-semibold text-gray-200 mb-2">Leave History</h4>
                    <div className="max-h-60 overflow-y-auto space-y-2 bg-gray-800/50 p-3 rounded-lg">
                        {isLoading && <Spinner />}
                        {!isLoading && leaves.length === 0 && <p className="text-center text-gray-500">No leave records found.</p>}
                        {leaves.map(l => (
                            <div key={l.id} className="bg-gray-700/50 p-3 rounded-md flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-white">{l.type} Leave</p>
                                    <p className="text-sm text-gray-400">{l.startDate.toDate().toLocaleDateString()} - {l.endDate.toDate().toLocaleDateString()}</p>
                                </div>
                                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                    l.type === 'Sick' ? 'bg-blue-500/20 text-blue-300' : 
                                    l.type === 'Vacation' ? 'bg-green-500/20 text-green-300' :
                                    'bg-gray-500/20 text-gray-300'
                                }`}>{l.type}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {currentLeave && (
                     <button onClick={() => { setCurrentLeaveForExtension(currentLeave); setIsExtensionModalOpen(true); }} className="w-full px-4 py-2 bg-yellow-400/20 hover:bg-yellow-400/40 text-yellow-300 font-semibold rounded-md transition-colors">
                        Request Leave Extension
                    </button>
                )}
            </div>
        </Modal>
    );
};


const ExtensionRequestModal: React.FC<{
    leave: Leave;
    onClose: () => void;
    onSubmit: (details: { newEndDate: string, reason: string }) => void;
}> = ({ leave, onClose, onSubmit }) => {
    const [newEndDate, setNewEndDate] = useState(leave.endDate.toDate().toISOString().split('T')[0]);
    const [reason, setReason] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!newEndDate || !reason) {
            alert("Please provide a new end date and a reason.");
            return;
        }
        setIsLoading(true);
        await onSubmit({ newEndDate, reason });
        setIsLoading(false);
    };
    
    const inputClasses = "w-full p-2 bg-gray-800 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400";

    return (
        <Modal isOpen={true} onClose={onClose} title="Request Leave Extension">
            <div className="space-y-4">
                <p className="text-gray-400">Your current leave ends on {leave.endDate.toDate().toLocaleDateString()}.</p>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">New End Date</label>
                    <input type="date" value={newEndDate} min={leave.endDate.toDate().toISOString().split('T')[0]} onChange={e => setNewEndDate(e.target.value)} className={inputClasses} />
                </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Reason for Extension</label>
                    <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Please provide a brief reason..." className={`${inputClasses} h-24`}></textarea>
                </div>
                 <div className="flex justify-end space-x-4 pt-2">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">Cancel</button>
                    <button onClick={handleSubmit} className="px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 rounded-lg font-semibold transition-colors flex items-center" disabled={isLoading}>
                        {isLoading ? <Spinner /> : 'Submit Request'}
                    </button>
                </div>
            </div>
        </Modal>
    )
}

export default LeaveStatusModal;
