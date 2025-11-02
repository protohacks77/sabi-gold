import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import type { Employee, Settings, AttendanceLog } from '../../types';
import Spinner from '../common/Spinner';

interface LateArrivalsProps {
    employees: Employee[];
    settings: Settings | null;
}

interface LateRecord {
    employeeId: string;
    name: string;
    position: string;
    // FIX: Changed avatarUrl to be a required property that can be undefined
    // to match the object created from employee data and resolve the type predicate error.
    avatarUrl: string | undefined;
    lateEntries: { date: Date }[];
    frequency: { week: number; month: number };
}

type Period = 'Today' | 'This Week' | 'This Month';

const LateArrivals: React.FC<LateArrivalsProps> = ({ employees, settings }) => {
    const [period, setPeriod] = useState<Period>('Today');
    const [lateRecords, setLateRecords] = useState<LateRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const employeeMap = useMemo(() =>
        employees.reduce((acc, emp) => {
            acc[emp.id] = emp;
            return acc;
        }, {} as Record<string, Employee>),
    [employees]);

    useEffect(() => {
        if (!settings || employees.length === 0) {
            setIsLoading(false);
            return;
        }

        const fetchLateArrivals = async () => {
            setIsLoading(true);
            
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfWeek = new Date(now);
            // Set to the first day of the week (Monday)
            const day = now.getDay();
            const diff = now.getDate() - day + (day === 0 ? -6 : 1); 
            startOfWeek.setDate(diff);
            startOfWeek.setHours(0, 0, 0, 0);

            // FIX: Refactor query to prevent Firestore index error.
            // Fetch all records for the month based on timestamp, then filter by type client-side.
            const attendanceQuery = query(
                collection(db, 'attendance'),
                where('timestamp', '>=', Timestamp.fromDate(startOfMonth))
            );

            try {
                const snapshot = await getDocs(attendanceQuery);
                const logs = snapshot.docs
                    .map(doc => doc.data() as AttendanceLog)
                    .filter(log => log.type === 'in'); // Filter for 'in' logs on the client

                const [lateHours, lateMinutes] = settings.shiftStart.split(':').map(Number);

                const lateLogsByEmployee: Record<string, { date: Date }[]> = {};

                logs.forEach(log => {
                    const logDate = log.timestamp.toDate();
                    const shiftStartTime = new Date(logDate);
                    shiftStartTime.setHours(lateHours, lateMinutes, 0, 0);

                    if (logDate > shiftStartTime) {
                        if (!lateLogsByEmployee[log.employeeDocId]) {
                            lateLogsByEmployee[log.employeeDocId] = [];
                        }
                        lateLogsByEmployee[log.employeeDocId].push({ date: logDate });
                    }
                });
                
                let periodStartDate: Date;
                switch (period) {
                    case 'This Week':
                        periodStartDate = startOfWeek;
                        break;
                    case 'This Month':
                        periodStartDate = startOfMonth;
                        break;
                    case 'Today':
                    default:
                        periodStartDate = new Date();
                        periodStartDate.setHours(0, 0, 0, 0);
                        break;
                }

                const finalRecords: LateRecord[] = Object.keys(lateLogsByEmployee)
                    .map(employeeId => {
                        const employee = employeeMap[employeeId];
                        if (!employee) return null;

                        const allLateEntries = lateLogsByEmployee[employeeId];
                        const entriesInPeriod = allLateEntries.filter(entry => entry.date >= periodStartDate);
                        
                        if (entriesInPeriod.length === 0) return null;

                        const entriesInWeek = allLateEntries.filter(entry => entry.date >= startOfWeek);

                        return {
                            employeeId,
                            name: `${employee.firstName} ${employee.surname}`,
                            position: employee.position,
                            avatarUrl: employee.avatarUrl,
                            lateEntries: entriesInPeriod.sort((a, b) => b.date.getTime() - a.date.getTime()),
                            frequency: {
                                month: allLateEntries.length,
                                week: entriesInWeek.length,
                            },
                        };
                    })
                    .filter((record): record is LateRecord => record !== null)
                    .sort((a,b) => b.lateEntries.length - a.lateEntries.length);
                
                setLateRecords(finalRecords);

            } catch (error) {
                console.error("Error fetching late arrivals:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLateArrivals();

    }, [period, employees, settings, employeeMap]);

    return (
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">Late Arrivals</h3>
                <div className="flex items-center gap-2">
                    {(['Today', 'This Week', 'This Month'] as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1 text-xs rounded-md transition-colors ${period === p ? 'bg-yellow-400 text-gray-900 font-semibold' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-grow overflow-y-auto pr-2 -mr-2" style={{maxHeight: '400px'}}>
                {isLoading ? (
                    <div className="flex justify-center items-center h-full"><Spinner /></div>
                ) : lateRecords.length === 0 ? (
                    <div className="flex justify-center items-center h-full text-gray-500">
                        No late arrivals for this period.
                    </div>
                ) : (
                    <ul className="space-y-3">
                        {lateRecords.map(record => (
                            <li key={record.employeeId} className="bg-gray-800/50 p-3 rounded-lg">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <img className="w-10 h-10 rounded-full object-cover bg-gray-700" src={record.avatarUrl || `https://api.dicebear.com/8.x/initials/svg?seed=${record.name}`} alt={record.name} />
                                        <div>
                                            <p className="text-white font-medium">{record.name}</p>
                                            <p className="text-gray-400 text-sm">{record.position}</p>
                                        </div>
                                    </div>
                                    <div className="text-right text-sm">
                                        <p className="text-gray-300">
                                            <span className="font-semibold text-white">{record.frequency.week}</span> this week
                                        </p>
                                        <p className="text-gray-300">
                                             <span className="font-semibold text-white">{record.frequency.month}</span> this month
                                        </p>
                                    </div>
                                </div>
                                {record.lateEntries.length > 0 && (
                                     <div className="mt-2 pl-13 border-l-2 border-gray-700 ml-5 pt-2 pb-1">
                                        <ul className="text-xs text-gray-400 space-y-1 pl-4">
                                            {record.lateEntries.map((entry, index) => (
                                               <li key={index} className="flex items-center gap-2">
                                                    <span className="text-gray-500">-</span>
                                                    {entry.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                    {' at '}
                                                    <span className="font-semibold text-red-400">
                                                        {entry.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                               </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default LateArrivals;