# Sabi Gold Mine Biometric Management System

## 1. Overview

The Sabi Gold Mine Biometric Management System is a comprehensive, web-based application designed to modernize employee attendance tracking, payroll processing, and overall workforce management. It features a dual-interface design: an employee-facing Kiosk for seamless clock-in/out using modern biometrics, and a powerful, real-time Admin Dashboard for complete administrative oversight.

The system is built with security, efficiency, and user experience at its core, leveraging modern technologies to provide a reliable and intuitive platform for managing Sabi Gold Mine's most valuable asset: its people.

---

## 2. Key Features

### Employee Kiosk

The Kiosk is the primary interaction point for employees, designed for speed and ease of use.

- **Multi-Factor Authentication:**
  - **Facial Recognition:** State-of-the-art face verification for quick, touchless clock-ins.
  - **Fingerprint Scanning:** Utilizes device-native biometrics (WebAuthn API) for secure authentication.
  - **PIN Fallback:** A 4-digit PIN system ensures access for all employees, regardless of device capabilities or biometric enrollment status.
- **Employee Self-Service Portal:**
  - **Check My Profile:** Employees can securely authenticate to view a comprehensive profile, including:
    - **Overview:** A summary of their leave balance and monthly work statistics (days/hours worked).
    - **Attendance Log:** A detailed, filterable history of all their clock-in and clock-out times.
    - **Leave History:** A clear record of all past and upcoming leave.
- **Leave Management:** Employees can submit leave requests directly from the Kiosk after clocking in.
- **On-Leave Login Prevention:** The system automatically prevents employees who are on approved leave from clocking in, displaying their scheduled return date instead.
- **Dynamic Real-Time Clock:** A beautifully designed, large-format flip clock displays the current time with a realistic animation.
- **Secure Admin Access:** A dedicated entry point for administrators to access the backend dashboard.

### Admin Dashboard

The Admin Dashboard is a secure, feature-rich portal for managing all aspects of the workforce.

- **Real-Time Analytics Dashboard:**
  - **At-a-Glance Stats:** Key metrics are displayed prominently, including Total Employees, Currently On-Site, On Leave Today, and Absent Today.
  - **Live Activity Feed:** A real-time stream of the latest clock-in and clock-out events.
  - **Data Visualizations:** Interactive charts display weekly attendance trends, daily overtime hours, and a monthly breakdown of leave types.
- **Workforce Monitoring:** A live, filterable view of the entire workforce, showing each employee's current status (On-Site, Off-Site, On Leave), shift progress, and department.
- **Employee Administration:**
  - A full CRUD (Create, Read, Update, Delete) interface for the employee roster.
  - **Biometric Enrollment:** Admins can easily register an employee's face or fingerprint directly from the employee management panel.
  - Manage employee details, including position, department, and PIN.
- **Advanced Leave Management:**
  - **Request Approval System:** A dedicated queue for pending leave requests, with one-click approve/deny functionality.
  - **Leave Calendar:** A comprehensive view of all scheduled leave.
  - **Recycle Bin:** A two-step deletion process for leave entries. Deleted records are first moved to a recycle bin, where they can be restored or permanently deleted, preventing accidental data loss.
- **Comprehensive Reporting Engine:**
  - **Multiple Report Types:** Generate detailed reports for **Payroll**, **Employees On Leave**, **Late Arrivals**, and **Absences**.
  - **Custom Date Ranges:** Filter reports by any date range or use quick filters like "This Week" or "This Month".
  - **Multi-Format Export:** Export any report to **PDF**, **CSV**, **Word (.doc)**, or **PNG** formats. Exports are professionally branded with the company logo and report details.
- **System Automation & Notifications:**
  - **Automated Daily Tasks:** The system automatically runs daily checks to:
    - Handle **missed clock-outs** from the previous day, logging the employee out and notifying the admin.
    - Generate a notification that the **previous day's attendance report** is ready for one-click printing.
  - **Real-Time Alerts:** Admins receive instant, dismissible notifications on their dashboard for critical events like **early clock-outs**.
- **System Settings:**
  - A centralized module to configure core business logic, including standard shift times, daily and overtime pay rates, and annual leave allowances.
- **Responsive Design:** The dashboard is fully responsive, with a slide-in mobile menu that provides access to all administrative functions on the go.
- **Help Center:** An integrated FAQ and tutorial section to guide administrators on using the system's features.

---

## 3. Application Workflow

### Employee Workflow

1.  **Clock-In:** The employee approaches the Kiosk, clicks "Log In / Log Out," and chooses their authentication method (face, fingerprint, or PIN).
2.  **Authentication:** The system verifies their identity.
3.  **Confirmation:** A "Welcome" screen confirms the successful clock-in and displays the time. The employee has options to request leave or change their PIN.
4.  **Clock-Out:** At the end of their shift, the employee repeats the authentication process. The system confirms the clock-out and displays a "Goodbye" message before automatically returning to the main Kiosk screen after 3 seconds.

### Admin Workflow

1.  **Login:** The administrator navigates to the Kiosk and clicks "Admin Panel." They log in using their secure email and password credentials.
2.  **Dashboard Review:** Upon logging in, the admin lands on the main dashboard. They can immediately review daily stats, check for new notifications (e.g., missed logouts, early clock-outs), and see the live activity feed.
3.  **Task Management:** The admin navigates to the "Leave Management" tab to approve or deny any pending requests.
4.  **Reporting:** At the end of a pay period, the admin goes to the "Reports" tab, selects the "Payroll" report type, sets the date range, and generates the data. They can then export this report to CSV for further processing or PDF for record-keeping.
5.  **Employee Management:** When a new employee is hired, the admin uses the "Administration" tab to add them to the system and subsequently enroll their biometrics.

---

## 4. Technical Stack

- **Frontend:** React with TypeScript, styled using Tailwind CSS for a modern, responsive UI.
- **Backend & Database:** Google Firebase Suite
  - **Firestore:** A NoSQL, real-time database for storing all employee, attendance, and leave data.
  - **Firebase Authentication:** For secure administrator email/password login.
- **Biometric Technologies:**
  - **Facial Recognition:** `face-api.js`, a powerful client-side JavaScript API for face detection and recognition, leveraging TensorFlow.js.
  - **Fingerprint Recognition:** The **WebAuthn API**, a modern web standard for secure public-key credential authentication, allowing the application to interface with device-native biometrics like Touch ID, Windows Hello, or Android fingerprint sensors.
- **Client-Side Libraries:**
  - **Reporting & Exporting:** `jsPDF`, `jspdf-autotable`, and `html2canvas` for generating professional, client-side reports in various formats.
  - **Data Visualization:** `Chart.js` and `react-chartjs-2` for creating interactive and informative charts on the admin dashboard.

---

## 5. Services Explained

The `/services` directory contains the core logic for interacting with external APIs and the database.

- **`firebase.ts`:** Initializes the connection to the Firebase project, exporting the Firestore database instance (`db`) and Authentication service (`auth`) for use throughout the application.
- **`faceRecognition.ts`:**
  - **`loadModels()`:** Asynchronously loads the pre-trained machine learning models required by `face-api.js`.
  - **`enrollFace()`:** Captures a video stream, detects a face, and generates a unique 128-dimension facial descriptor (an array of numbers) for that face.
  - **`verifyFace()`:** Captures a face from the video stream, generates its descriptor, and compares it against all enrolled face descriptors in Firestore using Euclidean distance to find the best match.
- **`fingerprintService.ts`:**
  - **`checkBiometricSupport()`:** Checks if the user's browser and device support the WebAuthn API with a platform authenticator.
  - **`enrollFingerprint()`:** Initiates the WebAuthn `navigator.credentials.create()` flow to register a new employee's fingerprint, storing the resulting credential ID and public key.
  - **`verifyFingerprint()`:** Initiates the WebAuthn `navigator.credentials.get()` flow, asking the device to sign a challenge with the user's biometric. It then finds the employee associated with the returned credential ID.
- **`autoTasks.ts`:**
  - **`runDailyTasks()`:** This is the main function, designed to run once per day. It checks `localStorage` to see if it has already run today.
  - **`handleMissedLogouts()`:** Queries Firestore for employees who are still "Logged In" but whose last login time was before today. It automatically creates a clock-out record for them and generates an admin notification.
  - **`createDailyReportNotification()`:** Creates a system notification to inform the admin that the previous day's report is ready to be generated and printed.
