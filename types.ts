import { Timestamp } from 'firebase/firestore';

export type EmployeeStatus = 'Logged In' | 'Logged Out' | 'On Leave';

export interface Employee {
  id: string;
  firstName: string;
  surname: string;
  position: string;
  employeeId: string;
  status: EmployeeStatus;
  lastLoginTime?: Timestamp;
  isFaceRegistered?: boolean;
  avatarUrl?: string;
  department?: string;
  faceData?: {
    descriptor: number[];
  };
  // Fields for WebAuthn Fingerprint
  biometricCredentialId?: string;
  biometricPublicKey?: string;
  pin?: string;
}

export interface AttendanceLog {
  id?: string;
  employeeDocId: string;
  timestamp: Timestamp;
  type: 'in' | 'out';
  employeeName?: string; // Denormalized for live feed
  employeePosition?: string; // Denormalized for live feed
}

export interface Leave {
  id?: string;
  employeeDocId: string;
  startDate: Timestamp;
  endDate: Timestamp;
  type: 'Sick' | 'Vacation' | 'Unpaid';
  deleted?: boolean;
  updatedAt?: Timestamp;
}

export interface LeaveRequest {
  id?: string;
  employeeDocId: string;
  employeeName: string; // Denormalized for admin view
  startDate: Timestamp;
  endDate: Timestamp;
  type: 'Sick' | 'Vacation' | 'Unpaid';
  status: 'pending' | 'approved' | 'denied';
  reason?: string;
  isExtension?: boolean;
  originalLeaveId?: string;
}

export interface Settings {
  shiftStart: string; // "HH:mm" format
  shiftEnd: string; // "HH:mm" format
  dailyRate: number;
  overtimeRate: number;
  annualLeaveDays?: number;
}

export interface Notification {
  id?: string;
  employeeId: string;
  employeeName: string;
  timestamp: Timestamp;
  type: 'early-clock-out';
  message: string;
  read: boolean;
}