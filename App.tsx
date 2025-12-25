
import React, { useState, useEffect, useRef } from 'react';
import StepIndicator from './components/StepIndicator';
import FileUpload from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import FinalTranscript from './components/FinalTranscript';
import ChatWidget from './components/ChatWidget';
import GlossaryManager from './components/GlossaryManager';
import AgentManager from './components/AgentManager';
import { AppStep, UploadedFiles, AnalysisResult, VocabItem, SubtitleItem, GlossaryItem, ViewMode, GlossarySet, AnalyzeSelection } from './types';
import { AnalysisSession, generateFinalTranscript, generatePolishedSubtitle } from './services/geminiService';
import { parseSubtitleToObjects } from './utils/srtParser';
import { FileAudio, Layout, BookOpen, Settings, ChevronLeft, ChevronRight, Save, X, Eye, EyeOff, Globe, Moon, Sun, PanelLeftClose, PanelLeftOpen, Database, Trash2, LogOut, Bot, Loader2, Copy, AlertTriangle, Key, ExternalLink, Download, Upload, FileJson } from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { ConfigProvider, useConfig } from './contexts/ConfigContext';
import { Part } from "@google/genai";
// import { initGoogleDrive, setManualAccessToken } from './services/googleDriveService'; // Drive Temporarily Disabled
import { storage, StorageStats } from './services/storage';
import { ConfirmationModal } from './components/ConfirmationModal';

// --- SETTINGS MODAL COMPONENT ---
const SettingsModal: React.FC<{ isOpen: boolean; onClose: () => void; onOpenDataManager: () => void }> = ({ isOpen, onClose, onOpenDataManager }) => {
  const { t } = useLanguage();
  const { geminiApiKey, geminiBaseUrl, driveClientId, driveApiKey, manualDriveToken, updateConfig } = useConfig();
  const [showApiKey, setShowApiKey] = useState(false);

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
          {/* Gemini Config */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">{t.config.geminiSection}</h3>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.config.apiKey}</label>
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.config.baseUrl}</label>
              <input 
                type="text"
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                value={geminiBaseUrl}
                onChange={(e) => updateConfig('geminiBaseUrl', e.target.value)}
                placeholder="https://..."
              />
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

        <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center gap-2"
          >
            <Save size={16} /> {t.config.saveBtn}
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
  const [isExporting, setIsExporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  
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

  // --- Export LITE Workspace (JSON Only, No Media) ---
  const handleExportLite = async () => {
      setIsExporting(true);
      try {
          const ws = await storage.loadWorkspaceState();
          const files = await storage.loadFiles(); // We only read metadata, ignore blobs
          const chats = await storage.loadChats();
          const glossary = await storage.getAllGlossarySets();

          const exportPackage: any = {
              version: '1.0-lite',
              timestamp: Date.now(),
              workspace: ws,
              chats,
              glossary,
              // Metadata only
              fileMeta: {
                  audio: files?.audio?.file?.name || null,
                  video: files?.video?.file?.name || null,
                  srt: files?.srt?.file?.name || null,
                  // We SAVE the SRT text content because it is small and critical
                  srtContent: ws?.srtContent || '' 
              }
          };

          const blob = new Blob([JSON.stringify(exportPackage, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          // Use a specific extension for clarity
          link.download = `verbaflow_project_${new Date().toISOString().slice(0,10)}.vfproj`; 
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (e) {
          console.error(e);
          alert("Export failed");
      } finally {
          setIsExporting(false);
      }
  };

  const handleImportLite = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onload = async (ev) => {
              try {
                  const pkg = JSON.parse(ev.target?.result as string);
                  
                  // Restore State
                  if (pkg.workspace) await storage.saveWorkspaceState(pkg.workspace);
                  if (pkg.chats) await storage.saveChats(pkg.chats);
                  if (pkg.glossary) {
                      for(const g of pkg.glossary) await storage.saveGlossarySet(g);
                  }
                  
                  // Restore Files (Metadata only + SRT Text)
                  let srtFile = null;
                  if (pkg.fileMeta?.srtContent) {
                      srtFile = new File([pkg.fileMeta.srtContent], pkg.fileMeta.srt || "restored.srt", { type: "text/plain" });
                  }

                  await storage.saveFiles(
                      { file: null, source: 'local' }, // Audio lost
                      { file: null, source: 'local' }, // Video lost
                      { file: srtFile, source: 'local' }  // SRT Restored from text
                  );
                  
                  alert(language === 'zh' ? "项目已恢复！(音视频文件需重新关联)" : "Project Restored! (Please re-attach media files)");
                  window.location.reload();
              } catch (err) {
                  console.error(err);
                  alert("Import failed. Invalid file format.");
              }
          };
          reader.readAsText(file);
      }
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
          {/* Backup & Restore Section */}
          <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
              <h4 className="font-bold text-indigo-800 dark:text-indigo-200 mb-2 flex items-center gap-2"><Save size={16}/> {language === 'zh' ? '项目快照 (轻量级)' : 'Project Snapshot (Lite)'}</h4>
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-3 opacity-80 leading-relaxed">
                  {language === 'zh' 
                    ? "保存当前的进度、术语库和聊天记录为 .vfproj 文件 (纯文本 JSON)。不包含音视频大文件，恢复后需手动关联媒体。" 
                    : "Save progress, glossary, and chats as a .vfproj file (JSON text). Excludes media files; re-attach media after restore."}
              </p>
              <div className="flex gap-2">
                  <button onClick={handleExportLite} disabled={isExporting} className="flex-1 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 flex items-center justify-center gap-1 transition-colors">
                      {isExporting ? <Loader2 className="animate-spin" size={14}/> : <FileJson size={14}/>} {language === 'zh' ? '导出项目文件' : 'Export Project'}
                  </button>
                  <input type="file" ref={importRef} className="hidden" accept=".vfproj,.json" onChange={handleImportLite} />
                  <button onClick={() => importRef.current?.click()} className="flex-1 py-2 bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg text-xs font-bold hover:bg-indigo-50 flex items-center justify-center gap-1 transition-colors">
                      <Upload size={14}/> {language === 'zh' ? '恢复项目' : 'Restore Project'}
                  </button>
              </div>
          </div>

          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 font-semibold">{language === 'zh' ? '浏览器存储状态:' : 'Browser Storage Stats:'}</p>
          
          <div className="space-y-4">
             {/* Workspace */}
             <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                <div>
                   <h4 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{t.data.workspace}</h4>
                   <p className="text-xs text-slate-500">{stats ? `${(stats.projectSize / (1024*1024)).toFixed(2)} MB` : '...'}</p>
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
  const { geminiApiKey, geminiBaseUrl, driveClientId, driveApiKey, manualDriveToken } = useConfig();
  
  // Navigation & UI State
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.STUDIO);
  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'hidden'>('expanded');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDataMgrOpen, setIsDataMgrOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

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
  const [selectedGlossaryIds, setSelectedGlossaryIds] = useState<string[]>([]); // New: Glossary Selection
  
  // UI Loading State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // OUTPUT STATES (Separated)
  const [subtitleOutput, setSubtitleOutput] = useState('');
  const [markdownOutput, setMarkdownOutput] = useState('');
  const [transcriptOutput, setTranscriptOutput] = useState(''); // Legacy, keeping for compatibility during migration if needed, but primary logic moves to separated.
  
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
  useEffect(() => {
    const loadState = async () => {
        try {
            // 1. Load Lightweight State
            const parsed = await storage.loadWorkspaceState();
            if (parsed) {
                setStep(parsed.step);
                setFiles(prev => ({ ...prev, srtContent: parsed.srtContent }));
                if (parsed.analysisResult) setAnalysisResult(parsed.analysisResult);
                if (parsed.confirmedVocab) setConfirmedVocab(parsed.confirmedVocab);
                // Load isolated states
                if (parsed.subtitleOutput) setSubtitleOutput(parsed.subtitleOutput);
                if (parsed.markdownOutput) setMarkdownOutput(parsed.markdownOutput);
            }
            
            // 2. Load Heavy Files (Blobs) or Drive IDs
            const savedFiles = await storage.loadFiles();
            if (savedFiles) {
                setFiles(prev => ({
                    ...prev,
                    audio: savedFiles.audio.file,
                    audioSource: savedFiles.audio.source,
                    audioDriveId: savedFiles.audio.driveId,
                    
                    video: savedFiles.video.file,
                    videoSource: savedFiles.video.source,
                    videoDriveId: savedFiles.video.driveId,
                    
                    srt: savedFiles.srt.file,
                    srtSource: savedFiles.srt.source,
                    srtDriveId: savedFiles.srt.driveId
                }));
            }
            
            // 3. Load Glossary
            const sets = await storage.getAllGlossarySets();
            if (sets) setGlossarySets(sets);

        } catch (e) {
            console.error("Failed to restore workspace state from DB", e);
        } finally {
            setIsRestoring(false);
        }
    };
    loadState();
  }, []);

  // Save Lightweight State (Debounced)
  useEffect(() => {
    if (isRestoring) return;
    
    const stateToSave = {
      step,
      srtContent: files.srtContent,
      analysisResult,
      confirmedVocab,
      subtitleOutput, // Save separated
      markdownOutput
    };
    
    const timer = setTimeout(() => {
        storage.saveWorkspaceState(stateToSave);
    }, 1500);
    return () => clearTimeout(timer);
  }, [step, files.srtContent, analysisResult, confirmedVocab, subtitleOutput, markdownOutput, isRestoring]);

  // Save Files Separately (When file objects change)
  useEffect(() => {
      if (isRestoring) return;
      // We save if ANY source is present (local or drive)
      if (files.audio || files.audioDriveId || files.video || files.videoDriveId || files.srt || files.srtDriveId) {
          storage.saveFiles(
              { file: files.audio, source: files.audioSource, driveId: files.audioDriveId },
              { file: files.video, source: files.videoSource, driveId: files.videoDriveId },
              { file: files.srt, source: files.srtSource, driveId: files.srtDriveId }
          );
      }
  }, [files, isRestoring]);

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

  // Actions
  const handleStartAnalysis = async (selection: AnalyzeSelection) => {
    if (!files.srtContent && !selection.video && !selection.audio) {
        setAnalysisResult({
            summary: { topic: "Local Media Preview", speakers: [], duration: "", agenda: [] },
            vocabList: []
        });
        setStep(AppStep.CONFIRMATION);
        return;
    }

    if (!geminiApiKey) { setIsSettingsOpen(true); return; }

    const activeGlossaryItems = glossarySets
        .filter(set => selectedGlossaryIds.includes(set.id))
        .flatMap(s => s.items);

    if (files.audio && !audioUrl) setAudioUrl(URL.createObjectURL(files.audio));

    // KEY CHANGE: Switch to Confirmation View immediately to show loading animation
    setStep(AppStep.CONFIRMATION);
    setIsAnalyzing(true);
    
    try {
        // Prepare Multi-modal Parts
        const mediaParts: Part[] = [];

        // 1. Process Video if selected
        if (selection.video) {
            if (files.video && files.videoSource === 'local') {
                if (files.video.size > 20 * 1024 * 1024) {
                    alert("Warning: Local video is large (>20MB). Browser processing might be slow or crash. Proceeding...");
                }
                const part = await fileToGenerativePart(files.video);
                mediaParts.push(part);
            } else if (files.videoDriveId) {
                // TODO: Implement Drive file fetching for analysis if needed (requires backend usually or complex client logic)
                // For now, warn user
                console.warn("Drive file direct analysis not fully supported in this demo without backend relay.");
            }
        }

        // 2. Process Audio if selected
        if (selection.audio) {
             if (files.audio && files.audioSource === 'local') {
                const part = await fileToGenerativePart(files.audio);
                mediaParts.push(part);
            }
        }

        // Initialize Project Session
        projectSessionRef.current = new AnalysisSession(geminiApiKey, geminiBaseUrl, selectedModel);
        
        const result = await projectSessionRef.current.start(
            selection.srt ? files.srtContent : null, 
            mediaParts,
            targetLanguage, 
            activeGlossaryItems
        );
        
        setAnalysisResult(result);
    } catch (error) {
        console.error("Analysis failed:", error);
        alert(t.errors.analysisFailed);
        setStep(AppStep.UPLOAD); // Go back if failed
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleReAnalyzeWithVocab = async (context: string, currentVocab?: VocabItem[]) => {
      if (!geminiApiKey || !currentVocab) return;
      
      setIsAnalyzing(true);
      try {
          // Dynamic Glossary Lookup for Re-analysis
          // We grab the fresh glossary state from glossarySets based on selected IDs
          const activeGlossaryItems = glossarySets
            .filter(set => selectedGlossaryIds.includes(set.id))
            .flatMap(s => s.items);

          let result;
          if (projectSessionRef.current) {
              // Use existing session for efficient updates
              // Inject CURRENT Glossary items to ensure the AI knows about new/edited terms
              result = await projectSessionRef.current.iterate(
                  currentVocab, 
                  context, 
                  targetLanguage,
                  activeGlossaryItems // NEW: Pass dynamic glossary
              );
          } else {
              // Fallback: If session was lost
              projectSessionRef.current = new AnalysisSession(geminiApiKey, geminiBaseUrl, selectedModel);
              // NOTE: This fallback is imperfect as we don't have the original media parts here easily.
              // It relies on text-only re-analysis or context injection.
              const fullContext = `User Previous State: ${JSON.stringify(currentVocab)}. New Instruction: ${context}`;
              // We pass empty media parts for the fallback text-only restart
              result = await projectSessionRef.current.start(files.srtContent, [], targetLanguage, activeGlossaryItems, fullContext);
          }
          setAnalysisResult(result);
      } catch (e) {
          console.error("Re-analysis failed", e);
          alert("Re-analysis failed. Please check connection.");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleConfirmVocab = async (vocab: VocabItem[], context: string, format: string) => {
    if (!geminiApiKey) { setIsSettingsOpen(true); return; }
    setConfirmedVocab(vocab);
    setStep(AppStep.GENERATION_SRT);
    setIsGenerating(true);
    setSubtitleOutput(''); // Clear previous output

    try {
      // Use the format passed from the UI selector, defaulting to srt if somehow undefined
      const outputFormat = format || files.subtitleFormat || 'srt';
      
      await generatePolishedSubtitle(files.srtContent, vocab, selectedModel, outputFormat, geminiApiKey, geminiBaseUrl, (chunk) => {
        setSubtitleOutput(prev => prev + chunk);
      });
    } catch (error) {
      console.error("Subtitle Gen failed:", error);
      alert(t.errors.generationFailed);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProceedToMD = async () => {
    if (!geminiApiKey) { setIsSettingsOpen(true); return; }
    setStep(AppStep.GENERATION_MD);
    setIsGenerating(true);
    setMarkdownOutput(''); // Clear previous output

    try {
      await generateFinalTranscript(files.srtContent, confirmedVocab, selectedModel, targetLanguage, geminiApiKey, geminiBaseUrl, (chunk) => {
        setMarkdownOutput(prev => prev + chunk);
      });
    } catch (error) {
      console.error("MD Gen failed:", error);
      alert(t.errors.generationFailed);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRestartClick = () => {
      setIsRestartConfirmOpen(true);
  };

  const handleRestartConfirm = async () => {
      handleClearWorkspace();
      await storage.clear('projects');
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
          <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
              <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-indigo-600" size={32} />
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Restoring Workspace...</p>
              </div>
          </div>
      );
  }

  const mainScrollClass = viewMode === ViewMode.AGENTS ? 'overflow-hidden' : 'overflow-auto';

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      <ConfirmationModal 
          isOpen={isRestartConfirmOpen}
          onClose={() => setIsRestartConfirmOpen(false)}
          onConfirm={handleRestartConfirm}
          title="Start New Task"
          message="Are you sure? This will clear current progress and reset the workspace."
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

      {/* ... (Sidebar and Navigation remain unchanged) ... */}
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
          {viewMode === ViewMode.STUDIO && (
            <div className="h-full flex flex-col">
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
          )}

          {viewMode === ViewMode.GLOSSARY && (
            <GlossaryManager 
              glossarySets={glossarySets}
              setGlossarySets={setGlossarySets}
              srtContent={files.srtContent}
              vocabList={analysisResult?.vocabList || []}
              modelName={selectedModel}
              language={targetLanguage}
            />
          )}

          {viewMode === ViewMode.AGENTS && (
            <AgentManager />
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
