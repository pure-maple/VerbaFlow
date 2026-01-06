
import React, { useState, useEffect } from 'react';
import { X, Book, CheckCircle2, Circle } from 'lucide-react';
import { GlossarySet } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  glossarySets: GlossarySet[];
  selectedIds: string[];
  onSave: (ids: string[]) => void;
}

export const GlossarySelectorModal: React.FC<Props> = ({ 
  isOpen, onClose, glossarySets, selectedIds, onSave 
}) => {
  const { t } = useLanguage();
  const [tempSelection, setTempSelection] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setTempSelection(selectedIds);
    }
  }, [isOpen, selectedIds]);

  const toggleSet = (id: string) => {
    setTempSelection(prev => 
      prev.includes(id) ? prev.filter(pid => pid !== id) : [...prev, id]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[80vh]">
        
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Book size={18} className="text-indigo-600" />
            {t.analysis.glossaryBtn}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1">
          {glossarySets.length === 0 ? (
             <div className="text-center py-8 text-slate-500 text-sm">
                {t.glossary.noSetsFound}
             </div>
          ) : (
             <div className="space-y-2">
               {glossarySets.map(set => {
                 const isSelected = tempSelection.includes(set.id);
                 return (
                   <div 
                     key={set.id}
                     onClick={() => toggleSet(set.id)}
                     className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                       isSelected 
                       ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 shadow-sm' 
                       : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                     }`}
                   >
                     <div className="flex-1 min-w-0 mr-3">
                       <h4 className={`text-sm font-semibold truncate ${isSelected ? 'text-indigo-900 dark:text-indigo-100' : 'text-slate-700 dark:text-slate-200'}`}>{set.title}</h4>
                       <p className="text-xs text-slate-500 truncate">{set.items.length} terms • {set.tags.join(', ')}</p>
                     </div>
                     <div className={isSelected ? 'text-indigo-600' : 'text-slate-300'}>
                        {isSelected ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                     </div>
                   </div>
                 );
               })}
             </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm">
            {t.common.cancel}
          </button>
          <button 
            onClick={() => { onSave(tempSelection); onClose(); }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm"
          >
            {t.common.confirm}
          </button>
        </div>
      </div>
    </div>
  );
};
