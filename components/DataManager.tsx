
import React, { useState, useEffect } from 'react';
import { Database, Trash2, HardDrive, MessageSquare, Book, File } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { storage, StorageStats } from '../services/storage';
import { ConfirmationModal } from './ConfirmationModal';

export const DataManager: React.FC = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [confirmClear, setConfirmClear] = useState<{ isOpen: boolean, target: 'projects' | 'chats' | 'glossary' | null }>({ isOpen: false, target: null });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const s = await storage.getStats();
    setStats(s);
  };

  const handleClear = async () => {
      if (confirmClear.target) {
          await storage.clear(confirmClear.target);
          setConfirmClear({ isOpen: false, target: null });
          loadStats();
      }
  };

  const StatCard = ({ icon: Icon, title, count, type }: { icon: any, title: string, count: number, type: 'projects' | 'chats' | 'glossary' }) => (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between h-full shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Icon size={24} />
              </div>
              <button 
                onClick={() => setConfirmClear({ isOpen: true, target: type })}
                className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title={t.data.clearBtn}
              >
                  <Trash2 size={18} />
              </button>
          </div>
          <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mt-2">{count}</p>
              <p className="text-xs text-slate-500 mt-1">{t.data.unit}</p>
          </div>
      </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
        <ConfirmationModal 
            isOpen={confirmClear.isOpen}
            onClose={() => setConfirmClear({ isOpen: false, target: null })}
            onConfirm={handleClear}
            title={t.data.clearConfirmTitle}
            message={t.data.clearConfirmMessage.replace('{target}', confirmClear.target || '')}
            isDanger={true}
            confirmText={t.common.delete}
            cancelText={t.common.cancel}
        />

        <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Database className="text-indigo-600" /> {t.data.title}
            </h1>
            <p className="text-slate-500 mt-2">{t.data.desc}</p>
        </div>

        {stats ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard icon={File} title={t.data.workspace} count={stats.projectCount} type="projects" />
                <StatCard icon={MessageSquare} title={t.data.chats} count={stats.chatCount} type="chats" />
                <StatCard icon={Book} title={t.data.glossarySets} count={stats.glossaryCount} type="glossary" />
            </div>
        ) : (
            <div className="text-center p-12">{t.common.loading}</div>
        )}
    </div>
  );
};
