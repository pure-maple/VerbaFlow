
import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, X, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface Props {
  message: string;
  type?: ToastType;
  isVisible: boolean;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<Props> = ({ message, type = 'info', isVisible, onClose, duration = 3000 }) => {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose, duration]);

  if (!isVisible) return null;

  const styles = {
    success: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
    error: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
    info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
  };

  const icons = {
    success: <CheckCircle size={20} className="shrink-0" />,
    error: <AlertCircle size={20} className="shrink-0" />,
    info: <Info size={20} className="shrink-0" />
  };

  return (
    <div className="fixed bottom-6 right-6 z-[120] animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-none">
      <div className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md min-w-[300px] max-w-sm pointer-events-auto ${styles[type]}`}>
        <div className="mt-0.5">{icons[type]}</div>
        <div className="flex-1">
            <p className="text-sm font-semibold leading-tight">{message}</p>
        </div>
        <button onClick={onClose} className="opacity-60 hover:opacity-100 transition-opacity p-0.5 -mr-1">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};
