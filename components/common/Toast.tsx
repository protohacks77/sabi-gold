import React, { useEffect } from 'react';
import { Icons } from './Icons';

interface ToastProps {
  message: string;
  type: 'info' | 'error' | 'success';
  onClose: () => void;
}

const typeStyles = {
  info: {
    bg: 'bg-blue-900/50 border-blue-700',
    text: 'text-blue-300',
    icon: <Icons.Help />,
  },
  error: {
    bg: 'bg-red-900/50 border-red-700',
    text: 'text-red-300',
    icon: <Icons.Reports />,
  },
  success: {
    bg: 'bg-green-900/50 border-green-700',
    text: 'text-green-300',
    icon: <Icons.CheckCircle />,
  },
};

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = typeStyles[type];

  return (
    <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 p-4 rounded-lg border shadow-lg animate-fade-in ${styles.bg} ${styles.text}`}>
      <div className="flex-shrink-0">{styles.icon}</div>
      <p className="font-semibold">{message}</p>
      <button onClick={onClose} className="ml-auto -mr-2 p-1 rounded-full hover:bg-white/10">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );
};

export default Toast;
