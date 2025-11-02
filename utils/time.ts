
export const formatTime = (date: Date): string => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const formatDate = (date: Date): string => {
    return date.toLocaleDateString();
};

export const calculateDuration = (start: Date, end: Date): string => {
    const diffMs = end.getTime() - start.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
};

export const getShiftTimers = (shiftStartStr: string, shiftEndStr: string, loginTime: Date): { shiftTimer: string, overtimeTimer: string, isOvertime: boolean } => {
    const now = new Date();
    
    const [startHours, startMinutes] = shiftStartStr.split(':').map(Number);
    const shiftStart = new Date(loginTime);
    shiftStart.setHours(startHours, startMinutes, 0, 0);

    const [endHours, endMinutes] = shiftEndStr.split(':').map(Number);
    const shiftEnd = new Date(loginTime);
    shiftEnd.setHours(endHours, endMinutes, 0, 0);
    
    // If shift ends next day
    if(shiftEnd < shiftStart) {
        shiftEnd.setDate(shiftEnd.getDate() + 1);
    }

    let shiftTimer = '00h 00m 00s';
    let overtimeTimer = '00h 00m 00s';
    let isOvertime = false;

    if (now < shiftEnd) {
        shiftTimer = calculateDuration(now, shiftEnd);
    } else {
        isOvertime = true;
        overtimeTimer = calculateDuration(shiftEnd, now);
    }
    
    return { shiftTimer, overtimeTimer, isOvertime };
};

export const parseTimeString = (timeStr: string, date: Date = new Date()): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const newDate = new Date(date);
    newDate.setHours(hours, minutes, 0, 0);
    return newDate;
};
