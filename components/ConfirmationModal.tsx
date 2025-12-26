
import React from 'react';
import { X, AlertTriangle, Loader2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  isLoading?: boolean;
}

export const ConfirmationModal: React.FC<Props> = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  isDanger = false,
  isLoading = false
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-700 scale-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            {isDanger && <AlertTriangle size={18} className="text-amber-500" />}
            {title}
          </h3>
          {!isLoading && (
            <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {message}
          </p>
          
          <div className="flex justify-end gap-3 mt-6">
            <button 
                onClick={onClose} 
                disabled={isLoading}
                className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
                {cancelText}
            </button>
            <button
                onClick={onConfirm}
                disabled={isLoading}
                className={`px-4 py-2 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors flex items-center gap-2 ${
                    isDanger 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-indigo-600 hover:bg-indigo-700'
                } ${isLoading ? 'opacity-80 cursor-not-allowed' : ''}`}
            >
                {isLoading && <Loader2 size={16} className="animate-spin" />}
                {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
