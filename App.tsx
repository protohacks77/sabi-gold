import React, { useState, useEffect } from 'react';
import Kiosk from './components/Kiosk';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import { auth } from './services/firebase';
// FIX: Replaced modular auth imports with firebase compat to resolve export errors.
import firebase from 'firebase/compat/app';
import Spinner from './components/common/Spinner';

type View = 'kiosk' | 'admin';

function App() {
  const [view, setView] = useState<View>('kiosk');
  // FIX: Use firebase.User type from the compat library.
  const [currentUser, setCurrentUser] = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // FIX: Use auth.onAuthStateChanged from the compat library.
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="min-h-screen flex justify-center items-center bg-gray-900">
          <Spinner />
        </div>
      );
    }
    if (view === 'kiosk') {
      return <Kiosk setView={setView} />;
    }
    if (view === 'admin') {
      return currentUser ? <AdminDashboard setView={setView} /> : <Login />;
    }
  };

  return (
    <>
        <style>
        {`
          :root {
            --color-background: #111827; /* Dark Blue-Gray */
            --color-surface: #1F2937;    /* Lighter Blue-Gray */
            --color-surface-light: #374151; /* Even Lighter */
            --color-border: #4B5563;
            --color-primary: #FBBF24; /* Amber/Gold */
            --color-primary-hover: #F59E0B;
            --color-secondary: #818CF8; /* Indigo */
            --color-text-primary: #F9FAFB; /* Almost White */
            --color-text-secondary: #9CA3AF;
            --color-success: #34D399; /* Emerald */
            --color-danger: #F87171; /* Red */
            --color-warning: #F59E0B; /* Amber */
          }
          
          /* Updated design from images */
          :root {
            --color-background: #1F2937; /* Darkest Gray */
            --color-surface: #273142; /* Main surface, slightly lighter */
            --color-surface-light: #374151;
            --color-border: #4B5563;
            --color-primary: #F59E0B; /* Gold */
            --color-primary-hover: #D97706;
            --color-text-primary: #E5E7EB;
            --color-text-secondary: #9CA3AF;
            --color-success: #10B981;
            --color-danger: #EF4444;
            --color-warning: #F59E0B;
          }
          body {
            background-color: #1F2937;
            color: #E5E7EB;
            font-family: 'Inter', sans-serif;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          
          .font-inter { font-family: 'Inter', sans-serif; }
          
          .animate-fade-in {
            animation: fadeIn 0.5s ease-in-out;
          }
           .animate-fade-in-fast {
            animation: fadeIn 0.2s ease-in-out;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          
          .animate-slide-up {
            animation: slideUp 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          @keyframes slideUp {
             from { opacity: 0; transform: translateY(30px); }
             to { opacity: 1; transform: translateY(0); }
          }
          
          .animate-card-enter {
             animation: cardEnter 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          @keyframes cardEnter {
            from {
                opacity: 0;
                transform: translateY(50px) scale(0.95);
            }
            to {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
          }

          @keyframes slideDown {
            from { opacity: 0; transform: translateY(-30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes slideInLeft {
            from { opacity: 0; transform: translateX(-30px); }
            to { opacity: 1; transform: translateX(0); }
          }
           @keyframes slideInRight {
            from { opacity: 0; transform: translateX(30px); }
            to { opacity: 1; transform: translateX(0); }
          }
          
          .animate-slide-down {
            animation: slideDown 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          .animate-slide-in-left {
            animation: slideInLeft 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
          .animate-slide-in-right {
             animation: slideInRight 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }

          @keyframes letterSlideIn {
            from { opacity: 0; transform: translateX(-15px); }
            to { opacity: 1; transform: translateX(0); }
          }
          .animate-letter-slide {
            animation: letterSlideIn 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94) both;
          }
        `}
        </style>
        {renderContent()}
    </>
  );
}

export default App;