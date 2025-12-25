
import React, { useState, useEffect, useRef } from 'react';
import { GlossarySet, GlossaryItem, VocabItem } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfig } from '../contexts/ConfigContext';
import { 
  Sparkles, Download, BookOpen, HardDrive, Trash2, 
  Loader2, Plus, Search, Tag, Edit, FolderOpen, ArrowLeft, Save, X, MoreHorizontal, CheckSquare, Square, FileText, Upload, RefreshCw, FileJson
} from 'lucide-react';
import { generateSmartGlossary, generateGlossaryFromRawText } from '../services/geminiService';
import { storage } from '../services/storage';
// import { saveToDrive, getDriveFileText, openDrivePicker, extractDriveFileId } from '../services/googleDriveService'; // Drive Disabled
// import { DriveSelectorModal } from './DriveSelectorModal'; // Drive Disabled
import { ConfirmationModal } from './ConfirmationModal';

// Define a type that allows tags to be string (during editing) or array
type EditingGlossarySet = Omit<GlossarySet, 'tags'> & {
  tags: string | string[];
};

interface Props {
  glossarySets: GlossarySet[];
  setGlossarySets: (sets: GlossarySet[]) => void;
  srtContent: string;
  vocabList: VocabItem[];
  modelName: string;
  language: string;
}

const GlossaryManager: React.FC<Props> = ({ 
  glossarySets, setGlossarySets, srtContent, vocabList, modelName, language 
}) => {
  const { t } = useLanguage();
  const { geminiApiKey, geminiBaseUrl, driveClientId, driveApiKey, manualDriveToken } = useConfig();
  
  // View State
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  
  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  
  // Import Flow States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<'input' | 'preview'>('input');
  const [importType, setImportType] = useState<'file' | 'text'>('file');
  const [importText, setImportText] = useState("");
  const [importContext, setImportContext] = useState("");
  const [importedItems, setImportedItems] = useState<GlossaryItem[]>([]);
  const [importTarget, setImportTarget] = useState<'new' | 'append'>('new');
  
  // Data States
  const [editingSet, setEditingSet] = useState<Partial<EditingGlossarySet> | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null); // For Local JSON Import

  // Loading States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSavingSet, setIsSavingSet] = useState(false); // New: Loading state for Save
  const [isSyncing, setIsSyncing] = useState(false);

  // Selection
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Confirmation State
  const [confirmConfig, setConfirmConfig] = useState<{
      isOpen: boolean;
      title: string;
      message: string;
      onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  // Filtered List
  const filteredSets = glossarySets.filter(set => 
    set.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    set.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeSet = glossarySets.find(s => s.id === activeSetId);

  // --- Local Export/Import (JSON) ---
  const handleLocalExport = () => {
      const dataStr = JSON.stringify(glossarySets, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `verbaflow_glossary_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const handleLocalImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = async (ev) => {
              try {
                  const content = ev.target?.result as string;
                  const sets = JSON.parse(content);
                  if (Array.isArray(sets)) {
                      // Save all to storage
                      for (const set of sets) {
                          if (set.id && set.items) {
                              await storage.saveGlossarySet(set);
                          }
                      }
                      const newSets = await storage.getAllGlossarySets();
                      setGlossarySets(newSets);
                      alert("Glossary imported successfully!");
                  } else {
                      alert("Invalid JSON format.");
                  }
              } catch (err) {
                  console.error(err);
                  alert("Failed to parse JSON.");
              }
          };
          reader.readAsText(file);
      }
  };

  // --- CRUD Operations for SETS ---

  const handleCreateSet = () => {
    // Clear editing set state properly to avoid ghost data
    setEditingSet({ title: '', tags: [], description: '' });
    setIsEditModalOpen(true);
  };

  const handleEditSet = (set: GlossarySet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSet({ ...set });
    setIsEditModalOpen(true);
  };

  const handleSaveSet = async () => {
    if (!editingSet?.title) return;
    
    setIsSavingSet(true);
    try {
        let updatedSet: GlossarySet;
        const now = Date.now();

        const tags = typeof editingSet.tags === 'string' 
          ? (editingSet.tags as string).split(',').map((t:string) => t.trim()).filter(Boolean) 
          : (editingSet.tags as string[]) || [];

        if (editingSet.id) {
          // Update existing
          updatedSet = {
            ...glossarySets.find(s => s.id === editingSet.id)!,
            title: editingSet.title,
            tags: tags,
            description: editingSet.description || '',
            updatedAt: now
          };
        } else {
          // Create new
          updatedSet = {
            id: `set-${now}`,
            title: editingSet.title,
            tags: tags,
            description: editingSet.description || '',
            items: [],
            createdAt: now,
            updatedAt: now
          };
        }

        await storage.saveGlossarySet(updatedSet);
        
        // RE-FETCH from source of truth to ensure UI update
        const sets = await storage.getAllGlossarySets();
        setGlossarySets(sets);
        
        setIsEditModalOpen(false);
        setEditingSet(null);
    } catch(e) {
        console.error("Failed to save set:", e);
    } finally {
        setIsSavingSet(false);
    }
  };

  const initiateDeleteSet = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setConfirmConfig({
          isOpen: true,
          title: "Delete Glossary Set",
          message: "Are you sure you want to delete this glossary set? This cannot be undone.",
          onConfirm: () => handleDeleteSet(id)
      });
  };

  const handleDeleteSet = async (id: string) => {
    await storage.deleteGlossarySet(id);
    const sets = await storage.getAllGlossarySets();
    setGlossarySets(sets);
    if (activeSetId === id) setActiveSetId(null);
  };

  // --- Import / AI Generation Logic ---

  const openImportModal = () => {
      setImportStep('input');
      setImportText("");
      setImportContext("");
      setImportedItems([]);
      setImportTarget(activeSetId ? 'append' : 'new');
      setIsImportModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const text = await file.text();
          setImportText(text);
          setImportType('text'); // Switch view to text so user can see it
      }
  };

  const handleAnalyzeImport = async () => {
      if (!importText.trim()) return;
      if (!geminiApiKey) { alert("API Key required"); return; }
      
      setIsGenerating(true);
      try {
          const items = await generateGlossaryFromRawText(importText, importContext, modelName, language, geminiApiKey, geminiBaseUrl);
          setImportedItems(items);
          setImportStep('preview');
      } catch (e) {
          console.error(e);
          alert("Analysis Failed. Please try again.");
      } finally {
          setIsGenerating(false);
      }
  };

  const handleConfirmImport = async () => {
      setIsSavingSet(true);
      try {
          // Save items
          if (importTarget === 'new') {
              const newSet: GlossarySet = {
                  id: `set-${Date.now()}`,
                  title: `Imported ${new Date().toLocaleTimeString()}`,
                  tags: ['Imported'],
                  description: importContext || 'Imported via Smart Import',
                  items: importedItems,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
              };
              await storage.saveGlossarySet(newSet);
          } else if (activeSetId) {
              const targetSet = glossarySets.find(s => s.id === activeSetId)!;
              // Deduplicate
              const merged = [...targetSet.items, ...importedItems.filter(n => !targetSet.items.some(g => g.term.toLowerCase() === n.term.toLowerCase()))];
              const updatedSet = { ...targetSet, items: merged, updatedAt: Date.now() };
              await storage.saveGlossarySet(updatedSet);
          }
          
          const sets = await storage.getAllGlossarySets();
          setGlossarySets(sets);
          setIsImportModalOpen(false);
      } catch (e) {
          console.error(e);
          alert("Import failed to save.");
      } finally {
          setIsSavingSet(false);
      }
  };

  // --- CRUD for ITEMS (Existing) ---
  
  const handleAddItem = async () => {
      if (!activeSet) return;
      const newItem: GlossaryItem = {
          id: `item-${Date.now()}`,
          term: 'New Term',
          definition: 'Description'
      };
      const updatedSet = { ...activeSet, items: [newItem, ...activeSet.items], updatedAt: Date.now() };
      await storage.saveGlossarySet(updatedSet);
      setGlossarySets(await storage.getAllGlossarySets());
  };

  const handleUpdateItem = async (itemId: string, field: keyof GlossaryItem, value: string) => {
      if (!activeSet) return;
      const updatedItems = activeSet.items.map(item => 
        item.id === itemId ? { ...item, [field]: value } : item
      );
      const updatedSet = { ...activeSet, items: updatedItems, updatedAt: Date.now() };
      await storage.saveGlossarySet(updatedSet);
      setGlossarySets(glossarySets.map(s => s.id === activeSet.id ? updatedSet : s));
  };

  const handleDeleteItem = async (itemId: string) => {
      if (!activeSet) return;
      const updatedItems = activeSet.items.filter(item => item.id !== itemId);
      const updatedSet = { ...activeSet, items: updatedItems, updatedAt: Date.now() };
      await storage.saveGlossarySet(updatedSet);
      setGlossarySets(await storage.getAllGlossarySets());
  };

  const initiateBulkDelete = () => {
      if (!activeSet || selectedItems.length === 0) return;
      setConfirmConfig({
          isOpen: true,
          title: "Delete Selected Items",
          message: `Are you sure you want to delete ${selectedItems.length} items? This cannot be undone.`,
          onConfirm: handleBulkDelete
      });
  };

  const handleBulkDelete = async () => {
     if (!activeSet) return;

     const updatedItems = activeSet.items.filter(item => !selectedItems.includes(item.id));
     const updatedSet = { ...activeSet, items: updatedItems, updatedAt: Date.now() };
     await storage.saveGlossarySet(updatedSet);
     setGlossarySets(await storage.getAllGlossarySets());
     setSelectedItems([]);
  };

  const toggleSelect = (id: string) => {
      if (selectedItems.includes(id)) {
          setSelectedItems(prev => prev.filter(i => i !== id));
      } else {
          setSelectedItems(prev => [...prev, id]);
      }
  };

  const toggleSelectAll = () => {
      if (!activeSet) return;
      if (selectedItems.length === activeSet.items.length) {
          setSelectedItems([]);
      } else {
          setSelectedItems(activeSet.items.map(i => i.id));
      }
  };

  // --- Modals ---

  const EditModal = () => {
    if (!isEditModalOpen || !editingSet) return null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
           <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-100">{editingSet.id ? t.glossary.modal.editTitle : t.glossary.modal.createTitle}</h3>
           <div className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t.glossary.modal.nameLabel}</label>
                  <input 
                    className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                    value={editingSet.title || ''}
                    onChange={e => setEditingSet({...editingSet, title: e.target.value})}
                    autoFocus
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t.glossary.modal.tagsLabel}</label>
                  <input 
                    className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                    value={Array.isArray(editingSet.tags) ? editingSet.tags.join(', ') : editingSet.tags}
                    onChange={e => setEditingSet({...editingSet, tags: e.target.value})}
                    placeholder="Tech, Medical, General"
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">{t.glossary.modal.descLabel}</label>
                  <textarea 
                    className="w-full p-2 border rounded-lg dark:bg-slate-900 dark:border-slate-600 text-slate-900 dark:text-slate-100 h-20 resize-none"
                    value={editingSet.description || ''}
                    onChange={e => setEditingSet({...editingSet, description: e.target.value})}
                  />
              </div>
           </div>
           <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">{t.glossary.modal.cancel}</button>
              <button 
                onClick={handleSaveSet} 
                disabled={isSavingSet}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                  {isSavingSet && <Loader2 size={16} className="animate-spin" />}
                  {t.glossary.modal.save}
              </button>
           </div>
        </div>
      </div>
    );
  };

  const ImportModal = () => {
      if (!isImportModalOpen) return null;
      return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Sparkles size={18} className="text-indigo-500" />
                        {t.glossary.importModal.title}
                    </h3>
                    <button onClick={() => setIsImportModalOpen(false)}><X size={20} className="text-slate-400 hover:text-red-500" /></button>
                </div>
                 <div className="flex-1 overflow-y-auto p-6">
                    {importStep === 'input' ? (
                        <div className="space-y-6">
                            <div className="flex border-b border-slate-200 dark:border-slate-700">
                                <button onClick={() => setImportType('file')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${importType === 'file' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t.glossary.importModal.tabFile}</button>
                                <button onClick={() => setImportType('text')} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${importType === 'text' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>{t.glossary.importModal.tabText}</button>
                            </div>
                            {importType === 'file' ? (
                                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".txt,.csv,.json,.md" />
                                    <Upload size={32} className="text-slate-400 mb-2" />
                                    <p className="text-slate-500 text-sm">{t.glossary.importModal.filePlaceholder}</p>
                                </div>
                            ) : (
                                <textarea className="w-full h-48 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm font-mono focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Paste your content here..." value={importText} onChange={e => setImportText(e.target.value)} />
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.glossary.importModal.contextLabel}</label>
                                <textarea className="w-full h-20 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={t.glossary.importModal.contextPlaceholder} value={importContext} onChange={e => setImportContext(e.target.value)} />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-100">{t.glossary.importModal.previewTitle}</h4>
                            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 max-h-64 overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-500"><tr><th className="p-2">Term</th><th className="p-2">Definition</th></tr></thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {importedItems.map((item, i) => (<tr key={i}><td className="p-2 font-medium">{item.term}</td><td className="p-2 text-slate-600 dark:text-slate-400">{item.definition}</td></tr>))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex gap-4 items-center mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-lg">
                                <span className="text-sm font-semibold">{t.glossary.importModal.targetSet}:</span>
                                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="target" checked={importTarget === 'new'} onChange={() => setImportTarget('new')} /><span className="text-sm">{t.glossary.importModal.newSet}</span></label>
                                {activeSetId && (<label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="target" checked={importTarget === 'append'} onChange={() => setImportTarget('append')} /><span className="text-sm">{t.glossary.importModal.existingSet} <b>{glossarySets.find(s => s.id === activeSetId)?.title}</b></span></label>)}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-3">
                    {importStep === 'input' ? (
                        <button onClick={handleAnalyzeImport} disabled={isGenerating || !importText} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">{isGenerating && <Loader2 size={16} className="animate-spin" />}{t.glossary.importModal.btnAnalyze}</button>
                    ) : (
                         <div className="flex gap-2">
                             <button onClick={() => setImportStep('input')} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">Back</button>
                             <button onClick={handleConfirmImport} disabled={isSavingSet} className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center gap-2">
                                {isSavingSet && <Loader2 size={16} className="animate-spin" />}
                                {t.glossary.importModal.btnSave}
                             </button>
                         </div>
                    )}
                </div>
            </div>
        </div>
      );
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 font-sans">
      
      <ConfirmationModal
          isOpen={confirmConfig.isOpen}
          onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
          onConfirm={confirmConfig.onConfirm}
          title={confirmConfig.title}
          message={confirmConfig.message}
          isDanger={true}
      />

      <EditModal />
      <ImportModal />
      
      {/* Header */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="text-indigo-600" />
              {t.glossary.title}
           </h2>
           <p className="text-sm text-slate-500 mt-1">{t.glossary.subtitle}</p>
        </div>
        <div className="flex gap-2">
           <input type="file" ref={jsonImportRef} className="hidden" onChange={handleLocalImport} accept=".json" />
           <div className="flex gap-1 mr-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                <button onClick={handleLocalExport} className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md shadow-sm transition-all flex items-center gap-1" title="Export JSON to PC">
                    <Download size={14} /> Export JSON
                </button>
                <button onClick={() => jsonImportRef.current?.click()} className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-md shadow-sm transition-all flex items-center gap-1" title="Import JSON from PC">
                    <Upload size={14} /> Import JSON
                </button>
           </div>

           <button 
             onClick={openImportModal}
             className="px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center gap-2"
           >
              <Sparkles size={16} />
              {t.glossary.importBtn}
           </button>
           <button 
             onClick={handleCreateSet}
             className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2"
           >
              <Plus size={16} />
              {t.glossary.createBtn}
           </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        {activeSet ? (
          // Detail View
          <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col shadow-sm overflow-hidden">
             {/* Toolbar */}
             <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-4 bg-slate-50 dark:bg-slate-900">
                <button onClick={() => setActiveSetId(null)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                   <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                </button>
                <div className="flex-1">
                   <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100">{activeSet.title}</h3>
                   <div className="flex gap-2 text-xs mt-0.5">
                     {activeSet.tags.map(tag => (
                       <span key={tag} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded">{tag}</span>
                     ))}
                   </div>
                </div>
                
                {selectedItems.length > 0 && (
                     <button onClick={initiateBulkDelete} className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md text-sm hover:bg-red-100 flex items-center gap-2 mr-2">
                         <Trash2 size={16} /> {t.glossary.deleteSelected} ({selectedItems.length})
                     </button>
                )}

                <div className="flex gap-2">
                   <button onClick={handleAddItem} className="px-3 py-1.5 bg-indigo-600 text-white rounded-md text-sm hover:bg-indigo-700 flex items-center gap-2">
                      <Plus size={16} /> {t.glossary.detail.addItem}
                   </button>
                </div>
             </div>

             {/* Items Table */}
             <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-sm">
                   <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium sticky top-0 z-10">
                      <tr>
                         <th className="p-4 w-12 text-center">
                             <button onClick={toggleSelectAll}>
                                 {activeSet.items.length > 0 && selectedItems.length === activeSet.items.length ? <CheckSquare size={16} /> : <Square size={16} />}
                             </button>
                         </th>
                         <th className="p-4 w-1/4">{t.glossary.detail.termHeader}</th>
                         <th className="p-4">{t.glossary.detail.defHeader}</th>
                         <th className="p-4 w-16"></th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {activeSet.items.length === 0 && (
                          <tr>
                              <td colSpan={4} className="p-12 text-center text-slate-400">
                                  {t.glossary.detail.empty}
                              </td>
                          </tr>
                      )}
                      {activeSet.items.map(item => (
                         <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 group">
                            <td className="p-3 text-center">
                                <button onClick={() => toggleSelect(item.id)} className="text-slate-400 hover:text-indigo-600">
                                    {selectedItems.includes(item.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                                </button>
                            </td>
                            <td className="p-3 align-top">
                               <input 
                                 className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 outline-none font-medium text-slate-800 dark:text-slate-200"
                                 value={item.term}
                                 onChange={(e) => handleUpdateItem(item.id, 'term', e.target.value)}
                               />
                            </td>
                            <td className="p-3 align-top">
                               <textarea 
                                 className="w-full bg-transparent border-b border-transparent focus:border-indigo-500 outline-none text-slate-600 dark:text-slate-400 resize-none h-auto overflow-hidden"
                                 value={item.definition}
                                 onChange={(e) => handleUpdateItem(item.id, 'definition', e.target.value)}
                                 rows={1}
                               />
                            </td>
                            <td className="p-3 text-right">
                               <button onClick={() => handleDeleteItem(item.id)} className="text-slate-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100">
                                 <Trash2 size={16} />
                               </button>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </div>
        ) : (
          // List View (Dashboard Style)
          <div className="flex-1 flex flex-col gap-4">
             {/* Search Bar */}
             <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-200 dark:border-slate-700 max-w-md shadow-sm">
                <Search size={18} className="text-slate-400 ml-2" />
                <input 
                  className="flex-1 bg-transparent outline-none text-sm text-slate-700 dark:text-slate-200"
                  placeholder={t.glossary.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && <button onClick={() => setSearchTerm('')}><X size={16} className="text-slate-400" /></button>}
             </div>

             {/* Table */}
             <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex-1 overflow-hidden flex flex-col">
                <div className="overflow-x-auto">
                   <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
                         <tr>
                            <th className="p-4 pl-6">{t.glossary.columns.name}</th>
                            <th className="p-4">{t.glossary.columns.tags}</th>
                            <th className="p-4">{t.glossary.columns.count}</th>
                            <th className="p-4">{t.glossary.columns.updated}</th>
                            <th className="p-4 text-right pr-6">{t.glossary.columns.actions}</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                         {filteredSets.map(set => (
                            <tr key={set.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onClick={() => setActiveSetId(set.id)}>
                               <td className="p-4 pl-6">
                                  <div className="font-semibold text-slate-800 dark:text-slate-100">{set.title}</div>
                                  <div className="text-xs text-slate-500 truncate max-w-[200px]">{set.description}</div>
                               </td>
                               <td className="p-4">
                                  <div className="flex gap-1 flex-wrap">
                                    {set.tags.map((tag, i) => (
                                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                               </td>
                               <td className="p-4 text-slate-600 dark:text-slate-400">
                                  <span className="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full text-xs font-bold">{set.items.length}</span>
                               </td>
                               <td className="p-4 text-slate-500 dark:text-slate-500 text-xs">
                                  {new Date(set.updatedAt).toLocaleDateString()}
                               </td>
                               <td className="p-4 text-right pr-6">
                                  <div className="flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                     <button onClick={(e) => handleEditSet(set, e)} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                                        <Edit size={14} />
                                     </button>
                                     <button onClick={(e) => initiateDeleteSet(set.id, e)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm">
                                        <Trash2 size={14} />
                                     </button>
                                  </div>
                               </td>
                            </tr>
                         ))}
                         {filteredSets.length === 0 && (
                            <tr>
                               <td colSpan={5} className="p-12 text-center text-slate-400">
                                  {t.glossary.noSetsFound}
                               </td>
                            </tr>
                         )}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlossaryManager;
