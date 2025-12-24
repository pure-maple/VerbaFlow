import React, { useState } from 'react';
import { GlossaryItem, VocabItem } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useConfig } from '../contexts/ConfigContext';
import { Upload, Sparkles, Download, BookOpen, HardDrive, Trash2, Loader2 } from 'lucide-react';
import { generateSmartGlossary } from '../services/geminiService';
import { saveToDrive } from '../services/googleDriveService';

interface Props {
  glossary: GlossaryItem[];
  setGlossary: (items: GlossaryItem[]) => void;
  srtContent: string;
  vocabList: VocabItem[];
  modelName: string;
  language: string;
}

const GlossaryManager: React.FC<Props> = ({ 
  glossary, setGlossary, srtContent, vocabList, modelName, language 
}) => {
  const { t } = useLanguage();
  const { geminiApiKey, geminiBaseUrl } = useConfig();
  const [isGenerating, setIsGenerating] = useState(false);
  const [importText, setImportText] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSmartExport = async () => {
    if (!srtContent) {
        alert("No content available to analyze. Please upload and analyze a file in the Studio first.");
        return;
    }
    
    if (!geminiApiKey) {
        alert("Please configure API Key in settings.");
        return;
    }

    setIsGenerating(true);
    try {
      const newTerms = await generateSmartGlossary(srtContent, vocabList, modelName, language, geminiApiKey, geminiBaseUrl);
      const combined = [...glossary, ...newTerms.filter(n => !glossary.some(g => g.term === n.term))];
      setGlossary(combined);
    } catch (e) {
      console.error(e);
      alert("Failed to generate glossary");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualImport = () => {
    const lines = importText.split('\n');
    const newItems: GlossaryItem[] = lines
      .filter(l => l.trim())
      .map((line, idx) => {
        const [term, def] = line.split(/[\t,:]+/);
        return {
          id: `manual-${Date.now()}-${idx}`,
          term: term?.trim(),
          definition: def?.trim() || "Imported term",
          selected: true
        };
      });
    
    if (newItems.length > 0) {
      setGlossary([...glossary, ...newItems]);
      setImportText("");
    }
  };

  const handleDownload = () => {
    const json = JSON.stringify(glossary, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'verbaflow_glossary.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleDriveSync = async () => {
    setIsSaving(true);
    try {
      const content = JSON.stringify(glossary, null, 2);
      await saveToDrive(content, `verbaflow_glossary_${Date.now()}.json`, 'application/json');
      alert("Glossary synced to Google Drive!");
    } catch (e: any) {
      console.error(e);
      alert(`Drive sync failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setGlossary(glossary.filter(g => g.id !== id));
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <BookOpen className="text-indigo-600 dark:text-indigo-400" />
              {t.glossary.title}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Manage standard definitions and technical terms reused across projects.</p>
          </div>
          
          <div className="flex gap-2">
            <button 
                onClick={handleDriveSync} 
                disabled={isSaving}
                className={`px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 ${isSaving ? 'opacity-50' : ''}`}
            >
                {isSaving ? <Loader2 size={16} className="animate-spin"/> : <HardDrive size={16} />} 
                {t.glossary.driveSync}
            </button>
            <button 
                onClick={handleDownload} 
                className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white rounded-lg text-sm font-semibold hover:bg-slate-900 dark:hover:bg-slate-600 flex items-center gap-2"
                disabled={glossary.length === 0}
            >
                <Download size={16} /> JSON
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main List */}
          <div className="lg:col-span-2 space-y-4">
             {isGenerating ? (
               <div className="py-20 text-center text-indigo-600 dark:text-indigo-400 animate-pulse bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-indigo-200 dark:border-indigo-800">
                 <Sparkles className="mx-auto mb-4 h-8 w-8" />
                 <p className="font-medium">{t.glossary.analyzing}</p>
               </div>
             ) : (
               <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
                 {glossary.length === 0 ? (
                   <div className="p-12 text-center text-slate-400 dark:text-slate-500">
                      <BookOpen className="mx-auto h-12 w-12 text-slate-200 dark:text-slate-700 mb-4" />
                      <p>{t.glossary.empty}</p>
                   </div>
                 ) : (
                   <table className="w-full text-sm text-left">
                     <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs uppercase font-semibold">
                       <tr>
                         <th className="p-4 w-1/4">{t.glossary.term}</th>
                         <th className="p-4">{t.glossary.definition}</th>
                         <th className="w-16 p-4"></th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                       {glossary.map(g => (
                         <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                           <td className="p-4 font-bold text-slate-800 dark:text-slate-200 align-top">{g.term}</td>
                           <td className="p-4 text-slate-600 dark:text-slate-400 align-top leading-relaxed">{g.definition}</td>
                           <td className="p-4 text-right align-top">
                             <button onClick={() => handleDelete(g.id)} className="text-slate-300 hover:text-red-500 dark:hover:text-red-400 transition-colors p-1">
                               <Trash2 size={16}/>
                             </button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 )}
               </div>
             )}
          </div>

          {/* Sidebar Actions */}
          <div className="space-y-6">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900 shadow-sm">
              <h3 className="font-bold text-indigo-900 dark:text-indigo-300 mb-2 flex items-center gap-2">
                <Sparkles size={18} /> {t.glossary.exportBtn}
              </h3>
              <p className="text-xs text-indigo-700 dark:text-indigo-400 mb-4 leading-relaxed">
                Use AI to analyze the current transcript in the Studio and extract a professional glossary list automatically.
              </p>
              <button 
                onClick={handleSmartExport}
                disabled={isGenerating || !srtContent}
                className="w-full py-2.5 bg-indigo-600 dark:bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm transition-all"
              >
                Generate from Studio Content
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
                <Upload size={18} /> {t.glossary.importBtn}
              </h3>
              <textarea 
                className="w-full h-40 p-3 text-sm border border-slate-300 dark:border-slate-600 rounded-lg mb-3 focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors"
                placeholder="Term 1: Definition...&#10;Term 2: Definition..."
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <button 
                onClick={handleManualImport}
                disabled={!importText}
                className="w-full py-2.5 bg-slate-800 dark:bg-slate-700 text-white rounded-lg hover:bg-slate-900 dark:hover:bg-slate-600 disabled:opacity-50 font-medium transition-all"
              >
                Add Items
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlossaryManager;
