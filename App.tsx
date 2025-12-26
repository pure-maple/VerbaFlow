
import React, { useState, useEffect, useRef } from 'react';
import StepIndicator from './components/StepIndicator';
import FileUpload from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import FinalTranscript from './components/FinalTranscript';
import ChatWidget from './components/ChatWidget';
import GlossaryManager from './components/GlossaryManager';
import AgentManager from './components/AgentManager';
import ProjectList from './components/ProjectList';
import { AppStep, UploadedFiles, AnalysisResult, VocabItem, SubtitleItem, GlossaryItem, ViewMode, GlossarySet, AnalyzeSelection } from './types';
import { AnalysisSession, generateFinalTranscript, generatePolishedSubtitle } from './services/geminiService';
import { parseSubtitleToObjects } from './utils/srtParser';
import { FileAudio, Layout, BookOpen, Settings, ChevronLeft, ChevronRight, Save, X, Eye, EyeOff, Globe, Moon, Sun, PanelLeftClose, PanelLeftOpen, Database, Trash2, LogOut, Bot, Loader2, Copy, AlertTriangle, Key, ExternalLink, Download, Upload, FileJson, ArrowLeft, Server } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { ConfigProvider, useConfig, LLMProvider } from './contexts/ConfigContext';
import { Part } from "@google/genai";
// import { initGoogleDrive, setManualAccessToken } from './services/googleDriveService'; // Drive Temporarily Disabled
import { storage, StorageStats } from './services/storage';
import { ConfirmationModal } from './components/ConfirmationModal';
import { Toast, ToastType } from './components/Toast';

// ... (DataManagementModal remain same) ...
// --- SETTINGS MODAL COMPONENT ---
const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; onOpenDataManager: () => void }> = ({ isOpen, onClose, onOpenDataManager }) => {
  const { t } = useLanguage();
  const { llmApiKey, llmBaseUrl, llmProvider, driveClientId, driveApiKey, manualDriveToken, updateConfig } = useConfig();
  const [showApiKey, setShowApiKey] = useState(false);

  // Constants for Providers (Updated to strict list)
  const providers: LLMProvider[] = ['Gemini', 'OpenAI', 'Anthropic'];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings size={20} className="text-indigo-600" />
            {t.config.systemSettings}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={24} /></button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* LLM Provider Config */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Server size={14} /> {t.config.geminiSection}
            </h3>
            
            {/* Provider Dropdown */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.config.providerLabel}</label>
                <div className="relative">
                    <select
                        className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors appearance-none cursor-pointer"
                        value={llmProvider}
                        onChange={(e) => updateConfig('llmProvider', e.target.value)}
                    >
                        {providers.map(p => (
                            <option key={p} value={p}>{p}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                        <ChevronLeft size={16} className="-rotate-90" />
                    </div>
                </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.config.apiKey}</label>
              <div className="relative">
                <input 
                  type={showApiKey ? "text" : "password"}
                  className="w-full p-2 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                  value={llmApiKey}
                  onChange={(e) => updateConfig('llmApiKey', e.target.value)}
                  placeholder="sk-..."
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.config.baseUrl}</label>
              <input 
                type="text"
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors placeholder:text-slate-400"
                value={llmBaseUrl}
                onChange={(e) => updateConfig('llmBaseUrl', e.target.value)}
                placeholder={llmProvider === 'OpenAI' ? "https://api.openai.com/v1" : llmProvider === 'Anthropic' ? "https://api.anthropic.com/v1" : ""}
              />
              <p className="text-xs text-slate-500 mt-1">{t.config.baseUrlHelp}</p>
            </div>

            {/* Multimodal Warning */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 p-3 rounded-lg flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <p>{t.config.multimodalWarning}</p>
            </div>
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700 my-2"></div>

          {/* Data Management Link */}
          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
             <div>
               <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.config.storageSection}</h4>
               <p className="text-xs text-slate-500">{t.config.storageDesc}</p>
             </div>
             <button 
               onClick={onOpenDataManager}
               className="text-sm px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
             >
               {t.config.manageBtn}
             </button>
          </div>

        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors"
          >
            {t.common.cancel}
          </button>
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center gap-2"
          >
            <Save size={16} /> {t.common.confirm}
          </button>
        </div>
      </div>
    </div>
  );
};

// DataManagementModal with LITE Export/Import Logic
const DataManagementModal: React.FC<{ isOpen: boolean; onClose: () => void; onClearWorkspace: () => void }> = ({ isOpen, onClose, onClearWorkspace }) => {
  const { t, language } = useLanguage();
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [refresh, setRefresh] = useState(0);
  
  const [confirmType, setConfirmType] = useState<'workspace' | 'chats' | 'glossary' | null>(null);

  useEffect(() => {
    if (isOpen) {
      storage.getStats().then(setStats);
    }
  }, [isOpen, refresh]);

  const initiateClear = (type: 'workspace' | 'chats' | 'glossary') => {
      setConfirmType(type);
  };

  const handleConfirmClear = async () => {
    if (!confirmType) return;
    
    if (confirmType === 'workspace') {
      await storage.clear('projects');
      onClearWorkspace();
    } else if (confirmType === 'chats') {
      await storage.clear('chats');
    } else if (confirmType === 'glossary') {
       await storage.clear('glossary');
    }
    setRefresh(prev => prev + 1);
    setConfirmType(null);
  };

  if (!isOpen) return null;

  return (
     <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <ConfirmationModal
         isOpen={!!confirmType}
         onClose={() => setConfirmType(null)}
         onConfirm={handleConfirmClear}
         title="Clear Data"
         message="Are you sure? This action is irreversible and will permanently delete your data."
         isDanger={true}
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
           <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Database size={20} className="text-indigo-600" />
            {t.data.title}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={24} /></button>
        </div>
        
        <div className="p-6">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-semibold">{language === 'zh' ? '浏览器存储状态:' : 'Browser Storage Stats:'}</p>
          
          <div className="space-y-4">
             {/* Workspace */}
             <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                <div>
                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t.data.workspace}</h4>
                   <p className="text-xs text-slate-500">{stats ? `${stats.projectCount} Projects` : '...'}</p>
                </div>
                <button onClick={() => initiateClear('workspace')} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={t.data.clearBtn}>
                   <Trash2 size={18} />
                </button>
             </div>

             {/* Chats */}
             <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                <div>
                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t.data.chats}</h4>
                   <p className="text-xs text-slate-500">{stats ? `${stats.chatCount} ${t.data.unit}` : '...'}</p>
                </div>
                <button onClick={() => initiateClear('chats')} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={t.data.clearBtn}>
                   <Trash2 size={18} />
                </button>
             </div>

             {/* Glossary Stats */}
             <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                <div>
                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t.data.glossarySets}</h4>
                   <p className="text-xs text-slate-500">{stats ? `${stats.glossaryCount} ${t.data.unitSets}` : '...'}</p>
                </div>
                <button onClick={() => initiateClear('glossary')} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title={t.data.clearBtn}>
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
  const { llmApiKey, llmBaseUrl, llmProvider, driveClientId, driveApiKey, manualDriveToken } = useConfig();
  
  // Navigation & UI State
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.STUDIO);
  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'hidden'>('expanded');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDataMgrOpen, setIsDataMgrOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false); 

  // Project Management State
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);

  // Studio Flow State
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  
  // Data State
  const [files, setFiles] = useState<UploadedFiles>({ 
    audio: null, audioSource: 'local', 
    video: null, videoSource: 'local', 
    srt: null, srtSource: 'local', srtContent: '' 
  });
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [confirmedVocab, setConfirmedVocab] = useState<VocabItem[]>([]);
  const [glossarySets, setGlossarySets] = useState<GlossarySet[]>([]);
  const [selectedGlossaryIds, setSelectedGlossaryIds] = useState<string[]>([]);
  
  // UI Loading State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // OUTPUT STATES (Separated)
  const [subtitleOutput, setSubtitleOutput] = useState('');
  const [markdownOutput, setMarkdownOutput] = useState('');
  
  // Settings
  const [selectedModel, setSelectedModel] = useState('gemini-3-pro-preview');
  const [targetLanguage, setTargetLanguage] = useState('Chinese (Simplified)');
  
  // Media State
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [parsedSubtitles, setParsedSubtitles] = useState<SubtitleItem[]>([]);

  // Agent State
  const [agentPrompt, setAgentPrompt] = useState<string | null>(null);

  // Project Session Ref (Maintains Context)
  const projectSessionRef = useRef<AnalysisSession | null>(null);

  // Restart Confirmation
  const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState<{message: string, type: ToastType, isVisible: boolean}>({
      message: '', type: 'info', isVisible: false
  });

  const showToast = (message: string, type: ToastType = 'info') => {
      setToast({ message, type, isVisible: true });
  };

  // Toggle Dark Mode
  useEffect(() => {
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

  // --- PERSISTENCE LOGIC (IndexedDB with Dexie) ---
  
  // Initial Load Glossary Sets only (Projects handled in ProjectList component)
  useEffect(() => {
    const loadGlobal = async () => {
        try {
            const sets = await storage.getAllGlossarySets();
            if (sets) setGlossarySets(sets);
        } catch(e) {
            console.error("Glossary load error:", e);
        }
    };
    loadGlobal();
  }, []);

  // Save Lightweight State (Debounced) - Only when project is active
  useEffect(() => {
    if (isRestoring || !currentProjectId) return;
    
    const stateToSave = {
      name: currentProjectName || 'Untitled Project',
      step,
      srtContent: files.srtContent,
      analysisResult,
      confirmedVocab,
      subtitleOutput,
      markdownOutput
    };
    
    const timer = setTimeout(() => {
        storage.saveWorkspaceState(currentProjectId, stateToSave);
    }, 1500);
    return () => clearTimeout(timer);
  }, [currentProjectId, currentProjectName, step, files.srtContent, analysisResult, confirmedVocab, subtitleOutput, markdownOutput, isRestoring]);

  // Save Files Separately (When file objects change)
  useEffect(() => {
      if (isRestoring || !currentProjectId) return;
      // We save if ANY source is present (local or drive)
      if (files.audio || files.audioDriveId || files.video || files.videoDriveId || files.srt || files.srtDriveId) {
          storage.saveFiles(
              currentProjectId,
              { file: files.audio, source: files.audioSource, driveId: files.audioDriveId },
              { file: files.video, source: files.videoSource, driveId: files.videoDriveId },
              { file: files.srt, source: files.srtSource, driveId: files.srtDriveId }
          );
      }
  }, [files, isRestoring, currentProjectId]);

  // --- Automatic Parsing & Sync ---
  useEffect(() => {
    if (files.srtContent) {
        setParsedSubtitles(parseSubtitleToObjects(files.srtContent));
    } else {
        setParsedSubtitles([]);
    }
  }, [files.srtContent]);

  // --- Media URL Management ---
  useEffect(() => {
    if (files.audio && !audioUrl) {
        const url = URL.createObjectURL(files.audio);
        setAudioUrl(url);
    }
    return () => {};
  }, [files.audio]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]); 

  useEffect(() => {
    return () => {
      if (previewVideoUrl) URL.revokeObjectURL(previewVideoUrl);
    };
  }, [previewVideoUrl]);


  // Helper: Convert File/Blob to Base64 Part for Gemini
  const fileToGenerativePart = async (file: File | Blob): Promise<Part> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
              const base64String = reader.result as string;
              // Remove data URL prefix (e.g. "data:video/mp4;base64,")
              const base64Data = base64String.split(',')[1];
              resolve({
                  inlineData: {
                      data: base64Data,
                      mimeType: file.type
                  }
              });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
      });
  };

  // --- Project Management Actions ---

  const handleCreateProject = async (name: string) => {
      setIsRestoring(true);
      try {
          const id = await storage.createProject(name);
          // Manually reset state without triggering heavy file saves yet
          setStep(AppStep.UPLOAD);
          setFiles({ 
            audio: null, audioSource: 'local', 
            video: null, videoSource: 'local', 
            srt: null, srtSource: 'local', srtContent: '' 
          });
          setAnalysisResult(null);
          setSubtitleOutput('');
          setMarkdownOutput('');
          setConfirmedVocab([]);
          
          setCurrentProjectId(id);
          setCurrentProjectName(name);
          showToast(t.messages.projectCreated, 'success');
      } catch (e) {
          console.error(e);
          showToast(t.messages.projectCreateFailed, 'error');
      } finally {
          setIsRestoring(false);
      }
  };

  const handleOpenProject = async (id: string) => {
      setIsRestoring(true);
      try {
          const state = await storage.loadWorkspaceState(id);
          if (!state) throw new Error("Project not found");

          const loadedFiles = await storage.loadFiles(id);

          // Update State
          setCurrentProjectId(id);
          setCurrentProjectName(state.name);
          setStep(state.step);
          setAnalysisResult(state.analysisResult);
          setConfirmedVocab(state.confirmedVocab);
          setSubtitleOutput(state.subtitleOutput);
          setMarkdownOutput(state.markdownOutput);
          
          if (loadedFiles) {
              setFiles({
                  audio: loadedFiles.audio.file,
                  audioSource: loadedFiles.audio.source,
                  audioDriveId: loadedFiles.audio.driveId,
                  
                  video: loadedFiles.video.file,
                  videoSource: loadedFiles.video.source,
                  videoDriveId: loadedFiles.video.driveId,
                  
                  srt: loadedFiles.srt.file,
                  srtSource: loadedFiles.srt.source,
                  srtDriveId: loadedFiles.srt.driveId,
                  
                  srtContent: state.srtContent,
              });
          } else {
              setFiles(prev => ({ ...prev, srtContent: state.srtContent }));
          }
          // showToast("Project loaded", 'success');
      } catch (e) {
          console.error(e);
          showToast(t.messages.projectLoadFailed, 'error');
          setCurrentProjectId(null);
      } finally {
          setIsRestoring(false);
      }
  };

  const handleBackToProjects = () => {
      setCurrentProjectId(null);
      // Optional: Clear heavy memory?
      if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
      if (previewVideoUrl) { URL.revokeObjectURL(previewVideoUrl); setPreviewVideoUrl(null); }
  };

  const handleClearWorkspace = () => {
      setStep(AppStep.UPLOAD);
      setFiles({ 
        audio: null, audioSource: 'local', 
        video: null, videoSource: 'local', 
        srt: null, srtSource: 'local', srtContent: '' 
      });
      setAnalysisResult(null);
      setSubtitleOutput('');
      setMarkdownOutput('');
      setConfirmedVocab([]);
      projectSessionRef.current = null; // Clear session
      if (audioUrl) { URL.revokeObjectURL(audioUrl); setAudioUrl(null); }
      if (previewVideoUrl) { URL.revokeObjectURL(previewVideoUrl); setPreviewVideoUrl(null); }
  };

  // Actions (Analysis & Generation) - Same logic as before
  const handleStartAnalysis = async (selection: AnalyzeSelection) => {
    if (!files.srtContent && !selection.video && !selection.audio) {
        setAnalysisResult({
            summary: { topic: "Local Media Preview", speakers: [], duration: "", agenda: [] },
            vocabList: []
        });
        setStep(AppStep.CONFIRMATION);
        return;
    }

    if (!llmApiKey) { setIsSettingsOpen(true); return; }

    const activeGlossaryItems = glossarySets
        .filter(set => selectedGlossaryIds.includes(set.id))
        .flatMap(s => s.items);

    if (files.audio && !audioUrl) setAudioUrl(URL.createObjectURL(files.audio));

    setStep(AppStep.CONFIRMATION);
    setIsAnalyzing(true);
    
    try {
        const mediaParts: Part[] = [];
        if (selection.video && files.video) {
             const part = await fileToGenerativePart(files.video);
             mediaParts.push(part);
        }
        if (selection.audio && files.audio) {
             const part = await fileToGenerativePart(files.audio);
             mediaParts.push(part);
        }

        projectSessionRef.current = new AnalysisSession(llmApiKey, llmBaseUrl, selectedModel, llmProvider);
        
        const result = await projectSessionRef.current.start(
            selection.srt ? files.srtContent : null, 
            mediaParts,
            targetLanguage, 
            activeGlossaryItems
        );
        
        setAnalysisResult(result);
    } catch (error: any) {
        console.error("Analysis failed:", error);
        showToast(error.message || t.messages.analysisFailed, 'error');
        setStep(AppStep.UPLOAD);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleReAnalyzeWithVocab = async (context: string, currentVocab?: VocabItem[]) => {
      if (!llmApiKey || !currentVocab) return;
      setIsAnalyzing(true);
      try {
          const activeGlossaryItems = glossarySets
            .filter(set => selectedGlossaryIds.includes(set.id))
            .flatMap(s => s.items);

          let result;
          if (projectSessionRef.current) {
              result = await projectSessionRef.current.iterate(
                  currentVocab, 
                  context, 
                  targetLanguage,
                  activeGlossaryItems
              );
          } else {
              projectSessionRef.current = new AnalysisSession(llmApiKey, llmBaseUrl, selectedModel, llmProvider);
              const fullContext = `User Previous State: ${JSON.stringify(currentVocab)}. New Instruction: ${context}`;
              result = await projectSessionRef.current.start(files.srtContent, [], targetLanguage, activeGlossaryItems, fullContext);
          }
          setAnalysisResult(result);
          showToast(t.messages.reAnalysisComplete, 'success');
      } catch (e: any) {
          console.error(e);
          showToast(e.message || t.messages.reAnalysisFailed, 'error');
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleConfirmVocab = async (vocab: VocabItem[], context: string, format: string) => {
    if (!llmApiKey) { setIsSettingsOpen(true); return; }
    setConfirmedVocab(vocab);
    setStep(AppStep.GENERATION_SRT);
    setIsGenerating(true);
    setSubtitleOutput('');

    try {
      const outputFormat = format || files.subtitleFormat || 'srt';
      await generatePolishedSubtitle(files.srtContent, vocab, selectedModel, outputFormat, llmApiKey, llmBaseUrl, llmProvider, (chunk) => {
        setSubtitleOutput(prev => prev + chunk);
      });
    } catch (error: any) {
      console.error(error);
      showToast(error.message || t.messages.generationFailed, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProceedToMD = async () => {
    if (!llmApiKey) { setIsSettingsOpen(true); return; }
    setStep(AppStep.GENERATION_MD);
    setIsGenerating(true);
    setMarkdownOutput('');

    try {
      await generateFinalTranscript(files.srtContent, confirmedVocab, selectedModel, targetLanguage, llmApiKey, llmBaseUrl, llmProvider, (chunk) => {
        setMarkdownOutput(prev => prev + chunk);
      });
    } catch (error: any) {
      console.error(error);
      showToast(error.message || t.messages.generationFailed, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRestartClick = () => {
      setIsRestartConfirmOpen(true);
  };

  const handleRestartConfirm = async () => {
      // In project mode, this just resets the workflow to Step 1, it doesn't delete the project
      // But we need to be careful not to nuke the project ID
      setStep(AppStep.UPLOAD);
      setAnalysisResult(null);
      setSubtitleOutput('');
      setMarkdownOutput('');
      setConfirmedVocab([]);
      projectSessionRef.current = null;
      showToast(t.messages.workspaceReset, 'info');
  };
  
  const handleStepClick = (targetStep: AppStep) => {
      if (targetStep === AppStep.UPLOAD) {
          setStep(targetStep);
      } else if (targetStep === AppStep.CONFIRMATION) {
          if (analysisResult) setStep(targetStep);
      } else if (targetStep === AppStep.GENERATION_SRT) {
          if (confirmedVocab.length > 0) setStep(targetStep);
      } else if (targetStep === AppStep.GENERATION_MD) {
           if (subtitleOutput && step >= AppStep.GENERATION_SRT) setStep(targetStep);
      }
  };

  if (isRestoring) {
      return (
          <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900 animate-in fade-in">
              <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-indigo-600" size={32} />
                  <p className="text-slate-500 dark:text-slate-400 font-medium">{t.common.loading}</p>
              </div>
          </div>
      );
  }

  const mainScrollClass = viewMode === ViewMode.AGENTS ? 'overflow-hidden' : 'overflow-auto';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />

      <ConfirmationModal 
          isOpen={isRestartConfirmOpen}
          onClose={() => setIsRestartConfirmOpen(false)}
          onConfirm={handleRestartConfirm}
          title="Restart Task"
          message="Are you sure? This will reset progress to Step 1."
          isDanger={true}
      />

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

      {/* Sidebar */}
      {sidebarState !== 'hidden' && (
        <aside className={`${sidebarState === 'collapsed' ? 'w-20' : 'w-64'} bg-slate-900 text-slate-300 flex flex-col shrink-0 transition-all duration-300 shadow-xl z-20`}>
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
            
            {sidebarState === 'expanded' && (
                <button onClick={() => setSidebarState('collapsed')} className="text-slate-500 hover:text-white transition-colors p-1">
                    <ChevronLeft size={20} />
                </button>
            )}
            </div>

            <nav className="flex-1 p-3 space-y-2 overflow-y-auto overflow-x-hidden">
            <button 
                onClick={() => setViewMode(ViewMode.STUDIO)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${
                viewMode === ViewMode.STUDIO ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 text-slate-400 hover:text-white'} ${sidebarState === 'collapsed' ? 'justify-center' : ''}`}
                title={sidebarState === 'collapsed' ? t.nav.studio : ''}
            >
                <Layout size={20} />
                {sidebarState === 'expanded' && <span className="font-medium text-sm">{t.nav.studio}</span>}
            </button>

            <button 
                onClick={() => setViewMode(ViewMode.GLOSSARY)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${
                viewMode === ViewMode.GLOSSARY ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 text-slate-400 hover:text-white'} ${sidebarState === 'collapsed' ? 'justify-center' : ''}`}
                title={sidebarState === 'collapsed' ? t.nav.glossary : ''}
            >
                <BookOpen size={20} />
                {sidebarState === 'expanded' && <span className="font-medium text-sm">{t.nav.glossary}</span>}
            </button>

            <button 
                onClick={() => setViewMode(ViewMode.AGENTS)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${
                viewMode === ViewMode.AGENTS ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/20' : 'hover:bg-slate-800 text-slate-400 hover:text-white'} ${sidebarState === 'collapsed' ? 'justify-center' : ''}`}
                title={sidebarState === 'collapsed' ? t.nav.agents : ''}
            >
                <Bot size={20} />
                {sidebarState === 'expanded' && <span className="font-medium text-sm">{t.nav.agents}</span>}
            </button>
            </nav>

            <div className="p-3 border-t border-slate-800 flex flex-col gap-2">
                <button onClick={() => setIsSettingsOpen(true)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative hover:bg-slate-800 text-slate-400 hover:text-white ${sidebarState === 'collapsed' ? 'justify-center' : ''}`} title={t.config.title}>
                    <Settings size={20} />
                    {sidebarState === 'expanded' && <span className="font-medium text-sm">{t.config.title}</span>}
                </button>

                <button onClick={() => setIsDataMgrOpen(true)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all group relative hover:bg-slate-800 text-slate-400 hover:text-white ${sidebarState === 'collapsed' ? 'justify-center' : ''}`} title={t.nav.data}>
                    <Database size={20} />
                    {sidebarState === 'expanded' && <span className="font-medium text-sm">{t.nav.data}</span>}
                </button>

                <div className="border-t border-slate-800 my-1"></div>

                {sidebarState === 'expanded' ? (
                    <div className="space-y-3 px-1">
                        <div className="flex justify-center bg-slate-800 rounded-lg p-1">
                            <button onClick={() => setLanguage('en')} className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${language === 'en' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>EN</button>
                            <button onClick={() => setLanguage('zh')} className={`flex-1 py-1 rounded-md text-xs font-medium transition-colors ${language === 'zh' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>中文</button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={toggleDarkMode} className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                                {isDarkMode ? <Sun size={14} /> : <Moon size={14} />} {isDarkMode ? "Light" : "Dark"}
                            </button>
                             <button onClick={() => setSidebarState('hidden')} className="flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors">
                                <PanelLeftClose size={14} /> Hide
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 items-center">
                        <button onClick={toggleLanguage} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"><Globe size={20} /></button>
                        <button onClick={toggleDarkMode} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
                         <button onClick={() => setSidebarState('hidden')} className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"><PanelLeftClose size={20} /></button>
                        <button onClick={() => setSidebarState('expanded')} className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"><ChevronRight size={20} /></button>
                    </div>
                )}
            </div>
        </aside>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
         {sidebarState === 'hidden' && (
             <div className="absolute top-4 left-4 z-30">
                 <button onClick={() => setSidebarState('expanded')} className="p-2 bg-slate-900 text-white rounded-lg shadow-lg hover:bg-indigo-600 transition-colors flex items-center gap-2"><PanelLeftOpen size={20} /></button>
             </div>
         )}

        <main className={`flex-1 bg-slate-50 dark:bg-slate-900 ${mainScrollClass}`}>
          
          {/* VIEW: STUDIO */}
          {viewMode === ViewMode.STUDIO && (
            <div className="h-full flex flex-col">
              
              {/* SUB-VIEW: WORKFLOW (If Project Selected) */}
              {currentProjectId ? (
                  <div key="workflow" className="flex-1 flex flex-col overflow-hidden animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Header Bar within Workflow */}
                    <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex items-center justify-between shrink-0 z-20">
                        <div className="flex items-center gap-3">
                            <button onClick={handleBackToProjects} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                                <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                            </button>
                            <span className="h-6 w-px bg-slate-200 dark:bg-slate-700"></span>
                            <div>
                                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    {currentProjectName || 'Untitled'}
                                </h2>
                            </div>
                        </div>
                    </div>

                    <StepIndicator currentStep={step} onStepClick={handleStepClick} />
                    
                    <div className="flex-1 flex flex-col h-full overflow-hidden">
                        {step === AppStep.UPLOAD && (
                        <div className="px-6 md:px-8 pb-20 overflow-y-auto h-full">
                            <FileUpload 
                            files={files} 
                            setFiles={setFiles} 
                            onNext={handleStartAnalysis}
                            selectedModel={selectedModel}
                            onModelChange={setSelectedModel}
                            targetLanguage={targetLanguage}
                            onLanguageChange={setTargetLanguage}
                            onOpenSettings={() => setIsSettingsOpen(true)}
                            glossarySets={glossarySets}
                            selectedGlossaryIds={selectedGlossaryIds}
                            onGlossarySelectionChange={setSelectedGlossaryIds}
                            />
                        </div>
                        )}

                        {(step === AppStep.CONFIRMATION) && (
                        <AnalysisView 
                            data={analysisResult} // Can be null now
                            isLoading={isAnalyzing}
                            onConfirm={handleConfirmVocab}
                            onRetry={() => setStep(AppStep.UPLOAD)}
                            onReAnalyze={(ctx, vocab) => handleReAnalyzeWithVocab(ctx, vocab)} // Updated to pass vocab
                            audioUrl={audioUrl}
                            videoFile={files.video}
                            videoDriveId={files.videoDriveId}
                            previewVideoUrl={previewVideoUrl}
                            setPreviewVideoUrl={setPreviewVideoUrl}
                            subtitles={parsedSubtitles}
                            onOpenGlossary={() => setViewMode(ViewMode.GLOSSARY)}
                            hasGlossary={glossarySets.some(s => s.items.length > 0)}
                            onAskAgent={(text) => setAgentPrompt(text)}
                            defaultFormat={files.subtitleFormat}
                        />
                        )}

                        {(step === AppStep.GENERATION_SRT || step === AppStep.GENERATION_MD) && (
                        <div className="px-6 md:px-8 overflow-y-auto h-full">
                            <FinalTranscript 
                            content={step === AppStep.GENERATION_SRT ? subtitleOutput : markdownOutput} 
                            isGenerating={isGenerating}
                            onRestart={handleRestartClick}
                            currentStep={step}
                            onNextStep={step === AppStep.GENERATION_SRT ? handleProceedToMD : undefined}
                            />
                        </div>
                        )}
                    </div>
                  </div>
              ) : (
                  // SUB-VIEW: PROJECT LIST
                  <div key="projectList" className="flex-1 flex flex-col h-full">
                      <ProjectList 
                          onOpenProject={handleOpenProject}
                          onCreateProject={handleCreateProject}
                          onShowToast={showToast}
                      />
                  </div>
              )}
            </div>
          )}

          {/* VIEW: GLOSSARY */}
          {viewMode === ViewMode.GLOSSARY && (
            <div key="glossary" className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <GlossaryManager 
                glossarySets={glossarySets}
                setGlossarySets={setGlossarySets}
                srtContent={files.srtContent}
                vocabList={analysisResult?.vocabList || []}
                modelName={selectedModel}
                language={targetLanguage}
                />
            </div>
          )}

          {/* VIEW: AGENTS */}
          {viewMode === ViewMode.AGENTS && (
            <div key="agents" className="h-full flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <AgentManager />
            </div>
          )}
        </main>
        
        {viewMode !== ViewMode.AGENTS && (
            <ChatWidget 
                externalPrompt={agentPrompt} 
                onClearExternalPrompt={() => setAgentPrompt(null)} 
            />
        )}
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
