import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/firebase';
import { collection, query, where, onSnapshot, orderBy, getDoc, doc } from 'firebase/firestore';
import type { Employee, AttendanceLog, Leave, Settings } from '../types';
import Modal from './common/Modal';
import Spinner from './common/Spinner';
import { Icons } from './common/Icons';
import { calculateDuration } from '../utils/time';

interface EmployeeProfileModalProps {
    employee: Employee;
    onClose: () => void;
}

type Tab = 'overview' | 'attendance' | 'leave';

const EmployeeProfileModal: React.FC<EmployeeProfileModalProps> = ({ employee, onClose }) => {
    const [activeTab, setActiveTab] = useState<Tab>('overview');
    const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        setIsLoading(true);
        const qAttendance = query(collection(db, 'attendance'), where('employeeDocId', '==', employee.id));
        const unsubAtt = onSnapshot(qAttendance, snapshot => {
            const fetchedLogs = snapshot.docs.map(doc => doc.data() as AttendanceLog);
            fetchedLogs.sort((a,b) => b.timestamp.toMillis() - a.timestamp.toMillis());
            setAttendance(fetchedLogs);
        });

        const qLeaves = query(collection(db, 'leave'), where('employeeDocId', '==', employee.id));
        const unsubLeaves = onSnapshot(qLeaves, snapshot => {
             const fetchedLeaves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Leave }));
            fetchedLeaves.sort((a,b) => b.startDate.toMillis() - a.startDate.toMillis());
            setLeaves(fetchedLeaves);
        });
        
        const fetchSettings = async () => {
            const settingsDoc = await getDoc(doc(db, 'app-settings', 'main'));
            if (settingsDoc.exists()) setSettings(settingsDoc.data() as Settings);
        };
        
        Promise.all([fetchSettings()]).finally(() => setIsLoading(false));

        return () => { unsubAtt(); unsubLeaves(); };
    }, [employee.id]);
    
    const TabButton: React.FC<{ tab: Tab; label: string }> = ({ tab, label }) => (
        <button 
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${activeTab === tab ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
        >{label}</button>
    );

    return (
        <Modal isOpen={true} onClose={onClose} title={`${employee.firstName} ${employee.surname}'s Profile`} size="5xl">
            {isLoading ? <div className="h-96 flex items-center justify-center"><Spinner /></div> : (
                <div>
                    <div className="flex border-b border-gray-700">
                        <TabButton tab="overview" label="Overview" />
                        <TabButton tab="attendance" label="Attendance Log" />
                        <TabButton tab="leave" label="Leave History" />
                    </div>
                     <div className="pt-6">
                        {activeTab === 'overview' && <OverviewTab leaves={leaves} attendance={attendance} settings={settings} />}
                        {activeTab === 'attendance' && <AttendanceTab attendance={attendance} />}
                        {activeTab === 'leave' && <LeaveHistoryTab leaves={leaves} />}
                    </div>
                </div>
            )}
        </Modal>
    );
};


const OverviewTab: React.FC<{ leaves: Leave[], attendance: AttendanceLog[], settings: Settings | null }> = ({ leaves, attendance, settings }) => {
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    
    const { daysTaken, daysRemaining } = useMemo(() => {
        const annualLeaveDays = settings?.annualLeaveDays || 0;
        const currentYear = new Date().getFullYear();
        const leavesThisYear = leaves.filter(l => l.startDate.toDate().getFullYear() === currentYear && l.type === 'Vacation');
        const calcDuration = (start: Date, end: Date) => (end.getTime() - start.getTime()) / (1000 * 3600 * 24) + 1;
        const daysTaken = Math.round(leavesThisYear.reduce((acc, l) => acc + calcDuration(l.startDate.toDate(), l.endDate.toDate()), 0));
        return { daysTaken, daysRemaining: annualLeaveDays - daysTaken };
    }, [leaves, settings]);
    
    const monthStats = useMemo(() => {
        const pairedLogs = pairAttendanceLogs(attendance);
        const logsInMonth = pairedLogs.filter(log => log.in.toISOString().slice(0, 7) === selectedMonth);
        const totalHours = logsInMonth.reduce((acc, log) => acc + (log.out.getTime() - log.in.getTime()), 0) / (1000 * 60 * 60);
        return {
            daysWorked: logsInMonth.length,
            totalHours: totalHours.toFixed(2)
        };
    }, [attendance, selectedMonth]);

    const monthOptions = useMemo(() => {
        const options = new Set<string>();
        attendance.forEach(log => options.add(log.timestamp.toDate().toISOString().slice(0, 7)));
        if (!options.has(new Date().toISOString().slice(0,7))) {
            options.add(new Date().toISOString().slice(0,7));
        }
        return Array.from(options).sort().reverse();
    }, [attendance]);
    
    const StatCard: React.FC<{ title: string; value: string | number; }> = ({ title, value }) => (
        <div className="bg-gray-800/50 p-4 rounded-lg text-center">
            <p className="text-sm text-gray-400">{title}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
        </div>
    );

    return (
        <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard title="Annual Leave Days Taken" value={daysTaken} />
                <StatCard title="Annual Leave Days Remaining" value={daysRemaining < 0 ? 0 : daysRemaining} />
            </div>
             <div className="bg-gray-800/50 p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="font-semibold text-gray-200">Monthly Attendance</h4>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="p-2 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-400">
                        {monthOptions.map(month => (
                            <option key={month} value={month}>{new Date(month + '-02').toLocaleString('default', { month: 'long', year: 'numeric' })}</option>
                        ))}
                    </select>
                </div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <StatCard title="Days Worked" value={monthStats.daysWorked} />
                    <StatCard title="Total Hours" value={monthStats.totalHours} />
                </div>
            </div>
        </div>
    );
};

const AttendanceTab: React.FC<{ attendance: AttendanceLog[] }> = ({ attendance }) => {
    const [filters, setFilters] = useState({ startDate: '', endDate: '', minHours: '' });

    const pairedLogs = useMemo(() => pairAttendanceLogs(attendance), [attendance]);

    const filteredLogs = useMemo(() => {
        return pairedLogs.filter(log => {
            const start = filters.startDate ? new Date(filters.startDate) : null;
            const end = filters.endDate ? new Date(filters.endDate) : null;
            if (end) end.setHours(23, 59, 59, 999);
            const minHours = filters.minHours ? parseFloat(filters.minHours) : 0;
            
            const dateMatch = (!start || log.in >= start) && (!end || log.in <= end);
            const durationHours = (log.out.getTime() - log.in.getTime()) / (1000 * 60 * 60);
            const hoursMatch = !minHours || durationHours >= minHours;

            return dateMatch && hoursMatch;
        });
    }, [pairedLogs, filters]);
    
    const inputClasses = "w-full p-2 bg-gray-700 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400";

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-800/50 rounded-lg">
                <input type="date" value={filters.startDate} onChange={e => setFilters(f => ({...f, startDate: e.target.value}))} className={inputClasses} />
                <input type="date" value={filters.endDate} onChange={e => setFilters(f => ({...f, endDate: e.target.value}))} className={inputClasses} />
                <input type="number" placeholder="Min hours worked..." value={filters.minHours} onChange={e => setFilters(f => ({...f, minHours: e.target.value}))} className={inputClasses} />
            </div>
            <div className="max-h-96 overflow-y-auto">
                <table className="min-w-full">
                    <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
                        <tr>
                             {['Date', 'Clock In', 'Clock Out', 'Duration'].map(h => <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                         {filteredLogs.map((log, index) => (
                            <tr key={index} className="hover:bg-gray-800/50 border-b border-gray-700 last:border-b-0">
                                <td className="py-3 px-4 whitespace-nowrap text-gray-300">{log.in.toLocaleDateString()}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-gray-300">{log.in.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-gray-300">{log.out.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-gray-300">{calculateDuration(log.in, log.out)}</td>
                            </tr>
                         ))}
                    </tbody>
                </table>
                 {filteredLogs.length === 0 && <p className="text-center text-gray-500 py-8">No records match your filters.</p>}
            </div>
        </div>
    );
};

const LeaveHistoryTab: React.FC<{ leaves: Leave[] }> = ({ leaves }) => {
    return (
        <div className="max-h-96 overflow-y-auto">
            <table className="min-w-full">
                <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
                    <tr>
                         {['Type', 'Start Date', 'End Date', 'Duration (Days)'].map(h => <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {leaves.map(l => (
                        <tr key={l.id} className="hover:bg-gray-800/50 border-b border-gray-700 last:border-b-0">
                            <td className="py-3 px-4 whitespace-nowrap text-gray-300">{l.type}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-gray-300">{l.startDate.toDate().toLocaleDateString()}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-gray-300">{l.endDate.toDate().toLocaleDateString()}</td>
                            <td className="py-3 px-4 whitespace-nowrap text-gray-300">{Math.round((l.endDate.toMillis() - l.startDate.toMillis()) / (1000 * 3600 * 24)) + 1}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
             {leaves.length === 0 && <p className="text-center text-gray-500 py-8">No leave records found.</p>}
        </div>
    );
};

// Helper function to pair 'in' and 'out' logs
const pairAttendanceLogs = (logs: AttendanceLog[]): { in: Date, out: Date }[] => {
    const sortedLogs = [...logs].sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis());
    const paired = [];
    for(let i=0; i < sortedLogs.length - 1; i++) {
        if(sortedLogs[i].type === 'in' && sortedLogs[i+1].type === 'out') {
            paired.push({ in: sortedLogs[i].timestamp.toDate(), out: sortedLogs[i+1].timestamp.toDate() });
            i++; // Skip next log as it's paired
        }
    }
    return paired.reverse(); // Show most recent first
};

export default EmployeeProfileModal;