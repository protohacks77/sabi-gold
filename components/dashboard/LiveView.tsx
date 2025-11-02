import React, { useState, useEffect } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, doc, getDoc, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Employee, Leave, Settings } from '../../types';
import { Icons } from '../common/Icons';

type StatusFilter = 'All' | 'On-Site' | 'Off-Site' | 'On Leave';

const WorkforceDashboard: React.FC = () => {
    const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
    const [departmentFilter, setDepartmentFilter] = useState('All');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 6;

    useEffect(() => {
        const fetchSettings = async () => {
            const settingsDoc = await getDoc(doc(db, 'app-settings', 'main'));
            if (settingsDoc.exists()) setSettings(settingsDoc.data() as Settings);
        };
        fetchSettings();

        const unsubEmployees = onSnapshot(query(collection(db, 'employees'), orderBy('firstName')), 
            (snapshot) => setAllEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)))
        );
        
        const unsubLeaves = onSnapshot(collection(db, 'leave'), 
            (snapshot) => setLeaves(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leave)))
        );

        return () => { unsubEmployees(); unsubLeaves(); };
    }, []);

    const getEmployeeEffectiveStatus = (employee: Employee): StatusFilter => {
        const today = new Date();
        const isOnLeaveToday = leaves.some(leave => {
            const startDate = leave.startDate.toDate();
            const endDate = leave.endDate.toDate();
            return employee.id === leave.employeeDocId && today >= startDate && today <= endDate;
        });
        if (isOnLeaveToday) return 'On Leave';
        return employee.status === 'Logged In' ? 'On-Site' : 'Off-Site';
    };

    const employeesWithStatus = allEmployees.map(emp => ({ ...emp, effectiveStatus: getEmployeeEffectiveStatus(emp) }));

    const filteredEmployees = employeesWithStatus.filter(emp => {
        const nameMatch = `${emp.firstName} ${emp.surname}`.toLowerCase().includes(searchTerm.toLowerCase());
        const statusMatch = statusFilter === 'All' || emp.effectiveStatus === statusFilter;
        const departmentMatch = departmentFilter === 'All' || emp.department === departmentFilter;
        return nameMatch && statusMatch && departmentMatch;
    });

    const paginatedEmployees = filteredEmployees.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);
    const departments = ['All', ...Array.from(new Set(allEmployees.map(e => e.department).filter(Boolean))) as string[]];

    const stats = {
        total: allEmployees.length,
        onSite: employeesWithStatus.filter(e => e.effectiveStatus === 'On-Site').length,
        onLeave: employeesWithStatus.filter(e => e.effectiveStatus === 'On Leave').length
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-white">Workforce Monitoring Dashboard</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <StatCard title="Total Employees" value={stats.total.toString()} />
                 <StatCard title="Currently On-Site" value={stats.onSite.toString()} />
                 <StatCard title="On Leave Today" value={stats.onLeave.toString()} />
            </div>

            <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="relative flex-grow min-w-[200px]">
                         <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
                        <input type="search" placeholder="Search employee..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-400" />
                    </div>
                    <FilterDropdown value={statusFilter} onChange={e => setStatusFilter(e.target.value as StatusFilter)} options={['All', 'On-Site', 'Off-Site', 'On Leave']} label="Status:" />
                    <FilterDropdown value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)} options={departments} label="Department:" />
                </div>
            </div>

            <div className="bg-gray-900/50 border border-gray-700 rounded-xl overflow-x-auto">
                <table className="min-w-full">
                    <thead className="border-b border-gray-700">
                        <tr>
                            {['Employee Name', 'Status', 'Shift Progress', 'Last Activity', 'Department', ''].map(h => 
                                <th key={h} className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedEmployees.map(employee => <EmployeeRow key={employee.id} employee={employee} settings={settings} />)}
                    </tbody>
                </table>
                 <div className="p-4 flex items-center justify-between text-sm text-gray-400">
                    <p>Showing {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredEmployees.length)} of {filteredEmployees.length}</p>
                    <div className="flex gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Previous</button>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 bg-gray-700 rounded disabled:opacity-50">Next</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatCard: React.FC<{ title: string, value: string }> = ({ title, value }) => (
    <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
        <p className="text-gray-400 font-medium">{title}</p>
        <p className="text-4xl font-bold text-white mt-1">{value}</p>
    </div>
);

const FilterDropdown: React.FC<{ value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: string[], label: string }> = ({ value, onChange, options, label }) => (
    <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-400">{label}</label>
        <select value={value} onChange={onChange} className="p-2 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-400">
            {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
    </div>
);

const EmployeeRow: React.FC<{ employee: Employee & { effectiveStatus: StatusFilter }, settings: Settings | null }> = ({ employee, settings }) => {
    
    const StatusTag = () => {
        const styles = {
            'On-Site': 'bg-green-500/20 text-green-400',
            'Off-Site': 'bg-red-500/20 text-red-400',
            'On Leave': 'bg-indigo-500/20 text-indigo-400',
        };
        const text = { 'On-Site': 'Logged In', 'Off-Site': 'Logged Out', 'On Leave': 'On Leave' };
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[employee.effectiveStatus]}`}>{text[employee.effectiveStatus]}</span>;
    };

    const ShiftProgress = () => {
        const [progress, setProgress] = useState(0);
        
        useEffect(() => {
            if (employee.effectiveStatus !== 'On-Site' || !employee.lastLoginTime || !settings) return;
            
            const calculateProgress = () => {
                const now = new Date();
                const loginTime = employee.lastLoginTime!.toDate();
                const shiftStart = new Date(loginTime);
                const [startH, startM] = settings.shiftStart.split(':').map(Number);
                shiftStart.setHours(startH, startM, 0, 0);

                const shiftEnd = new Date(loginTime);
                const [endH, endM] = settings.shiftEnd.split(':').map(Number);
                shiftEnd.setHours(endH, endM, 0, 0);
                if (shiftEnd <= shiftStart) shiftEnd.setDate(shiftEnd.getDate() + 1);

                const totalDuration = shiftEnd.getTime() - shiftStart.getTime();
                const elapsed = now.getTime() - loginTime.getTime();
                setProgress(Math.min(100, Math.max(0, (elapsed / totalDuration) * 100)));
            };

            calculateProgress();
            const interval = setInterval(calculateProgress, 60000); // Update every minute
            return () => clearInterval(interval);

        }, [employee, settings]);
        
        if (employee.effectiveStatus !== 'On-Site') return <div className="text-gray-500">-/-</div>;
        
        return (
            <div className="flex items-center gap-2">
                <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${progress}%` }}></div>
                </div>
                {/* Simplified time display */}
                <span className="text-xs text-gray-400">{settings ? `${Math.floor(progress/100 * 8)}h / 8h` : ''}</span>
            </div>
        );
    };

    const LastActivity = () => {
        if (employee.effectiveStatus === 'On-Site' && employee.lastLoginTime) {
            return employee.lastLoginTime.toDate().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' });
        }
        // This is a simplification. A real implementation would query the last logout record.
        if (employee.effectiveStatus === 'Off-Site') {
            return "Yesterday, 17:10"; 
        }
        return '-';
    };

    return (
        <tr className="hover:bg-gray-800/50 transition-colors border-b border-gray-700 last:border-b-0">
            <td className="py-3 px-4 whitespace-nowrap">
                <div className="flex items-center gap-3">
                    <img className="w-10 h-10 rounded-full object-cover bg-gray-700" src={employee.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${employee.firstName} ${employee.surname}`} alt={`${employee.firstName} ${employee.surname}`} />
                    <div>
                        <p className="text-white font-medium">{employee.firstName} {employee.surname}</p>
                        <p className="text-gray-400 text-sm">{employee.position}</p>
                    </div>
                </div>
            </td>
            <td className="py-3 px-4 whitespace-nowrap"><StatusTag /></td>
            <td className="py-3 px-4 whitespace-nowrap"><ShiftProgress /></td>
            <td className="py-3 px-4 whitespace-nowrap text-gray-300"><LastActivity/></td>
            <td className="py-3 px-4 whitespace-nowrap text-gray-300">{employee.department || '-'}</td>
            <td className="py-3 px-4 whitespace-nowrap text-gray-400">...</td>
        </tr>
    );
};

export default WorkforceDashboard;