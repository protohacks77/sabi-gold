import React, { useState, useEffect } from 'react';
import Dashboard from './dashboard/Dashboard';
import EmployeeManagement from './dashboard/EmployeeManagement';
import Reports from './dashboard/Reports';
import Settings from './dashboard/Settings';
import LeaveManagement from './dashboard/LeaveManagement';
import LiveView from './dashboard/LiveView'; 
import Help from './dashboard/Help';
import { db, auth } from '../services/firebase';
import { doc, getDoc, setDoc, collection, query, where, onSnapshot, updateDoc, orderBy } from 'firebase/firestore';
// FIX: Removed modular signOut import as it's not available. Using compat version instead.
import { Icons } from './common/Icons';
import type { Notification } from '../types';

type Module = 'Dashboard' | 'Workforce' | 'Reports' | 'Administration' | 'Leave Management' | 'Settings' | 'Help';

interface AdminDashboardProps {
  setView: (view: 'kiosk' | 'admin') => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ setView }) => {
    const [activeModule, setActiveModule] = useState<Module>('Dashboard');
    const [pendingLeaveCount, setPendingLeaveCount] = useState(0);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        const checkAndSetDefaultSettings = async () => {
            const settingsRef = doc(db, 'app-settings', 'main');
            const docSnap = await getDoc(settingsRef);
            if (!docSnap.exists()) {
                await setDoc(settingsRef, {
                    shiftStart: "07:30",
                    shiftEnd: "18:00",
                    dailyRate: 10,
                    overtimeRate: 10
                });
            }
        };
        checkAndSetDefaultSettings();
        
        const qLeave = query(collection(db, "leave_requests"), where("status", "==", "pending"));
        const unsubLeave = onSnapshot(qLeave, (querySnapshot) => {
            setPendingLeaveCount(querySnapshot.size);
        });

        const qNotifications = query(collection(db, "notifications"), where("read", "==", false));
        const unsubNotifications = onSnapshot(qNotifications, (querySnapshot) => {
            const fetchedNotifications = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Notification));
            fetchedNotifications.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
            setNotifications(fetchedNotifications);
        });
        
        return () => { unsubLeave(); unsubNotifications(); };
    }, []);

    const renderModule = () => {
        switch (activeModule) {
            case 'Dashboard': return <Dashboard />;
            case 'Workforce': return <LiveView />;
            case 'Reports': return <Reports />;
            case 'Administration': return <EmployeeManagement />;
            case 'Leave Management': return <LeaveManagement />;
            case 'Settings': return <Settings />;
            case 'Help': return <Help />;
            default: return <Dashboard />;
        }
    };
    
    const handleLogout = async () => {
        // FIX: Use auth.signOut() from the compat library instead of the modular signOut().
        await auth.signOut();
    };

    const handleDismissNotification = async (id: string) => {
        await updateDoc(doc(db, 'notifications', id), { read: true });
    };

    const navItems = [
        { name: 'Dashboard', icon: <Icons.Dashboard /> },
        { name: 'Workforce', icon: <Icons.Workforce /> },
        { name: 'Reports', icon: <Icons.Reports /> },
        { name: 'Administration', icon: <Icons.Administration /> },
        { name: 'Leave Management', icon: <Icons.Leave />, badge: pendingLeaveCount },
        { name: 'Settings', icon: <Icons.Settings /> },
    ];

    return (
        <div className="min-h-screen flex bg-gray-800 font-inter text-gray-200">
            <aside className="w-64 bg-gray-900 flex-col flex-shrink-0 hidden md:flex">
                <div className="flex items-center gap-3 p-6 h-20 border-b border-gray-700/50">
                  <Icons.LogoGold />
                  <div>
                    <h1 className="text-lg font-bold text-white">Sabi Gold Mine</h1>
                    <p className="text-xs text-gray-400">Admin Portal</p>
                  </div>
                </div>
                <nav className="flex-1 flex flex-col space-y-1 p-4">
                  {navItems.map(item => (
                      <NavButton
                          key={item.name}
                          module={item.name as Module}
                          icon={item.icon}
                          isActive={activeModule === item.name}
                          onClick={() => setActiveModule(item.name as Module)}
                          badgeCount={item.badge}
                      />
                  ))}
                </nav>
                 <div className="p-4 border-t border-gray-700/50">
                    <NavButton module="Kiosk View" icon={<Icons.KioskView />} isActive={false} onClick={() => setView('kiosk')} />
                    <NavButton module="Help" icon={<Icons.Help />} isActive={activeModule === 'Help'} onClick={() => setActiveModule('Help')} />
                    <NavButton module="Logout" icon={<Icons.Logout />} isActive={false} onClick={handleLogout} />
                </div>
            </aside>
            
            <MobileMenu
                isOpen={isMobileMenuOpen}
                onClose={() => setIsMobileMenuOpen(false)}
                navItems={navItems}
                activeModule={activeModule}
                setActiveModule={setActiveModule}
                setView={setView}
                handleLogout={handleLogout}
            />

            <main className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-auto">
                 {notifications.length > 0 && (
                    <div className="mb-6 space-y-4">
                        {notifications.map(notif => (
                            <div key={notif.id} className="bg-red-900/50 border border-red-700 rounded-xl p-4 flex items-center justify-between gap-4 animate-fade-in">
                                <div className="flex items-center gap-3">
                                    <div className="text-red-400 flex-shrink-0">
                                        <Icons.Warning />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-red-300">Early Clock-Out Alert</p>
                                        <p className="text-sm text-red-400">{notif.employeeName} {notif.message}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleDismissNotification(notif.id!)} className="p-1 rounded-full hover:bg-white/10 text-red-300 flex-shrink-0">
                                    <Icons.X />
                                </button>
                            </div>
                        ))}
                    </div>
                 )}
                 <header className="flex justify-between items-center mb-6">
                    <h2 className="text-3xl font-bold text-white">{activeModule}</h2>
                    <button onClick={() => setIsMobileMenuOpen(true)} className="md:hidden p-2 rounded-lg hover:bg-gray-700/50 text-gray-300" aria-label="Open menu">
                        <Icons.Menu />
                    </button>
                 </header>
                <div className="animate-fade-in flex-grow">
                    {renderModule()}
                </div>
                <footer className="text-center text-xs text-gray-500 mt-6 space-y-1 flex-shrink-0">
                    <p>© 2024 Sabi Gold Mine. All rights reserved.</p>
                    <p>For assistance, please contact IT Support at extension 555</p>
                </footer>
            </main>
        </div>
    );
};

const MobileMenu: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    navItems: { name: string, icon: React.ReactNode, badge?: number }[];
    activeModule: Module;
    setActiveModule: (module: Module) => void;
    setView: (view: 'kiosk' | 'admin') => void;
    handleLogout: () => void;
}> = ({ isOpen, onClose, navItems, activeModule, setActiveModule, setView, handleLogout }) => {
    if (!isOpen) return null;

    const handleItemClick = (module: Module) => {
        setActiveModule(module);
        onClose();
    };
    
    const handleKioskClick = () => {
        setView('kiosk');
        onClose();
    };

    const handleHelpClick = () => {
        setActiveModule('Help');
        onClose();
    };

    const handleLogoutClick = () => {
        handleLogout();
        onClose();
    };

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden animate-fade-in-fast"
            onClick={onClose}
        >
            <aside 
                className="fixed top-0 left-0 h-full w-64 bg-gray-900 flex flex-col z-50 animate-slide-in-left"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-6 h-20 border-b border-gray-700/50">
                    <div className="flex items-center gap-3">
                        <Icons.LogoGold />
                        <div>
                            <h1 className="text-lg font-bold text-white">Sabi Gold Mine</h1>
                            <p className="text-xs text-gray-400">Admin Portal</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
                        <Icons.X />
                    </button>
                </div>
                <nav className="flex-1 flex flex-col space-y-1 p-4">
                  {navItems.map(item => (
                      <NavButton
                          key={item.name}
                          module={item.name as Module}
                          icon={item.icon}
                          isActive={activeModule === item.name}
                          onClick={() => handleItemClick(item.name as Module)}
                          badgeCount={item.badge}
                      />
                  ))}
                </nav>
                 <div className="p-4 border-t border-gray-700/50">
                    <NavButton module="Kiosk View" icon={<Icons.KioskView />} isActive={false} onClick={handleKioskClick} />
                    <NavButton module="Help" icon={<Icons.Help />} isActive={activeModule === 'Help'} onClick={handleHelpClick} />
                    <NavButton module="Logout" icon={<Icons.Logout />} isActive={false} onClick={handleLogoutClick} />
                </div>
            </aside>
        </div>
    );
};

const NavButton: React.FC<{ module: string, icon: React.ReactNode, isActive: boolean, onClick: () => void, badgeCount?: number }> = ({ module, icon, isActive, onClick, badgeCount }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center justify-between space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-base font-medium ${isActive ? 'bg-gray-700/50 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`}
    >
        <div className="flex items-center space-x-3">
            {icon}
            <span>{module}</span>
        </div>
        {badgeCount && badgeCount > 0 && (
            <span className="bg-yellow-400 text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">{badgeCount}</span>
        )}
    </button>
);

export default AdminDashboard;