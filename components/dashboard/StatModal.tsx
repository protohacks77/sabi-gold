import React, { useState, useEffect, useMemo } from 'react';
import type { Employee, Leave, Settings } from '../../types';
import Modal from '../common/Modal';
import { Icons } from '../common/Icons';
import AreaChart from '../common/AreaChart';

type StatModalView = 'total' | 'on-site' | 'on-leave' | 'absent';

interface StatModalProps {
    view: StatModalView;
    onClose: () => void;
    employees: Employee[];
    leaves: Leave[];
    settings: Settings | null;
    weeklyAttendance?: { label: string; value: number }[];
}

const DoughnutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500">No department data</div>;
    }
    let cumulative = 0;
    const chartData = data.filter(d => d.value > 0);
    return (
        <div className="flex flex-col md:flex-row items-center gap-6 p-4 bg-gray-800/50 rounded-lg">
            <div className="relative w-32 h-32 flex-shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {chartData.map(item => {
                        const percentage = (item.value / total) * 100;
                        const offset = cumulative;
                        cumulative += percentage;
                        return (
                            <circle
                                key={item.label}
                                className={item.color}
                                strokeWidth="4"
                                fill="transparent"
                                r="16"
                                cx="18"
                                cy="18"
                                strokeDasharray={`${percentage} ${100 - percentage}`}
                                strokeDashoffset={`-${offset}`}
                            />
                        );
                    })}
                </svg>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {chartData.map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-sm">
                        <div className={`w-3 h-3 rounded-full ${item.color.replace('stroke', 'bg')}`}></div>
                        <span className="text-gray-300 whitespace-nowrap">{item.label}:</span>
                        <span className="font-semibold text-white">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const StatModal: React.FC<StatModalProps> = ({ view, onClose, employees, leaves, settings, weeklyAttendance = [] }) => {
    const titles: Record<StatModalView, string> = {
        'total': 'Total Employee Roster',
        'on-site': 'On-Site Personnel',
        'on-leave': 'Personnel on Leave',
        'absent': 'Absent Personnel Today',
    };

    const onLeaveIds = useMemo(() => {
        const today = new Date();
        return new Set(leaves
            .filter(l => {
                 const start = l.startDate.toDate();
                 const end = l.endDate.toDate();
                 start.setHours(0,0,0,0);
                 end.setHours(23,59,59,999);
                 return today >= start && today <= end;
            })
            .map(l => l.employeeDocId));
    }, [leaves]);
        
    const onSiteEmployees = useMemo(() => employees.filter(e => e.status === 'Logged In'), [employees]);
    const onLeaveEmployees = useMemo(() => employees.filter(e => onLeaveIds.has(e.id)), [employees, onLeaveIds]);
    const absentEmployees = useMemo(() => employees.filter(e => e.status !== 'Logged In' && !onLeaveIds.has(e.id)), [employees, onLeaveIds]);

    const departmentData = useMemo(() => {
        const counts = employees.reduce((acc, emp) => {
            const dept = emp.department || 'Other';
            acc[dept] = (acc[dept] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const colors = ['stroke-blue-400', 'stroke-green-400', 'stroke-indigo-400', 'stroke-pink-400', 'stroke-sky-400', 'stroke-gray-400'];
        return Object.entries(counts).map(([label, value], i) => ({
            label, value, color: colors[i % colors.length]
        }));
    }, [employees]);

    const renderContent = () => {
        switch (view) {
            case 'total':
                return (
                    <div className="space-y-4">
                        <DoughnutChart data={departmentData} />
                        <EmployeeTable employees={employees} settings={settings} showShiftProgress={false} isSearchable={true} />
                    </div>
                );
            case 'on-site':
                return (
                     <div className="space-y-4">
                        <div className="p-4 bg-gray-800/50 rounded-lg">
                            <h4 className="font-semibold text-gray-300 mb-2">Attendance - Last 7 Days</h4>
                             <div className="h-48">
                                <AreaChart 
                                    labels={weeklyAttendance.map(d => d.label)} 
                                    data={weeklyAttendance.map(d => d.value)} 
                                    gradientColors={['rgba(251, 191, 36, 0.6)', 'rgba(31, 41, 55, 0.1)']} 
                                    lineColor="#FBBF24" 
                                />
                            </div>
                        </div>
                        <EmployeeTable employees={onSiteEmployees} settings={settings} showShiftProgress={true} isSearchable={false} />
                    </div>
                );
            case 'on-leave':
                return <LeaveTable employees={onLeaveEmployees} leaves={leaves} />;
            case 'absent':
                return <EmployeeTable employees={absentEmployees} settings={settings} showShiftProgress={false} isSearchable={true} />;
        }
    };

    return (
        <Modal isOpen={true} onClose={onClose} title={titles[view]} size="5xl">
            {renderContent()}
        </Modal>
    );
};

const EmployeeTable: React.FC<{ employees: Employee[], settings: Settings | null, showShiftProgress: boolean, isSearchable: boolean }> = ({ employees, settings, showShiftProgress, isSearchable }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const filteredEmployees = useMemo(() => {
        if (!isSearchable || !searchTerm) return employees;
        return employees.filter(emp => 
            `${emp.firstName} ${emp.surname}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            emp.position.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [employees, searchTerm, isSearchable]);
    
    return (
        <div>
            {isSearchable && (
                <div className="relative mb-4">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><Icons.Search /></div>
                    <input type="search" placeholder="Search employees..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full p-2 pl-10 bg-gray-800 border border-gray-600 rounded-lg focus:ring-2 focus:ring-yellow-400" />
                </div>
            )}
            <div className="overflow-y-auto max-h-[50vh]">
                <table className="min-w-full">
                    <thead className="border-b border-gray-700 sticky top-0 bg-gray-800">
                        <tr>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Department</th>
                            {showShiftProgress && <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Shift Progress</th>}
                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {filteredEmployees.map(emp => (
                            <tr key={emp.id} className="hover:bg-gray-700/50 transition-colors">
                                <td className="py-3 px-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <img className="w-10 h-10 rounded-full object-cover bg-gray-700" src={emp.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${emp.firstName} ${emp.surname}`} alt={`${emp.firstName} ${emp.surname}`} />
                                        <div>
                                            <p className="text-white font-medium">{emp.firstName} {emp.surname}</p>
                                            <p className="text-gray-400 text-sm">{emp.position}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-gray-300">{emp.department || '-'}</td>
                                {showShiftProgress && <td className="py-3 px-4 whitespace-nowrap"><ShiftProgress employee={emp} settings={settings} /></td>}
                                <td className="py-3 px-4 whitespace-nowrap"><StatusTag status={emp.status} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


const LeaveTable: React.FC<{ employees: Employee[], leaves: Leave[] }> = ({ employees, leaves }) => {
    const today = new Date();
    const findLeave = (empId: string) => leaves.find(l => l.employeeDocId === empId && today >= l.startDate.toDate() && today <= l.endDate.toDate());
    return (
         <div className="overflow-y-auto max-h-[50vh]">
            <table className="min-w-full">
                <thead className="border-b border-gray-700 sticky top-0 bg-gray-800">
                    <tr>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Employee</th>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Leave Type</th>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Duration</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {employees.map(emp => {
                        const leave = findLeave(emp.id);
                        return (
                            <tr key={emp.id} className="hover:bg-gray-700/50 transition-colors">
                                <td className="py-3 px-4 whitespace-nowrap">
                                    <div className="flex items-center gap-3">
                                        <img className="w-10 h-10 rounded-full object-cover bg-gray-700" src={emp.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${emp.firstName} ${emp.surname}`} alt={`${emp.firstName} ${emp.surname}`} />
                                        <div>
                                            <p className="text-white font-medium">{emp.firstName} {emp.surname}</p>
                                            <p className="text-gray-400 text-sm">{emp.position}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-gray-300">{leave?.type || '-'}</td>
                                <td className="py-3 px-4 whitespace-nowrap text-gray-300">
                                    {leave ? `${leave.startDate.toDate().toLocaleDateString()} - ${leave.endDate.toDate().toLocaleDateString()}` : '-'}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    );
};

const StatusTag: React.FC<{ status: Employee['status']}> = ({ status }) => {
    const styles = {
        'Logged In': 'bg-green-500/20 text-green-400',
        'Logged Out': 'bg-red-500/20 text-red-400',
        'On Leave': 'bg-indigo-500/20 text-indigo-400',
    };
    return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status]}`}>{status}</span>;
};

const ShiftProgress: React.FC<{ employee: Employee, settings: Settings | null }> = ({ employee, settings }) => {
    const [progress, setProgress] = useState(0);
    
    useEffect(() => {
        if (employee.status !== 'Logged In' || !employee.lastLoginTime || !settings) {
            setProgress(0);
            return;
        }
        
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
        const interval = setInterval(calculateProgress, 60000);
        return () => clearInterval(interval);

    }, [employee, settings]);
    
    if (employee.status !== 'Logged In') return <div className="text-gray-500">-/-</div>;
    
    return (
        <div className="flex items-center gap-2 w-full">
            <div className="w-full h-2.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-yellow-400 transition-all duration-500" style={{ width: `${progress}%` }}></div>
            </div>
            <span className="text-xs text-gray-300 font-mono">{Math.round(progress)}%</span>
        </div>
    );
};

export default StatModal;