import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import type { Employee, Settings, AttendanceLog, Leave } from '../../types';
import { parseTimeString } from '../../utils/time';
import Spinner from '../common/Spinner';
import Modal from '../common/Modal';
import { Icons } from '../common/Icons';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';


type ReportType = 'payroll' | 'onLeave' | 'late' | 'absent';

const imageToBase64 = (url: string): Promise<string | ArrayBuffer | null> => fetch(url)
  .then(response => response.blob())
  .then(blob => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  }));

const PrintableReport: React.FC<{
    reportData: any[];
    headers: { key: string, label: string }[];
    title: string;
    dateRange: string;
}> = ({ reportData, headers, title, dateRange }) => (
    <div className="p-8 bg-white text-black font-sans w-[1024px]">
        <div className="flex items-center justify-between mb-8 border-b pb-4 border-gray-300">
            <div className="flex items-center gap-4">
                <img src="https://i.ibb.co/B5S33T4M/sabi-logo.png" alt="Sabi Gold Mine" className="w-16 h-16" />
                <h1 className="text-2xl font-bold">Sabi Gold Mine</h1>
            </div>
            <div className="text-right">
                <h2 className="text-3xl font-bold text-gray-800">{title}</h2>
                <p className="text-gray-600">{dateRange}</p>
            </div>
        </div>
        <table className="w-full text-left border-collapse text-sm">
            <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                    {headers.map(h => <th key={h.key} className="p-2 font-bold uppercase text-gray-600">{h.label}</th>)}
                </tr>
            </thead>
            <tbody>
                {reportData.map((row, index) => (
                    <tr key={index} className="border-b border-gray-200">
                        {headers.map(header => (
                            <td key={header.key} className="p-2">{row[header.key]}</td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
        <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t border-gray-300">
            <p>© {new Date().getFullYear()} Sabi Gold Mine. All rights reserved.</p>
        </div>
    </div>
);

const Reports: React.FC = () => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isExportModalOpen, setIsExportModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<ReportType>('payroll');
    const [showPrintable, setShowPrintable] = useState(false);

    const employeeMap = useMemo(() => 
        employees.reduce((acc, emp) => {
            acc[emp.id] = emp;
            return acc;
        }, {} as Record<string, Employee>), 
    [employees]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const empSnapshot = await getDocs(query(collection(db, 'employees')));
                setEmployees(
                    empSnapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() } as Employee))
                        .sort((a, b) => a.firstName.localeCompare(b.firstName))
                );

                const settingsSnapshot = await getDocs(collection(db, 'app-settings'));
                if (!settingsSnapshot.empty) {
                    setSettings(settingsSnapshot.docs[0].data() as Settings);
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        };
        fetchData();
    }, []);

    const generateReport = async () => {
        if (!startDate || !endDate || !settings) {
            alert("Please select a date range and ensure settings are configured.");
            return;
        }
        setIsLoading(true);
        setReportData([]);

        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        try {
            switch (activeTab) {
                case 'payroll': await generatePayrollReport(start, end, settings); break;
                case 'onLeave': await generateOnLeaveReport(start, end); break;
                case 'late': await generateLateArrivalsReport(start, end, settings); break;
                case 'absent': await generateAbsenceReport(start, end); break;
            }
        } catch (error) {
            console.error(`Error generating ${activeTab} report:`, error);
        } finally {
            setIsLoading(false);
        }
    };
    
    // --- REPORT GENERATION LOGIC ---

    const generatePayrollReport = async (start: Date, end: Date, settings: Settings) => {
        const attendanceQuery = query(collection(db, 'attendance'), where('timestamp', '>=', start), where('timestamp', '<=', end));
        const logsSnapshot = await getDocs(attendanceQuery);
        const logs = logsSnapshot.docs.map(doc => doc.data() as AttendanceLog);

        const report = employees.map(emp => {
            const empLogs = logs.filter(l => l.employeeDocId === emp.id).sort((a,b) => a.timestamp.toMillis() - b.timestamp.toMillis());
            const dailyWork: Record<string, { in?: Date, out?: Date }> = {};
            empLogs.forEach(log => {
                const dateStr = log.timestamp.toDate().toLocaleDateString();
                if (!dailyWork[dateStr]) dailyWork[dateStr] = {};
                if (log.type === 'in' && !dailyWork[dateStr].in) dailyWork[dateStr].in = log.timestamp.toDate();
                else if (log.type === 'out') dailyWork[dateStr].out = log.timestamp.toDate();
            });

            let totalDaysWorked = 0, totalOvertimeHours = 0;
            Object.values(dailyWork).forEach(({ in: inTime, out: outTime }) => {
                if (inTime && outTime) {
                    totalDaysWorked++;
                    const shiftEndToday = parseTimeString(settings.shiftEnd, inTime);
                    if (outTime > shiftEndToday) {
                        totalOvertimeHours += (outTime.getTime() - shiftEndToday.getTime()) / (1000 * 60 * 60);
                    }
                }
            });
            return {
                employeeName: `${emp.firstName} ${emp.surname}`,
                totalDaysWorked,
                totalOvertimeHours: parseFloat(totalOvertimeHours.toFixed(2)),
                basePay: parseFloat((totalDaysWorked * settings.dailyRate).toFixed(2)),
                overtimePay: parseFloat((totalOvertimeHours * settings.overtimeRate).toFixed(2)),
                totalGrossPay: parseFloat(((totalDaysWorked * settings.dailyRate) + (totalOvertimeHours * settings.overtimeRate)).toFixed(2))
            };
        });
        setReportData(report.filter(r => r.totalDaysWorked > 0));
    };

    const generateOnLeaveReport = async (start: Date, end: Date) => {
        const leaveQuery = query(collection(db, 'leave'), where('startDate', '<=', end));
        const snapshot = await getDocs(leaveQuery);
        const leaves = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as Leave }));

        const report = leaves.filter(l => l.endDate.toDate() >= start).map(l => {
            const emp = employeeMap[l.employeeDocId];
            return {
                employeeName: emp ? `${emp.firstName} ${emp.surname}` : 'Unknown',
                department: emp?.department || '-',
                leaveType: l.type,
                startDate: l.startDate.toDate().toLocaleDateString(),
                endDate: l.endDate.toDate().toLocaleDateString(),
                duration: Math.round((l.endDate.toMillis() - l.startDate.toMillis()) / (1000 * 3600 * 24)) + 1 + ' days',
            }
        });
        setReportData(report);
    };

    const generateLateArrivalsReport = async (start: Date, end: Date, settings: Settings) => {
        const attendanceQuery = query(collection(db, 'attendance'), where('timestamp', '>=', start), where('timestamp', '<=', end));
        const snapshot = await getDocs(attendanceQuery);
        const logs = snapshot.docs.map(doc => doc.data() as AttendanceLog).filter(log => log.type === 'in');
        
        const [lateHours, lateMinutes] = settings.shiftStart.split(':').map(Number);
        const report = logs.map(log => {
            const logDate = log.timestamp.toDate();
            const shiftStartTime = new Date(logDate);
            shiftStartTime.setHours(lateHours, lateMinutes, 0, 0);

            if (logDate > shiftStartTime) {
                const emp = employeeMap[log.employeeDocId];
                const lateMs = logDate.getTime() - shiftStartTime.getTime();
                return {
                    employeeName: emp ? `${emp.firstName} ${emp.surname}` : 'Unknown',
                    department: emp?.department || '-',
                    date: logDate.toLocaleDateString(),
                    arrivalTime: logDate.toLocaleTimeString(),
                    shiftStart: settings.shiftStart,
                    lateBy: `${Math.floor(lateMs / 60000)} mins`
                };
            }
            return null;
        }).filter((r): r is NonNullable<typeof r> => r !== null);
        setReportData(report);
    };

    const generateAbsenceReport = async (start: Date, end: Date) => {
        const attendanceQuery = query(collection(db, 'attendance'), where('timestamp', '>=', start), where('timestamp', '<=', end));
        const leaveQuery = query(collection(db, 'leave'), where('startDate', '<=', end));
        
        const [attSnapshot, leaveSnapshot] = await Promise.all([getDocs(attendanceQuery), getDocs(leaveQuery)]);

        const clockedInByDate: Record<string, Set<string>> = {};
        attSnapshot.docs.forEach(doc => {
            const log = doc.data() as AttendanceLog;
            if (log.type === 'in') {
                const dateStr = log.timestamp.toDate().toISOString().split('T')[0];
                if (!clockedInByDate[dateStr]) clockedInByDate[dateStr] = new Set();
                clockedInByDate[dateStr].add(log.employeeDocId);
            }
        });

        const onLeaveByDate: Record<string, Set<string>> = {};
        leaveSnapshot.docs.map(doc => doc.data() as Leave)
            .filter(l => l.endDate.toDate() >= start)
            .forEach(l => {
                for (let d = l.startDate.toDate(); d <= l.endDate.toDate(); d.setDate(d.getDate() + 1)) {
                    if(d < start || d > end) continue;
                    const dateStr = d.toISOString().split('T')[0];
                    if (!onLeaveByDate[dateStr]) onLeaveByDate[dateStr] = new Set();
                    onLeaveByDate[dateStr].add(l.employeeDocId);
                }
            });

        const report: any[] = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) continue; // Skip weekends
            const dateStr = d.toISOString().split('T')[0];
            
            const onLeave = onLeaveByDate[dateStr] || new Set();
            const clockedIn = clockedInByDate[dateStr] || new Set();

            employees.forEach(emp => {
                if (!onLeave.has(emp.id) && !clockedIn.has(emp.id)) {
                    report.push({
                        employeeName: `${emp.firstName} ${emp.surname}`,
                        department: emp.department || '-',
                        dateOfAbsence: new Date(d).toLocaleDateString()
                    });
                }
            });
        }
        setReportData(report);
    };

    // --- END REPORT LOGIC ---

    const setDateRange = (period: 'this-week' | 'this-month' | 'last-month') => {
        const now = new Date();
        let start, end;

        switch (period) {
            case 'this-week':
                const first = now.getDate() - now.getDay() + 1;
                start = new Date(now.setDate(first));
                end = new Date();
                break;
            case 'last-month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
                break;
            case 'this-month':
            default:
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                break;
        }
        setStartDate(start.toISOString().split('T')[0]);
        setEndDate(end.toISOString().split('T')[0]);
    };
    
    const handleExport = async (format: 'pdf' | 'csv' | 'word' | 'png') => {
        if (reportData.length === 0) return;
        setIsExporting(true);

        const headers = reportHeaders[activeTab];
        const title = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report`;
        const dateRange = `From: ${startDate} To: ${endDate}`;
        const fileName = `SGM_${activeTab}_report_${startDate}_to_${endDate}`;

        if (format === 'pdf') {
            try {
                const logoBase64 = await imageToBase64('https://i.ibb.co/B5S33T4M/sabi-logo.png');
                const doc = new jsPDF();
                
                const addHeaderFooter = (didDrawPage?: boolean) => {
                  const pageCount = doc.internal.pages.length - 1;
                  for (let i = 1; i <= pageCount; i++) {
                      doc.setPage(i);
                      if (i === 1) { // Header on first page
                        doc.addImage(logoBase64 as string, 'PNG', 15, 10, 20, 20);
                        doc.setFontSize(18);
                        doc.text('Sabi Gold Mine', 40, 22);
                        doc.setFontSize(12);
                        doc.text(title, 14, 40);
                        doc.setFontSize(10);
                        doc.text(dateRange, 14, 45);
                      }
                      // Footer on all pages
                      doc.setFontSize(8);
                      doc.text(`© ${new Date().getFullYear()} Sabi Gold Mine. All rights reserved.`, doc.internal.pageSize.getWidth() / 2, 287, { align: 'center' });
                      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() - 20, 287);
                  }
                };

                autoTable(doc, {
                    head: [headers.map(h => h.label)],
                    body: reportData.map(row => headers.map(h => row[h.key])),
                    startY: 50,
                    didDrawPage: (data) => addHeaderFooter(true),
                });
                addHeaderFooter(); // Call once more for single-page docs
                doc.save(`${fileName}.pdf`);
            } catch (error) {
                console.error("Error creating PDF:", error);
            }
        } else if (format === 'csv') {
            const csvRows = [headers.map(h => h.label).join(',')];
            reportData.forEach(row => csvRows.push(headers.map(h => `"${row[h.key]}"`).join(',')));
            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${fileName}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } else if (format === 'word') {
             const headerHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 2rem; border-bottom: 1px solid #ddd; padding-bottom: 1rem;"><div style="display: flex; align-items: center;"><img src="https://i.ibb.co/B5S33T4M/sabi-logo.png" width="60" /><h1 style="margin:0; margin-left: 10px; font-family: sans-serif;">Sabi Gold Mine</h1></div><div style="text-align:right; font-family: sans-serif;"><h2 style="margin:0;">${title}</h2><p style="margin:0; color: #555;">${dateRange}</p></div></div>`;
             const tableHtml = `<table border="1" style="border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 12px;"><thead><tr style="background-color: #f2f2f2;">${headers.map(h => `<th style="padding: 8px;">${h.label}</th>`).join('')}</tr></thead><tbody>${reportData.map(row => `<tr>${headers.map(h => `<td style="padding: 8px;">${row[h.key]}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
             const footerHtml = `<div style="text-align:center; font-size:10px; margin-top:2rem; padding-top: 1rem; border-top: 1px solid #ddd; font-family: sans-serif; color: #777;"><p>© ${new Date().getFullYear()} Sabi Gold Mine. All rights reserved.</p></div>`;
             const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>${title}</title></head><body>${headerHtml}${tableHtml}${footerHtml}</body></html>`;
             const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
             const url = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(html);
             const link = document.createElement('a');
             link.href = url;
             link.download = `${fileName}.doc`;
             link.click();
        } else if (format === 'png') {
            setShowPrintable(true);
            setTimeout(async () => {
                const reportElement = document.getElementById('printable-report-container');
                if (reportElement) {
                    try {
                        const canvas = await html2canvas(reportElement);
                        const image = canvas.toDataURL('image/png');
                        const link = document.createElement('a');
                        link.href = image;
                        link.download = `${fileName}.png`;
                        link.click();
                    } catch (error) {
                        console.error("Error creating PNG:", error);
                    } finally {
                        setShowPrintable(false);
                    }
                }
            }, 100);
        }

        if (format !== 'png') { // PNG handles its own loading state
             setIsExporting(false);
             setIsExportModalOpen(false);
        }
    };
    
    const ExportButton: React.FC<{ onClick: () => void; icon: React.ReactNode; label: string; }> = ({ onClick, icon, label }) => (
        <button onClick={onClick} disabled={isExporting} className="flex flex-col items-center justify-center p-4 bg-gray-700 border border-gray-600 rounded-lg hover:border-yellow-400 transition-colors disabled:opacity-50">
            {icon}
            <span className="mt-2 font-semibold text-sm">{label}</span>
        </button>
    );

    const reportHeaders: Record<ReportType, { key: string, label: string }[]> = {
        payroll: [
            { key: 'employeeName', label: 'Employee' }, { key: 'totalDaysWorked', label: 'Days Worked' },
            { key: 'totalOvertimeHours', label: 'Overtime (Hrs)' }, { key: 'basePay', label: 'Base Pay ($)' },
            { key: 'overtimePay', label: 'Overtime Pay ($)' }, { key: 'totalGrossPay', label: 'Gross Pay ($)' }
        ],
        onLeave: [
            { key: 'employeeName', label: 'Employee' }, { key: 'department', label: 'Department' },
            { key: 'leaveType', label: 'Leave Type' }, { key: 'startDate', label: 'Start Date' },
            { key: 'endDate', label: 'End Date' }, { key: 'duration', label: 'Duration' }
        ],
        late: [
            { key: 'employeeName', label: 'Employee' }, { key: 'department', label: 'Department' },
            { key: 'date', label: 'Date' }, { key: 'arrivalTime', label: 'Arrival Time' },
            { key: 'shiftStart', label: 'Shift Start' }, { key: 'lateBy', label: 'Late By' }
        ],
        absent: [
            { key: 'employeeName', label: 'Employee' }, { key: 'department', label: 'Department' },
            { key: 'dateOfAbsence', label: 'Date of Absence' }
        ]
    };
    
    const TabButton: React.FC<{ type: ReportType, label: string }> = ({ type, label }) => (
        <button 
            onClick={() => { setActiveTab(type); setReportData([]); }}
            className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${activeTab === type ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
        >{label}</button>
    );

    const inputClasses = "w-full p-2 bg-gray-800 rounded-lg border border-gray-600 focus:ring-2 focus:ring-yellow-400";
    const labelClasses = "block text-sm font-medium text-gray-400 mb-1";

    return (
        <div className="bg-gray-900/50 p-6 rounded-xl border border-gray-700 space-y-6 relative">
            {isExporting && showPrintable && (
                <div id="printable-report-container" className="absolute -left-[9999px] top-0">
                    <PrintableReport 
                        reportData={reportData}
                        headers={reportHeaders[activeTab]}
                        title={`${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Report`}
                        dateRange={`From: ${startDate} To: ${endDate}`}
                    />
                </div>
            )}
            <div className="flex border-b border-gray-700">
                <TabButton type="payroll" label="Payroll" />
                <TabButton type="onLeave" label="On Leave" />
                <TabButton type="late" label="Late Arrivals" />
                <TabButton type="absent" label="Absences" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div>
                    <label className={labelClasses}>Start Date</label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClasses}/>
                </div>
                <div>
                    <label className={labelClasses}>End Date</label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputClasses}/>
                </div>
                <button onClick={generateReport} className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold rounded-lg h-10 flex items-center justify-center disabled:opacity-50" disabled={isLoading}>
                    {isLoading ? <Spinner /> : 'Generate Report'}
                </button>
            </div>
            <div className="flex items-center gap-2">
                <button onClick={() => setDateRange('this-week')} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300">This Week</button>
                <button onClick={() => setDateRange('this-month')} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300">This Month</button>
                <button onClick={() => setDateRange('last-month')} className="px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300">Last Month</button>
            </div>

            {reportData.length > 0 && (
                <div className="overflow-x-auto">
                     <div className="flex justify-between items-center pb-4">
                        <h3 className="text-lg font-semibold text-white">Report Results</h3>
                        <button onClick={() => setIsExportModalOpen(true)} className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 font-semibold rounded-lg h-10 flex items-center justify-center text-sm gap-2">
                            <span>Export Report</span>
                        </button>
                    </div>
                    <table className="min-w-full">
                        <thead className="border-b border-gray-700"><tr>
                            {reportHeaders[activeTab].map(h => 
                                <th key={h.key} className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">{h.label}</th>)}
                        </tr></thead>
                        <tbody>{reportData.map((row, index) => (
                            <tr key={index} className="hover:bg-gray-800/50 border-b border-gray-700 last:border-b-0">
                                {reportHeaders[activeTab].map(header => (
                                    <td key={header.key} className={`py-4 px-4 whitespace-nowrap text-gray-300 ${header.key === 'totalGrossPay' ? 'font-bold text-yellow-400' : ''}`}>
                                        {row[header.key]}
                                    </td>
                                ))}
                            </tr>))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal isOpen={isExportModalOpen} onClose={() => setIsExportModalOpen(false)} title="Export Report">
                 {isExporting ? (
                    <div className="flex flex-col items-center justify-center p-8">
                        <Spinner />
                        <p className="mt-4 text-gray-300">Generating your report...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ExportButton onClick={() => handleExport('pdf')} icon={<Icons.Reports />} label="PDF" />
                        <ExportButton onClick={() => handleExport('csv')} icon={<Icons.CSV />} label="CSV" />
                        <ExportButton onClick={() => handleExport('word')} icon={<Icons.Word />} label="Word" />
                        <ExportButton onClick={() => handleExport('png')} icon={<Icons.PNG />} label="PNG" />
                    </div>
                )}
            </Modal>
        </div>
    );
};

export default Reports;