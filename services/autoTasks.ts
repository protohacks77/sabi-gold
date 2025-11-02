import { db } from './firebase';
import { collection, query, where, getDocs, writeBatch, Timestamp, addDoc, doc } from 'firebase/firestore';
import type { Employee, AttendanceLog } from '../types';

const LAST_TASK_RUN_KEY = 'lastAutoTaskRunDate';

export const runDailyTasks = async () => {
    const lastRun = localStorage.getItem(LAST_TASK_RUN_KEY);
    const today = new Date().toISOString().split('T')[0];

    // Run tasks only once per day
    if (lastRun === today) {
        return;
    }

    console.log("Running daily automated tasks...");

    try {
        await handleMissedLogouts();
        await createDailyReportNotification();
        localStorage.setItem(LAST_TASK_RUN_KEY, today);
        console.log("Daily tasks completed successfully.");
    } catch (error) {
        console.error("Error running daily tasks:", error);
    }
};

const handleMissedLogouts = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(collection(db, 'employees'), where('status', '==', 'Logged In'));
    const snapshot = await getDocs(q);

    const employeesToLogOut = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Employee))
        .filter(emp => emp.lastLoginTime && emp.lastLoginTime.toDate() < today);

    if (employeesToLogOut.length === 0) {
        return;
    }

    const batch = writeBatch(db);

    for (const emp of employeesToLogOut) {
        const empRef = doc(db, 'employees', emp.id);
        batch.update(empRef, { status: 'Logged Out' });

        const endOfShiftYesterday = new Date(emp.lastLoginTime!.toDate());
        // For simplicity, we'll log them out at midnight. 
        // A more complex system might use the shift end time.
        endOfShiftYesterday.setHours(23, 59, 59, 999);

        // Create the automatic clock-out record
        const attendanceRef = doc(collection(db, 'attendance'));
        batch.set(attendanceRef, {
            employeeDocId: emp.id,
            timestamp: Timestamp.fromDate(endOfShiftYesterday),
            type: 'out',
            notes: 'auto clock-out',
            employeeName: `${emp.firstName} ${emp.surname}`,
            employeePosition: emp.position,
        } as AttendanceLog);

        // Create a notification for the admin
        const notificationRef = doc(collection(db, 'notifications'));
        batch.set(notificationRef, {
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.surname}`,
            timestamp: Timestamp.now(),
            type: 'missed-logout',
            message: `was automatically clocked out for yesterday due to a missed logout.`,
            read: false,
        });
    }

    await batch.commit();
    console.log(`Automatically logged out ${employeesToLogOut.length} employee(s).`);
};

const createDailyReportNotification = async () => {
    // This function simply creates a notification. 
    // The actual report generation happens when the admin clicks the button.
    const notificationRef = doc(collection(db, 'notifications'));
    await addDoc(collection(db, 'notifications'), {
        employeeId: 'SYSTEM',
        employeeName: 'System',
        timestamp: Timestamp.now(),
        type: 'daily-report-ready',
        message: "Yesterday's attendance report is ready to print.",
        read: false,
    });
    console.log("Daily report notification created.");
};
