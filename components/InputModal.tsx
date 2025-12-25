
import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  message: string;
  placeholder?: string;
  initialValue?: string;
}

export const InputModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, title, message, placeholder, initialValue = '' }) => {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (isOpen) setValue(initialValue);
  }, [isOpen, initialValue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h3 className="font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={20} /></button>
        </div>
        <div className="p-6">
          <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 whitespace-pre-wrap">{message}</p>
          <input
            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-950 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
            placeholder={placeholder}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && value.trim()) {
                    onConfirm(value);
                    onClose();
                }
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2 mt-6">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm">Cancel</button>
            <button
                onClick={() => { onConfirm(value); onClose(); }}
                disabled={!value.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
                Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
