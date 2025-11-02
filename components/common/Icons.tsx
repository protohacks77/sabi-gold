import React from 'react';

const iconProps = {
    className: "w-6 h-6",
    strokeWidth: 1.5,
    stroke: "currentColor",
    fill: "none",
    viewBox: "0 0 24 24",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const
};

const smallIconProps = {
    ...iconProps,
    className: "w-5 h-5",
};

export const Icons = {
    Logo: () => <img src="https://i.ibb.co/B5S33T4M/sabi-logo.png" alt="sabi-logo" className="w-8 h-8"/>,
    LogoGold: (props: React.SVGProps<SVGSVGElement>) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}><path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#F59E0B"></path><path d="M2 17L12 22L22 17L12 12L2 17Z" fill="#FBBF24"></path><path d="M2 7V17L12 12V2L2 7Z" fill="#F59E0B"></path><path d="M22 7V17L12 12V2L22 7Z" fill="#D97706"></path></svg>,
    Dashboard: () => <svg {...iconProps}><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>,
    Workforce: () => <svg {...iconProps}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><polyline points="17 11 19 13 23 9"></polyline></svg>,
    Reports: () => <svg {...iconProps}><path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z"></path><path d="M12 12v5"></path><path d="M12 7v.01"></path><path d="M16 17v-3"></path><path d="M8 17v-2"></path><path d="M16 3.5V6h2.5"></path></svg>,
    Administration: () => <svg {...iconProps}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>,
    Settings: () => <svg {...iconProps}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.1a2 2 0 0 1 0 2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
    Help: () => <svg {...iconProps}><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
    Logout: () => <svg {...iconProps}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
    Login: () => <svg {...iconProps}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>,
    KioskView: () => <svg {...iconProps}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>,
    Search: () => <svg {...smallIconProps}><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
    Email: () => <svg {...smallIconProps}><rect x="2" y="4" width="20" height="16" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>,
    Lock: (props: React.SVGProps<SVGSVGElement>) => <svg {...smallIconProps} {...props}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>,
    Eye: () => <svg {...smallIconProps}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
    EyeOff: () => <svg {...smallIconProps}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>,
    FaceScan: (props: React.SVGProps<SVGSVGElement>) => <svg {...iconProps} {...props}><path d="M8 3a9 9 0 0 1 8 8M3 8a9 9 0 0 1 8-8"></path><path d="M8 21a9 9 0 0 0 8-8M3 16a9 9 0 0 0 8 8"></path><path d="M21 8a9 9 0 0 1-8 8M16 21a9 9 0 0 1-8-8"></path><path d="M16 3a9 9 0 0 0-8 8M21 16a9 9 0 0 0-8-8"></path></svg>,
    FingerprintScan: (props: React.SVGProps<SVGSVGElement>) => <svg {...iconProps} {...props}><path d="M12 12a3 3 0 0 0-3 3"></path><path d="M6.2 6.2a10 10 0 0 0-3.9 8.2"></path><path d="M17.8 6.2a10 10 0 0 1 3.9 8.2"></path><path d="M12 2a10 10 0 0 1 8.2 3.9"></path><path d="M6.2 17.8a10 10 0 0 1-4.3-8.1"></path><path d="M17.8 17.8a10 10 0 0 0 4.3-8.1"></path><path d="M22 12a10 10 0 0 0-3.9-8.2"></path><path d="M3.9 6.2A10 10 0 0 1 8 2.2"></path><path d="M3.9 17.8A10 10 0 0 0 8 21.8"></path></svg>,
    CheckCircle: (props: React.SVGProps<SVGSVGElement>) => <svg {...iconProps} {...props}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>,
    Users: () => <svg {...iconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    Leave: () => <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path><path d="M8 18h.01"></path><path d="M12 18h.01"></path><path d="M16 18h.01"></path></svg>,
    Payroll: () => <svg {...iconProps}><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>,
    Trash: (props?: React.SVGProps<SVGSVGElement>) => <svg {...iconProps} {...props}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
    Word: () => <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M10.5 17l-3-10h3l1.5 6 1.5-6h3l-3 10z"></path></svg>,
    PNG: () => <svg {...iconProps}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>,
    CSV: () => <svg {...iconProps}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><path d="M9 14a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-2z"></path><path d="M16 13h-3"></path><path d="M13 13v4"></path><path d="M5 13h1v4"></path><path d="M5 15h1"></path></svg>,
    Menu: () => <svg {...iconProps}><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
    X: () => <svg {...iconProps}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
    Warning: () => <svg {...iconProps}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
    Print: () => <svg {...iconProps}><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>,
    CalendarX: () => <svg {...iconProps}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line><line x1="15" y1="14" x2="9" y2="20"></line><line x1="9" y1="14" x2="15" y2="20"></line></svg>,
    Profile: () => <svg {...iconProps}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
};