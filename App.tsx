import React, { useState, useEffect } from 'react';
import StepIndicator from './components/StepIndicator';
import FileUpload from './components/FileUpload';
import AnalysisView from './components/AnalysisView';
import FinalTranscript from './components/FinalTranscript';
import ChatWidget from './components/ChatWidget';
import GlossaryManager from './components/GlossaryManager';
import { AppStep, UploadedFiles, AnalysisResult, VocabItem, SubtitleItem, GlossaryItem, ViewMode } from './types';
import { analyzeSRTContent, generateFinalTranscript, generatePolishedSRT } from './services/geminiService';
import { parseSRTToObjects } from './utils/srtParser';
import { FileAudio, Layout, BookOpen, Settings, ChevronLeft, ChevronRight, Save, X, Eye, EyeOff, Globe, Moon, Sun, PanelLeftClose, PanelLeftOpen, Database, Trash2, LogOut } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { ConfigProvider, useConfig } from './contexts/ConfigContext';
import { initGoogleDrive } from './services/googleDriveService';
import { storage, StorageStats } from './services/storage';

// --- SETTINGS MODAL COMPONENT ---
const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; onOpenDataManager: () => void }> = ({ isOpen, onClose, onOpenDataManager }) => {
  const { t } = useLanguage();
  const { geminiApiKey, geminiBaseUrl, driveClientId, driveApiKey, updateConfig } = useConfig();
  const [showApiKey, setShowApiKey] = useState(false);
  const [showDriveKey, setShowDriveKey] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings size={20} className="text-indigo-600" />
            System Settings
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={24} /></button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Gemini Config */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Gemini API (LLM)</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">API Key</label>
              <div className="relative">
                <input 
                  type={showApiKey ? "text" : "password"}
                  className="w-full p-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                  value={geminiApiKey}
                  onChange={(e) => updateConfig('geminiApiKey', e.target.value)}
                  placeholder=""
                  autoComplete="off"
                />
                <button 
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Base URL (Optional)</label>
              <input 
                type="text"
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                value={geminiBaseUrl}
                onChange={(e) => updateConfig('geminiBaseUrl', e.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs text-slate-400 mt-1">Useful for compatible proxies. Leave empty to use Google's official endpoint.</p>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 my-2"></div>

          {/* Data Management Link */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
             <div>
               <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Local Data Storage</h4>
               <p className="text-xs text-slate-500">Manage IndexedDB storage size and history.</p>
             </div>
             <button 
               onClick={onOpenDataManager}
               className="text-sm px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
             >
               Manage
             </button>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 my-2"></div>

          {/* Drive Config */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Google Drive Integration</h3>
             <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Client ID</label>
              <input 
                type="text"
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                value={driveClientId}
                onChange={(e) => updateConfig('driveClientId', e.target.value)}
                placeholder="...apps.googleusercontent.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">API Key (Drive Scope)</label>
              <div className="relative">
                <input 
                    type={showDriveKey ? "text" : "password"}
                    className="w-full p-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                    value={driveApiKey}
                    onChange={(e) => updateConfig('driveApiKey', e.target.value)}
                    placeholder="AIza..."
                />
                <button 
                  type="button"
                  onClick={() => setShowDriveKey(!showDriveKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showDriveKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-xs text-slate-400 mt-1">Requires 'drive.file' scope enabled in Google Cloud Console. Usage is free for personal use.</p>
            </div>
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center gap-2"
          >
            <Save size={16} /> Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

// --- DATA MANAGEMENT MODAL ---
const DataManagementModal: React.FC<{ isOpen: boolean; onClose: () => void; onClearWorkspace: () => void }> = ({ isOpen, onClose, onClearWorkspace }) => {
  const { t } = useLanguage();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (isOpen) {
      storage.getStats().then(setStats);
    }
  }, [isOpen, refresh]);

  const handleClear = async (type: 'workspace' | 'chats') => {
    if (!confirm("Are you sure? This action is irreversible.")) return;
    
    if (type === 'workspace') {
      await storage.clear('projects');
      onClearWorkspace();
    } else {
      await storage.clear('chats');
      localStorage.removeItem('verbaflow_chats'); // Clear redundant legacy if exists
    }
    setRefresh(prev => prev + 1);
  };

  if (!isOpen) return null;

  return (
     <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
           <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Database size={20} className="text-indigo-600" />
            {t.data.title}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={24} /></button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t.data.desc}</p>
          
          <div className="space-y-4">
             {/* Workspace */}
             <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                <div>
                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t.data.workspace}</h4>
                   <p className="text-xs text-slate-500">{stats ? `${(stats.projectSize / 1024).toFixed(2)} KB` : '...'}</p>
                </div>
                <button onClick={() => handleClear('workspace')} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={t.data.clearBtn}>
                   <Trash2 size={18} />
                </button>
             </div>

             {/* Chats */}
             <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                <div>
                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t.data.chats}</h4>
                   <p className="text-xs text-slate-500">{stats ? `${stats.chatCount} ${t.data.count}` : '...'}</p>
                </div>
                <button onClick={() => handleClear('chats')} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={t.data.clearBtn}>
                   <Trash2 size={18} />
                </button>
             </div>
          </div>
        </div>
      </div>
     </div>
  );
};

// --- MAIN APP COMPONENT ---
const AppContent: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { geminiApiKey, geminiBaseUrl, driveClientId, driveApiKey } = useConfig();
  
  // Navigation & UI State
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.STUDIO);
  // Sidebar State: 'expanded' | 'collapsed' | 'hidden'
  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'hidden'>('expanded');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDataMgrOpen, setIsDataMgrOpen] = useState(false);
  
  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Studio Flow State
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  
  // Data State
  const [files, setFiles] = useState<UploadedFiles>({ audio: null, srt: null, srtContent: '' });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [confirmedVocab, setConfirmedVocab] = useState<VocabItem[]>([]);
  const [glossary, setGlossary] = useState<GlossaryItem[]>([]);
  
  // UI Loading State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [transcriptOutput, setTranscriptOutput] = useState('');
  
  // Settings
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [targetLanguage, setTargetLanguage] = useState('Chinese (Simplified)');
  
  // Media State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [parsedSubtitles, setParsedSubtitles] = useState<SubtitleItem[]>([]);

  // Toggle Dark Mode
  useEffect(() => {
    // Check initial system preference or saved state
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const toggleLanguage = () => {
      setLanguage(language === 'en' ? 'zh' : 'en');
  };

  // --- PERSISTENCE LOGIC (IndexedDB) ---
  // Load state on mount
  useEffect(() => {
    const loadState = async () => {
        try {
            const parsed = await storage.loadWorkspaceState();
            if (parsed) {
                if (parsed.step) setStep(parsed.step);
                // When restoring file content, we recreate the File object conceptually
                if (parsed.srtContent) setFiles(prev => ({ ...prev, srtContent: parsed.srtContent, srt: new File([parsed.srtContent], "restored.srt") }));
                if (parsed.analysisResult) setAnalysisResult(parsed.analysisResult);
                if (parsed.confirmedVocab) setConfirmedVocab(parsed.confirmedVocab);
                if (parsed.glossary) setGlossary(parsed.glossary);
                if (parsed.transcriptOutput) setTranscriptOutput(parsed.transcriptOutput);
                
                if (parsed.srtContent) {
                    setParsedSubtitles(parseSRTToObjects(parsed.srtContent));
                }
            }
        } catch (e) {
            console.error("Failed to restore workspace state from DB", e);
        }
    };
    loadState();
  }, []);

  // Save state on change
  useEffect(() => {
    const stateToSave = {
      step,
      srtContent: files.srtContent,
      analysisResult,
      confirmedVocab,
      glossary,
      transcriptOutput
    };
    // Debounce slightly 
    const timer = setTimeout(() => {
        storage.saveWorkspaceState(stateToSave);
    }, 1000);
    return () => clearTimeout(timer);
  }, [step, files.srtContent, analysisResult, confirmedVocab, glossary, transcriptOutput]);


  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // Init Drive
  useEffect(() => {
    if (driveClientId && driveApiKey) {
      initGoogleDrive(driveClientId, driveApiKey);
    }
  }, [driveClientId, driveApiKey]);

  // Step 1 -> 2: Start Analysis
  const handleStartAnalysis = async () => {
    runAnalysis(files.srtContent, selectedModel, targetLanguage, "", glossary);
  };

  const runAnalysis = async (content: string, model: string, lang: string, context: string, gloss: GlossaryItem[]) => {
    if (!content) return;
    if (!geminiApiKey) {
      setIsSettingsOpen(true);
      alert("Please configure your API Key first.");
      return;
    }
    
    if (files.audio && !audioUrl) {
      setAudioUrl(URL.createObjectURL(files.audio));
    }
    // If we restored from state, we might have content but no audio URL yet, handled by user re-upload or just text mode
    if (parsedSubtitles.length === 0) {
      setParsedSubtitles(parseSRTToObjects(content));
    }

    setStep(AppStep.ANALYSIS);
    setIsAnalyzing(true);
    
    try {
      const result = await analyzeSRTContent(content, model, lang, geminiApiKey, geminiBaseUrl, context, gloss);
      setAnalysisResult(result);
      setStep(AppStep.CONFIRMATION);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert(t.errors.analysisFailed);
      setStep(AppStep.UPLOAD);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Step 3 Actions
  const handleReAnalyze = (context: string) => {
    runAnalysis(files.srtContent, selectedModel, targetLanguage, context, glossary);
  };

  // Step 3 -> 4: Generate SRT
  const handleConfirmVocab = async (vocab: VocabItem[], context: string) => {
    if (!geminiApiKey) { setIsSettingsOpen(true); return; }
    setConfirmedVocab(vocab);
    setStep(AppStep.GENERATION_SRT);
    setIsGenerating(true);
    setTranscriptOutput('');

    try {
      await generatePolishedSRT(files.srtContent, vocab, selectedModel, geminiApiKey, geminiBaseUrl, (chunk) => {
        setTranscriptOutput(prev => prev + chunk);
      });
    } catch (error) {
      console.error("SRT Gen failed:", error);
      alert(t.errors.generationFailed);
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 4 -> 5: Generate MD
  const handleProceedToMD = async () => {
    if (!geminiApiKey) { setIsSettingsOpen(true); return; }
    setStep(AppStep.GENERATION_MD);
    setIsGenerating(true);
    setTranscriptOutput('');

    try {
      await generateFinalTranscript(files.srtContent, confirmedVocab, selectedModel, targetLanguage, geminiApiKey, geminiBaseUrl, (chunk) => {
        setTranscriptOutput(prev => prev + chunk);
      });
    } catch (error) {
      console.error("MD Gen failed:", error);
      alert(t.errors.generationFailed);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRestart = async () => {
    if(confirm("Are you sure? This will clear current progress.")) {
        setStep(AppStep.UPLOAD);
        setFiles({ audio: null, srt: null, srtContent: '' });
        setAnalysisResult(null);
        setTranscriptOutput('');
        setConfirmedVocab([]);
        setParsedSubtitles([]);
        if (audioUrl) {
           URL.revokeObjectURL(audioUrl);
           setAudioUrl(null);
        }
        await storage.delete('projects', 'current');
    }
  };
  
  const handleClearWorkspace = () => {
      setStep(AppStep.UPLOAD);
      setFiles({ audio: null, srt: null, srtContent: '' });
      setAnalysisResult(null);
      setTranscriptOutput('');
      setConfirmedVocab([]);
      setParsedSubtitles([]);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      {/* Settings & Data Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onOpenDataManager={() => { setIsSettingsOpen(false); setIsDataMgrOpen(true); }}
      />
      <DataManagementModal 
        isOpen={isDataMgrOpen} 
        onClose={() => setIsDataMgrOpen(false)} 
        onClearWorkspace={handleClearWorkspace}
      />

      {/* Sidebar - Dynamically rendered based on state */}
      {sidebarState !== 'hidden' && (
        <aside className={`${sidebarState === 'collapsed' ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col shrink-0 transition-all duration-300 shadow-xl z-20`}>
            
            {/* Sidebar Header */}
            <div className={`p-4 border-b border-slate-800 flex ${sidebarState === 'collapsed' ? 'justify-center' : 'justify-between items-center'}`}>
            {sidebarState === 'expanded' && (
                <div className="flex items-center gap-2 overflow-hidden">
                <div className="bg-indigo-600 p-1.5 rounded-lg text-white flex-shrink-0">
                    <FileAudio size={20} />
                </div>
                <div className="truncate">
                    <h1 className="text-lg font-bold text-white tracking-tight leading-none">VerbaFlow</h1>
                    <p className="text-[10px] text-slate-500 leading-none mt-1">AI Studio</p>
                </div>
                </div>
            )}
            {sidebarState === 'collapsed' && (
                <div className="bg-indigo-600 p-2 rounded-lg text-white" title="VerbaFlow">
                  <FileAudio size={24} />
                </div>
            )}
            
            {/* Toggle Button in Header (Only Visible in Expanded for collapse) */}
            {sidebarState === 'expanded' && (
                <button 
                    onClick={() => setSidebarState('collapsed')}
                    className="text-slate-500 hover:text-white transition-colors p-1"
                    title={t.nav.collapse}
                >
                    <ChevronLeft size={20} />
                </button>
            )}
            </div>

            {/* Nav Items */}
            <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
            <button 
                onClick={() => setViewMode(ViewMode.STUDIO)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${
                viewMode === ViewMode.STUDIO 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                } ${sidebarState === 'collapsed' ? 'justify-center' : ''}`}
                title={sidebarState === 'collapsed' ? t.nav.studio : ''}
            >
                <Layout size={20} />
                {sidebarState === 'expanded' && <span className="font-medium text-sm">{t.nav.studio}</span>}
            </button>

            <button 
                onClick={() => setViewMode(ViewMode.GLOSSARY)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${
                viewMode === ViewMode.GLOSSARY 
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' 
                    : 'hover:bg-slate-800 text-slate-400 hover:text-white'
                } ${sidebarState === 'collapsed' ? 'justify-center' : ''}`}
                title={sidebarState === 'collapsed' ? t.nav.glossary : ''}
            >
                <BookOpen size={20} />
                {sidebarState === 'expanded' && <span className="font-medium text-sm">{t.nav.glossary}</span>}
            </button>
            </nav>

            {/* Footer Group (Settings, Data, Lang, Theme, Hide) */}
            <div className="p-3 border-t border-slate-800 flex flex-col gap-2">
                
                {/* Settings & Data Links */}
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative hover:bg-slate-800 text-slate-400 hover:text-white ${sidebarState === 'collapsed' ? 'justify-center' : ''}`}
                    title={t.config.title}
                >
                    <Settings size={20} />
                    {sidebarState === 'expanded' && <span className="font-medium text-sm">{t.config.title}</span>}
                </button>

                <button 
                    onClick={() => setIsDataMgrOpen(true)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative hover:bg-slate-800 text-slate-400 hover:text-white ${sidebarState === 'collapsed' ? 'justify-center' : ''}`}
                    title={t.nav.data}
                >
                    <Database size={20} />
                    {sidebarState === 'expanded' && <span className="font-medium text-sm">{t.nav.data}</span>}
                </button>

                <div className="border-t border-slate-800 my-1"></div>

                {sidebarState === 'expanded' ? (
                    <div className="space-y-3 px-1">
                         {/* Language Switcher Expanded */}
                        <div className="flex justify-center bg-slate-800 rounded-lg p-1">
                            <button 
                                onClick={() => setLanguage('en')}
                                className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${language === 'en' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                EN
                            </button>
                            <button 
                                onClick={() => setLanguage('zh')}
                                className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${language === 'zh' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                中文
                            </button>
                        </div>
                        
                        <div className="flex gap-2">
                            {/* Dark Mode Expanded */}
                            <button 
                                onClick={toggleDarkMode}
                                className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                                {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                                {isDarkMode ? "Light" : "Dark"}
                            </button>
                            {/* Hide Sidebar Expanded */}
                             <button 
                                onClick={() => setSidebarState('hidden')}
                                className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                                title={t.nav.hide}
                            >
                                <PanelLeftClose size={14} />
                                Hide
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 items-center">
                        {/* Language Toggle Collapsed */}
                        <button 
                             onClick={toggleLanguage}
                             className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                             title="Switch Language"
                        >
                            <Globe size={20} />
                        </button>
                        {/* Dark Mode Toggle Collapsed */}
                        <button 
                            onClick={toggleDarkMode}
                            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                            title="Toggle Theme"
                        >
                             {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                        </button>
                        {/* Hide Sidebar Collapsed */}
                         <button 
                             onClick={() => setSidebarState('hidden')}
                             className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                             title={t.nav.hide}
                        >
                            <PanelLeftClose size={20} />
                        </button>
                        {/* Expand Button for Collapsed Mode (Optional, can just click sidebar header/body) */}
                        <button 
                             onClick={() => setSidebarState('expanded')}
                             className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                             title={t.nav.expand}
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                )}
            </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
         {/* Sidebar Restore Button (Only when hidden) */}
         {sidebarState === 'hidden' && (
             <div className="absolute top-4 left-4 z-30">
                 <button 
                    onClick={() => setSidebarState('expanded')}
                    className="p-2 bg-slate-900 text-white rounded-lg shadow-lg hover:bg-indigo-600 transition-colors flex items-center gap-2"
                    title={t.nav.show}
                 >
                    <PanelLeftOpen size={20} />
                 </button>
             </div>
         )}

        <main className="flex-1 overflow-auto">
          {viewMode === ViewMode.STUDIO && (
            <div className="pb-20">
              <StepIndicator currentStep={step} />
              <div className="px-6 md:px-8">
                {step === AppStep.UPLOAD && (
                  <FileUpload 
                    files={files} 
                    setFiles={setFiles} 
                    onNext={handleStartAnalysis}
                    selectedModel={selectedModel}
                    onModelChange={setSelectedModel}
                    targetLanguage={targetLanguage}
                    onLanguageChange={setTargetLanguage}
                  />
                )}

                {(step === AppStep.ANALYSIS || step === AppStep.CONFIRMATION) && (
                  <AnalysisView 
                    data={analysisResult!}
                    isLoading={isAnalyzing}
                    onConfirm={handleConfirmVocab}
                    onRetry={handleStartAnalysis}
                    onReAnalyze={handleReAnalyze}
                    audioUrl={audioUrl}
                    subtitles={parsedSubtitles}
                    onOpenGlossary={() => setViewMode(ViewMode.GLOSSARY)}
                    hasGlossary={glossary.length > 0}
                  />
                )}

                {(step === AppStep.GENERATION_SRT || step === AppStep.GENERATION_MD) && (
                  <FinalTranscript 
                    content={transcriptOutput} 
                    isGenerating={isGenerating}
                    onRestart={handleRestart}
                    currentStep={step}
                    onNextStep={step === AppStep.GENERATION_SRT ? handleProceedToMD : undefined}
                  />
                )}
              </div>
            </div>
          )}

          {viewMode === ViewMode.GLOSSARY && (
            <GlossaryManager 
              glossary={glossary}
              setGlossary={setGlossary}
              srtContent={files.srtContent}
              vocabList={analysisResult?.vocabList || []}
              modelName={selectedModel}
              language={targetLanguage}
            />
          )}
        </main>
        
        {/* Chat Overlay */}
        <ChatWidget />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider>
      <AppContent />
    </ConfigProvider>
  );
};

export default App;
