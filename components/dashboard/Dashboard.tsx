import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import { collection, onSnapshot, query, where, getDocs, orderBy, limit, Timestamp, doc, getDoc } from 'firebase/firestore';
import type { Employee, Leave, AttendanceLog, Settings } from '../../types';
import { parseTimeString } from '../../utils/time';
import { Icons } from '../common/Icons';
import StatModal from './StatModal';
import AreaChart from '../common/AreaChart';
import LateArrivals from './LateArrivals';

type StatModalView = 'total' | 'on-site' | 'on-leave' | 'absent';

const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; onClick: () => void; }> = ({ title, value, icon, onClick }) => (
    <button onClick={onClick} className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 flex items-start justify-between text-left hover:border-yellow-400 transition-colors w-full">
        <div>
            <p className="text-gray-400 font-medium">{title}</p>
            <p className="text-3xl font-bold text-white mt-1">{value}</p>
        </div>
        <div className="bg-gray-800 p-3 rounded-lg text-yellow-400">
            {icon}
        </div>
    </button>
);

const DoughnutChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    const total = data.reduce((acc, item) => acc + item.value, 0);
    if (total === 0) {
        return <div className="flex items-center justify-center h-full text-gray-500">No data available</div>;
    }
    let cumulative = 0;
    return (
        <div className="flex items-center gap-6">
            <div className="relative w-32 h-32">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                    {data.map(item => {
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
            <div className="flex flex-col gap-2">
                {data.map(item => (
                    <div key={item.label} className="flex items-center gap-2 text-sm">
                        <div className={`w-3 h-3 rounded-full ${item.color.replace('stroke', 'bg')}`}></div>
                        <span className="text-gray-300">{item.label}:</span>
                        <span className="font-semibold text-white">{item.value}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const Dashboard: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [leaves, setLeaves] = useState<Leave[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [liveFeed, setLiveFeed] = useState<AttendanceLog[]>([]);
    const [weeklyAttendance, setWeeklyAttendance] = useState<{ label: string; value: number }[]>([]);
    const [weeklyOvertime, setWeeklyOvertime] = useState<{ label: string; value: number }[]>([]);
    const [monthlyLeave, setMonthlyLeave] = useState<{ label: string; value: number; color: string }[]>([]);
    const [modalView, setModalView] = useState<StatModalView | null>(null);

    const employeeMap = useMemo(() => 
        employees.reduce((acc, emp) => {
            acc[emp.id] = emp;
            return acc;
        }, {} as Record<string, Employee>), 
    [employees]);

    const stats = useMemo(() => {
        const today = new Date();
        const onLeaveTodayIds = new Set(leaves
            .filter(l => {
                const start = l.startDate.toDate();
                const end = l.endDate.toDate();
                start.setHours(0,0,0,0);
                end.setHours(23,59,59,999);
                return today >= start && today <= end;
            })
            .map(l => l.employeeDocId)
        );
        const onDuty = employees.filter(e => e.status === 'Logged In').length;
        const total = employees.length;
        const onLeave = onLeaveTodayIds.size;
        const absent = total - onDuty - onLeave;

        return { total, onDuty, onLeave, absent };
    }, [employees, leaves]);

    useEffect(() => {
        const unsubEmployees = onSnapshot(query(collection(db, 'employees'), orderBy('firstName')), snapshot => 
            setEmployees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee)))
        );
        const unsubLeaves = onSnapshot(query(collection(db, 'leave'), orderBy('startDate', 'desc')), snapshot => 
            setLeaves(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leave)))
        );
        const unsubFeed = onSnapshot(query(collection(db, 'attendance'), orderBy('timestamp', 'desc'), limit(5)), snapshot => 
            setLiveFeed(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceLog)))
        );

        const fetchSettings = async () => {
             const settingsDoc = await getDoc(doc(db, 'app-settings', 'main'));
             if (settingsDoc.exists()) setSettings(settingsDoc.data() as Settings);
        };
        fetchSettings();

        const fetchChartData = async () => {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            sevenDaysAgo.setHours(0,0,0,0);
            
            const attendanceQuery = query(collection(db, 'attendance'), where('timestamp', '>=', sevenDaysAgo));
            const attendanceSnapshot = await getDocs(attendanceQuery);
            const logs = attendanceSnapshot.docs.map(d => d.data() as AttendanceLog);
            
            const settingsDoc = await getDoc(doc(db, 'app-settings', 'main'));
            const appSettings = settingsDoc.data() as Settings;
            
            const labels: string[] = [];
            const dailyAttendance: Record<string, Set<string>> = {};
            const dailyOvertime: Record<string, number> = {};
            
            for(let i=6; i>=0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
                dailyAttendance[dateStr] = new Set();
                dailyOvertime[dateStr] = 0;
            }

            const dailyWork: Record<string, Record<string, { in?: Date, out?: Date }>> = {}; // { [dateStr]: { [empId]: {in, out} } }

            logs.forEach(log => {
                const dateStr = log.timestamp.toDate().toISOString().split('T')[0];
                if (!dailyWork[dateStr]) dailyWork[dateStr] = {};
                if (!dailyWork[dateStr][log.employeeDocId]) dailyWork[dateStr][log.employeeDocId] = {};
                if (log.type === 'in') dailyWork[dateStr][log.employeeDocId].in = log.timestamp.toDate();
                else dailyWork[dateStr][log.employeeDocId].out = log.timestamp.toDate();
            });

            Object.entries(dailyWork).forEach(([dateStr, employees]) => {
                Object.values(employees).forEach(({ in: inTime, out: outTime }) => {
                    if (inTime && outTime) {
                        dailyAttendance[dateStr]?.add(outTime.toISOString()); // Just need a unique value
                        if(appSettings?.shiftEnd) {
                            const shiftEndToday = parseTimeString(appSettings.shiftEnd, inTime);
                            if (outTime > shiftEndToday) {
                                dailyOvertime[dateStr] += (outTime.getTime() - shiftEndToday.getTime()) / (1000 * 60 * 60);
                            }
                        }
                    }
                });
            });

            const attData = Object.keys(dailyAttendance).sort().map((dateStr, i) => ({ label: labels[i], value: dailyAttendance[dateStr].size }));
            const otData = Object.keys(dailyOvertime).sort().map((dateStr, i) => ({ label: labels[i], value: Math.round(dailyOvertime[dateStr])}));
            setWeeklyAttendance(attData);
            setWeeklyOvertime(otData);

            // Leave data for this month
            const now = new Date();
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const leaveQuery = query(collection(db, 'leave'), where('startDate', '>=', firstDayOfMonth));
            const leaveSnapshot = await getDocs(leaveQuery);
            const leaveCounts = { Sick: 0, Vacation: 0, Unpaid: 0 };
            leaveSnapshot.docs.forEach(d => {
                const leave = d.data() as Leave;
                if (leaveCounts[leave.type] !== undefined) leaveCounts[leave.type]++;
            });
            setMonthlyLeave([
                { label: 'Sick', value: leaveCounts.Sick, color: 'stroke-blue-400' },
                { label: 'Vacation', value: leaveCounts.Vacation, color: 'stroke-green-400' },
                { label: 'Unpaid', value: leaveCounts.Unpaid, color: 'stroke-gray-400' },
            ]);
        };
        fetchChartData();

        return () => { unsubEmployees(); unsubLeaves(); unsubFeed(); };
    }, []);

    const openModal = (view: StatModalView) => setModalView(view);

    return (
        <>
            {modalView && <StatModal view={modalView} onClose={() => setModalView(null)} employees={employees} leaves={leaves} settings={settings} weeklyAttendance={weeklyAttendance} />}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    <StatCard title="Total Employees" value={stats.total.toString()} icon={<Icons.Users />} onClick={() => openModal('total')} />
                    <StatCard title="Currently On-Site" value={stats.onDuty.toString()} icon={<Icons.Workforce />} onClick={() => openModal('on-site')} />
                    <StatCard title="On Leave Today" value={stats.onLeave.toString()} icon={<Icons.Leave />} onClick={() => openModal('on-leave')} />
                    <StatCard title="Absent Today" value={stats.absent.toString()} icon={<Icons.Reports />} onClick={() => openModal('absent')} />
                </div>
                
                <div className="lg:col-span-3">
                    <LateArrivals employees={employees} settings={settings} />
                </div>

                <div className="lg:col-span-2 bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Weekly Attendance Overview</h3>
                    <div className="h-64">
                        <AreaChart 
                            labels={weeklyAttendance.map(d => d.label)} 
                            data={weeklyAttendance.map(d => d.value)} 
                            gradientColors={['rgba(251, 191, 36, 0.6)', 'rgba(31, 41, 55, 0.1)']} 
                            lineColor="#FBBF24" 
                        />
                    </div>
                </div>

                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Live Activity Feed</h3>
                    <ul className="space-y-4">
                        {liveFeed.map(log => (
                            <li key={log.id} className="flex items-center gap-4">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center ${log.type === 'in' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                   {log.type === 'in' ? <Icons.CheckCircle className="w-6 h-6"/> : <Icons.Logout className="w-6 h-6"/>}
                               </div>
                               <div>
                                   <p className="font-semibold text-white">{log.employeeName || (employeeMap[log.employeeDocId] ? `${employeeMap[log.employeeDocId].firstName} ${employeeMap[log.employeeDocId].surname}` : 'Unknown')}</p>
                                   <p className="text-sm text-gray-400">
                                       Clocked {log.type} at {log.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                   </p>
                               </div>
                            </li>
                        ))}
                    </ul>
                </div>
                
                <div className="lg:col-span-2 bg-gray-900/50 border border-gray-700 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Daily Overtime (Last 7 Days) (Hours)</h3>
                    <div className="h-64">
                        <AreaChart 
                            labels={weeklyOvertime.map(d => d.label)} 
                            data={weeklyOvertime.map(d => d.value)} 
                            gradientColors={['rgba(129, 140, 248, 0.6)', 'rgba(31, 41, 55, 0.1)']} 
                            lineColor="#818CF8" 
                        />
                    </div>
                </div>
                
                <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6 flex flex-col">
                    <h3 className="text-lg font-semibold text-white mb-4">Leave Breakdown (This Month)</h3>
                    <div className="flex-grow flex items-center justify-center">
                        <DoughnutChart data={monthlyLeave} />
                    </div>
                </div>
            </div>
        </>
    );
};

export default Dashboard;