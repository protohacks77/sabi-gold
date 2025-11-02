import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, addDoc, deleteDoc, doc, Timestamp, query, orderBy, updateDoc, where, writeBatch, getDocs } from 'firebase/firestore';
import type { Employee, Leave, LeaveRequest } from '../../types';
import Spinner from '../common/Spinner';
import { Icons } from '../common/Icons';
import Modal from '../common/Modal';
import ConfirmationModal from '../common/ConfirmationModal';


const LeaveManagement: React.FC = () => {
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [newLeave, setNewLeave] = useState({
        employeeDocId: '',
        startDate: '',
        endDate: '',
        type: 'Sick' as 'Sick' | 'Vacation' | 'Unpaid'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [requestToApprove, setRequestToApprove] = useState<LeaveRequest | null>(null);

    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterEmployeeId, setFilterEmployeeId] = useState('all');
    const [filterLeaveType, setFilterLeaveType] = useState<string>('all');

    const [isRecycleBinOpen, setIsRecycleBinOpen] = useState(false);
    const [deletedLeaves, setDeletedLeaves] = useState<Leave[]>([]);
    const [isLoadingBin, setIsLoadingBin] = useState(false);
    const [selectedDeletedLeaves, setSelectedDeletedLeaves] = useState<string[]>([]);
    const [leaveToDeletePermanently, setLeaveToDeletePermanently] = useState<string[] | 'all' | null>(null);
    const [leaveToSoftDelete, setLeaveToSoftDelete] = useState<Leave | null>(null);

    useEffect(() => {
        const qLeaves = query(collection(db, 'leave'), where('deleted', '!=', true));
        const unsubLeaves = onSnapshot(qLeaves, (snapshot) => {
            const leaves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leave));
            leaves.sort((a, b) => b.startDate.toMillis() - a.startDate.toMillis());
            setLeaves(leaves);
        });

        const qRequests = query(collection(db, 'leave_requests'), where('status', '==', 'pending'));
        const unsubRequests = onSnapshot(qRequests, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as LeaveRequest));
            requests.sort((a, b) => a.startDate.toMillis() - b.startDate.toMillis());
            setPendingRequests(requests);
        });

        const unsubEmployees = onSnapshot(query(collection(db, 'employees'), orderBy('firstName')), (snapshot) => {
            setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)));
        });

        return () => { unsubLeaves(); unsubEmployees(); unsubRequests(); };
    }, []);

    const handleAddLeave = async () => {
        if (!newLeave.employeeDocId || !newLeave.startDate || !newLeave.endDate) {
            alert('Please fill all fields.');
            return;
        }
        setIsLoading(true);
        await addDoc(collection(db, 'leave'), {
            ...newLeave,
            startDate: Timestamp.fromDate(new Date(newLeave.startDate)),
            endDate: Timestamp.fromDate(new Date(newLeave.endDate)),
            deleted: false,
            updatedAt: Timestamp.now()
        });
        setNewLeave({ employeeDocId: '', startDate: '', endDate: '', type: 'Sick' });
        setIsLoading(false);
    };
    
    const handleConfirmSoftDelete = async () => {
        if (!leaveToSoftDelete) return;
        await updateDoc(doc(db, 'leave', leaveToSoftDelete.id!), {
            deleted: true,
            updatedAt: Timestamp.now()
        });
        setLeaveToSoftDelete(null);
    };
    
    const handleDenyRequest = async (id: string) => {
        await updateDoc(doc(db, 'leave_requests', id), { status: 'denied' });
    };

    const handleConfirmApproval = async (request: LeaveRequest, updatedEndDate: Date) => {
        setIsLoading(true);
        if (request.isExtension && request.originalLeaveId) {
            await updateDoc(doc(db, 'leave', request.originalLeaveId), {
                endDate: Timestamp.fromDate(updatedEndDate),
                updatedAt: Timestamp.now()
            });
        } else {
            await addDoc(collection(db, 'leave'), {
                employeeDocId: request.employeeDocId,
                startDate: request.startDate,
                endDate: Timestamp.fromDate(updatedEndDate),
                type: request.type,
                deleted: false,
                updatedAt: Timestamp.now()
            });
        }
        await updateDoc(doc(db, 'leave_requests', request.id!), { status: 'approved' });
        setIsLoading(false);
        setRequestToApprove(null);
    };

    const fetchDeletedLeaves = async () => {
        setIsLoadingBin(true);
        const q = query(collection(db, 'leave'), where('deleted', '==', true));
        const snapshot = await getDocs(q);
        const deleted = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leave));
        deleted.sort((a, b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
        setDeletedLeaves(deleted);
        setIsLoadingBin(false);
    };

    const handleOpenRecycleBin = () => {
        fetchDeletedLeaves();
        setIsRecycleBinOpen(true);
    };

    const handleCloseRecycleBin = () => {
        setIsRecycleBinOpen(false);
        setDeletedLeaves([]);
        setSelectedDeletedLeaves([]);
    };
    
    const confirmPermanentDelete = async () => {
        if (!leaveToDeletePermanently) return;
        setIsLoadingBin(true);
        const batch = writeBatch(db);
        
        if (leaveToDeletePermanently === 'all') {
            deletedLeaves.forEach(leave => batch.delete(doc(db, 'leave', leave.id!)));
        } else {
            leaveToDeletePermanently.forEach(id => batch.delete(doc(db, 'leave', id)));
        }
        
        await batch.commit();
        setLeaveToDeletePermanently(null);
        setSelectedDeletedLeaves([]);
        await fetchDeletedLeaves(); // Refreshes the bin
        setIsLoadingBin(false);
    };


    const getEmployee = (employeeDocId: string) => employees.find(e => e.id === employeeDocId);

    const filteredLeaves = leaves.filter(leave => {
        const leaveStartDate = leave.startDate.toDate();
        const leaveEndDate = leave.endDate.toDate();

        const fStartDate = filterStartDate ? new Date(filterStartDate) : null;
        const fEndDate = filterEndDate ? new Date(filterEndDate) : null;
        if(fEndDate) fEndDate.setHours(23, 59, 59, 999);

        const dateMatch = (!fStartDate || leaveEndDate >= fStartDate) && (!fEndDate || leaveStartDate <= fEndDate);
        const employeeMatch = filterEmployeeId === 'all' || leave.employeeDocId === filterEmployeeId;
        const typeMatch = filterLeaveType === 'all' || leave.type === filterLeaveType;

        return dateMatch && employeeMatch && typeMatch;
    });

    const inputClasses = "w-full p-2 bg-gray-800 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400";
    const labelClasses = "block text-sm font-medium text-gray-400 mb-1";
    
    let permanentDeleteMessage: React.ReactNode = '';
    if (leaveToDeletePermanently) {
        if (leaveToDeletePermanently === 'all') {
            permanentDeleteMessage = <>Are you sure you want to permanently delete all <strong>{deletedLeaves.length}</strong> items? This action cannot be undone.</>;
        } else {
             permanentDeleteMessage = <>Are you sure you want to permanently delete the selected <strong>{leaveToDeletePermanently.length}</strong> item(s)? This action cannot be undone.</>;
        }
    }
    
    const getSoftDeleteMessage = () => {
        if (!leaveToSoftDelete) return '';
        const employee = getEmployee(leaveToSoftDelete.employeeDocId);
        const employeeName = employee ? `${employee.firstName} ${employee.surname}` : 'this employee';
        return <>Are you sure you want to move the leave entry for <strong>{employeeName}</strong> to the recycle bin?</>;
    }


    return (
        <div className="space-y-6">
            <ConfirmationModal
                isOpen={!!leaveToSoftDelete}
                onClose={() => setLeaveToSoftDelete(null)}
                onConfirm={handleConfirmSoftDelete}
                title="Move to Recycle Bin"
                message={getSoftDeleteMessage()}
                confirmText="Confirm"
                isLoading={isLoading}
                confirmButtonClass="bg-yellow-500 hover:bg-yellow-600 text-gray-900"
                icon={<Icons.Trash className="w-10 h-10 text-yellow-500" />}
            />
            <ConfirmationModal
                isOpen={!!leaveToDeletePermanently}
                onClose={() => setLeaveToDeletePermanently(null)}
                onConfirm={confirmPermanentDelete}
                title="Confirm Permanent Deletion"
                message={permanentDeleteMessage}
                isLoading={isLoadingBin}
            />
            {requestToApprove && (
                <ApprovalModal 
                    isOpen={!!requestToApprove}
                    onClose={() => setRequestToApprove(null)}
                    request={requestToApprove}
                    onConfirm={handleConfirmApproval}
                    isLoading={isLoading}
                />
            )}
             <RecycleBinModal
                isOpen={isRecycleBinOpen}
                onClose={handleCloseRecycleBin}
                deletedLeaves={deletedLeaves}
                isLoading={isLoadingBin}
                selectedLeaves={selectedDeletedLeaves}
                setSelectedLeaves={setSelectedDeletedLeaves}
                onRestore={fetchDeletedLeaves}
                onDelete={() => setLeaveToDeletePermanently(selectedDeletedLeaves)}
                onDeleteAll={() => setLeaveToDeletePermanently('all')}
                getEmployee={getEmployee}
            />
            {pendingRequests.length > 0 && (
                 <div className="bg-gray-900/50 p-6 rounded-xl border border-yellow-400/50">
                    <h2 className="text-xl font-semibold mb-4 text-white">Pending Leave Requests</h2>
                     <div className="overflow-x-auto">
                        <table className="min-w-full">
                           <thead className="border-b border-gray-700">
                               <tr>
                                   {['Employee', 'Dates', 'Type & Reason', 'Actions'].map(h => <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}
                               </tr>
                           </thead>
                           <tbody>
                               {pendingRequests.map(req => (
                                   <tr key={req.id} className="hover:bg-gray-800/50 border-b border-gray-700 last:border-b-0">
                                       <td className="py-3 px-4 whitespace-nowrap text-white font-medium">{req.employeeName}</td>
                                       <td className="py-3 px-4 whitespace-nowrap text-gray-300">{req.startDate.toDate().toLocaleDateString()} - {req.endDate.toDate().toLocaleDateString()}</td>
                                       <td className="py-3 px-4 whitespace-nowrap text-gray-300">
                                            <div className="flex items-center gap-2">
                                               <span>{req.type}</span>
                                               {req.isExtension && <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">Extension</span>}
                                           </div>
                                            {req.reason && <p className="text-xs text-gray-500 truncate max-w-xs" title={req.reason}>{req.reason}</p>}
                                       </td>
                                       <td className="py-3 px-4 whitespace-nowrap">
                                           <div className="flex items-center gap-2">
                                                <button onClick={() => setRequestToApprove(req)} className="px-3 py-1 bg-green-500/20 hover:bg-green-500/40 text-green-400 text-xs font-semibold rounded-md">Approve</button>
                                                <button onClick={() => handleDenyRequest(req.id!)} className="px-3 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs font-semibold rounded-md">Deny</button>
                                           </div>
                                       </td>
                                   </tr>
                               ))}
                           </tbody>
                        </table>
                     </div>
                 </div>
            )}
            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                 <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-white">Add New Leave</h2>
                    <button onClick={handleOpenRecycleBin} className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-semibold text-gray-300 transition-colors">
                        <Icons.Trash />
                        <span>Recycle Bin</span>
                    </button>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                    <div className="lg:col-span-2">
                        <label className={labelClasses}>Employee</label>
                        <select value={newLeave.employeeDocId} onChange={e => setNewLeave(p => ({...p, employeeDocId: e.target.value}))} className={inputClasses}>
                             <option value="">Select Employee</option>
                             {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.surname}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className={labelClasses}>Start Date</label>
                        <input type="date" value={newLeave.startDate} onChange={e => setNewLeave(p => ({...p, startDate: e.target.value}))} className={inputClasses}/>
                    </div>
                     <div>
                        <label className={labelClasses}>End Date</label>
                        <input type="date" value={newLeave.endDate} onChange={e => setNewLeave(p => ({...p, endDate: e.target.value}))} className={inputClasses}/>
                    </div>
                    <button onClick={handleAddLeave} className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg h-10 flex items-center justify-center" disabled={isLoading}>
                         {isLoading ? <Spinner /> : 'Add Leave'}
                    </button>
                 </div>
            </div>

            <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700">
                 <h3 className="text-lg font-semibold mb-4 text-white">Filter Leave Records</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className={labelClasses}>From</label>
                        <input type="date" value={filterStartDate} onChange={e => setFilterStartDate(e.target.value)} className={inputClasses}/>
                    </div>
                    <div>
                        <label className={labelClasses}>To</label>
                        <input type="date" value={filterEndDate} onChange={e => setFilterEndDate(e.target.value)} className={inputClasses}/>
                    </div>
                    <div>
                        <label className={labelClasses}>Employee</label>
                        <select value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)} className={inputClasses}>
                             <option value="all">All Employees</option>
                             {employees.map(e => <option key={e.id} value={e.id}>{e.firstName} {e.surname}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className={labelClasses}>Leave Type</label>
                        <select value={filterLeaveType} onChange={e => setFilterLeaveType(e.target.value)} className={inputClasses}>
                             <option value="all">All Types</option>
                             <option value="Sick">Sick</option>
                             <option value="Vacation">Vacation</option>
                             <option value="Unpaid">Unpaid</option>
                        </select>
                    </div>
                </div>
            </div>
            
            <div className="bg-gray-900/50 rounded-xl overflow-x-auto border border-gray-700">
                <table className="min-w-full">
                    <thead className="border-b border-gray-700">
                        <tr>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Dates</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Type</th>
                            <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredLeaves.map(l => {
                            const employee = getEmployee(l.employeeDocId);
                            return (
                                <tr key={l.id} className="hover:bg-gray-800/50 border-b border-gray-700 last:border-b-0">
                                    <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <img className="w-10 h-10 rounded-full object-cover bg-gray-700" src={employee?.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${employee?.firstName} ${employee?.surname}`} alt={employee?.firstName} />
                                            <div>
                                                <p className="text-white font-medium">{employee ? `${employee.firstName} ${employee.surname}` : 'Unknown'}</p>
                                                <p className="text-gray-400 text-sm">{employee?.position}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 px-4 whitespace-nowrap text-gray-300">{l.startDate.toDate().toLocaleDateString()} - {l.endDate.toDate().toLocaleDateString()}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-gray-300">{l.type}</td>
                                    <td className="py-3 px-4 whitespace-nowrap text-right">
                                        <button onClick={() => setLeaveToSoftDelete(l)} className="p-2 bg-red-500/10 hover:bg-red-500/30 text-red-500 rounded-full transition-colors" aria-label="Delete">
                                            <Icons.Trash className="w-5 h-5"/>
                                        </button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const ApprovalModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    request: LeaveRequest;
    onConfirm: (request: LeaveRequest, updatedEndDate: Date) => void;
    isLoading: boolean;
}> = ({ isOpen, onClose, request, onConfirm, isLoading }) => {
    const [endDate, setEndDate] = useState(request.endDate.toDate().toISOString().split('T')[0]);

    useEffect(() => {
        setEndDate(request.endDate.toDate().toISOString().split('T')[0]);
    }, [request]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Approve Leave Request">
            <div className="space-y-4">
                <p><strong>Employee:</strong> {request.employeeName}</p>
                <p><strong>Type:</strong> {request.type} {request.isExtension && <span className="text-xs bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full">Extension</span>}</p>
                <p><strong>Reason:</strong> {request.reason || 'N/A'}</p>
                <p><strong>Start Date:</strong> {request.startDate.toDate().toLocaleDateString()}</p>
                <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">End Date (editable)</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full p-2 bg-gray-800 rounded-lg border border-gray-600"/>
                </div>
                 <div className="flex justify-end space-x-4 pt-2">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-semibold transition-colors">Cancel</button>
                    <button onClick={() => onConfirm(request, new Date(endDate))} className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center min-w-[100px] justify-center" disabled={isLoading}>
                        {isLoading ? <Spinner /> : 'Confirm'}
                    </button>
                </div>
            </div>
        </Modal>
    )
};

const RecycleBinModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    deletedLeaves: Leave[];
    isLoading: boolean;
    selectedLeaves: string[];
    setSelectedLeaves: React.Dispatch<React.SetStateAction<string[]>>;
    onRestore: () => void;
    onDelete: () => void;
    onDeleteAll: () => void;
    getEmployee: (id: string) => Employee | undefined;
}> = ({ isOpen, onClose, deletedLeaves, isLoading, selectedLeaves, setSelectedLeaves, onRestore, onDelete, onDeleteAll, getEmployee }) => {

    const handleToggleSelect = (id: string) => {
        setSelectedLeaves(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleToggleSelectAll = () => {
        if (selectedLeaves.length === deletedLeaves.length) {
            setSelectedLeaves([]);
        } else {
            setSelectedLeaves(deletedLeaves.map(l => l.id!));
        }
    };

    const handleRestoreSelected = async () => {
        const batch = writeBatch(db);
        selectedLeaves.forEach(id => {
            batch.update(doc(db, 'leave', id), { deleted: false, updatedAt: Timestamp.now() });
        });
        await batch.commit();
        setSelectedLeaves([]);
        onRestore();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Recycle Bin" size="5xl">
            <div className="space-y-4">
                <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg">
                    <div className="flex items-center gap-4">
                        <button onClick={handleRestoreSelected} disabled={selectedLeaves.length === 0} className="px-3 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-semibold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            Restore Selected ({selectedLeaves.length})
                        </button>
                         <button onClick={onDelete} disabled={selectedLeaves.length === 0} className="px-3 py-2 bg-red-500/10 hover:bg-red-500/30 text-red-500 font-semibold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                            Delete Selected Permanently
                        </button>
                    </div>
                    <button onClick={onDeleteAll} disabled={deletedLeaves.length === 0} className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                        Empty Recycle Bin
                    </button>
                </div>

                <div className="overflow-y-auto max-h-[60vh] border border-gray-700 rounded-lg">
                    {isLoading ? <div className="flex justify-center p-8"><Spinner/></div> :
                    <table className="min-w-full">
                        <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
                            <tr>
                                <th className="p-4 text-left"><input type="checkbox" checked={selectedLeaves.length === deletedLeaves.length && deletedLeaves.length > 0} onChange={handleToggleSelectAll} className="rounded bg-gray-700 border-gray-600 text-yellow-400 focus:ring-yellow-400"/></th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Dates</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Deleted On</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deletedLeaves.length === 0 ? (
                                <tr><td colSpan={4} className="text-center py-8 text-gray-500">Recycle bin is empty.</td></tr>
                            ) : deletedLeaves.map(l => {
                                const employee = getEmployee(l.employeeDocId);
                                return (
                                    <tr key={l.id} className="hover:bg-gray-800/50 border-b border-gray-700 last:border-b-0">
                                        <td className="p-4"><input type="checkbox" checked={selectedLeaves.includes(l.id!)} onChange={() => handleToggleSelect(l.id!)} className="rounded bg-gray-700 border-gray-600 text-yellow-400 focus:ring-yellow-400"/></td>
                                        <td className="py-3 px-4 whitespace-nowrap text-white font-medium">{employee ? `${employee.firstName} ${employee.surname}` : 'Unknown'}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-gray-300">{l.startDate.toDate().toLocaleDateString()} - {l.endDate.toDate().toLocaleDateString()}</td>
                                        <td className="py-3 px-4 whitespace-nowrap text-gray-400">{l.updatedAt?.toDate().toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    }
                </div>
            </div>
        </Modal>
    );
};

export default LeaveManagement;