
import React, { useState, useEffect, useRef } from 'react';
import { 
  Layout, Settings as SettingsIcon, LogOut, Menu, Languages, 
  MessageSquare, Book, FolderOpen, PanelLeftClose, PanelLeftOpen, Loader2,
  Sun, Moon, Globe, ChevronLeft, ChevronRight, ArrowLeft, Database, Waves, Sparkles, Pin, Bot
} from 'lucide-react';
import { useLanguage } from './contexts/LanguageContext';
import { useConfig } from './contexts/ConfigContext';
import { AppStep, ViewMode, UploadedFiles, AnalysisResult, VocabItem, GlossarySet, ProjectMetadata, AnalyzeSelection, SubtitleItem } from './types';
import { storage } from './services/storage';
import { AnalysisSession, generatePolishedSubtitle, generateFinalTranscript, fixVocabTimestamps, DEFAULT_CHAT_SYSTEM_INSTRUCTION } from './services/geminiService';
import StepIndicator from './components/StepIndicator';
import FileUpload from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import FinalTranscript from './components/FinalTranscript';
import ProjectList from './components/ProjectList';
import GlossaryManager from './components/GlossaryManager';
import AgentManager from './components/AgentManager';
import { DataManager } from './components/DataManager';
import { ChatWidget } from './components/ChatWidget';
import { Toast, ToastType } from './components/Toast';
import { ConfirmationModal } from './components/ConfirmationModal';
import { parseSubtitleToObjects } from './utils/srtParser';

// --- Internal Settings Modal Definition ---
const SettingsModalInternal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { t } = useLanguage();
    const { 
        llmApiKey, updateConfig, llmBaseUrl, driveClientId, driveApiKey, manualDriveToken, agentSystemInstruction 
    } = useConfig();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900 sticky top-0">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <SettingsIcon size={18} /> {t.config.systemSettings}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                        <LogOut size={20} className="rotate-180" />
                    </button>
                </div>
                <div className="p-6 space-y-8">
                    {/* Gemini Section */}
                    <section className="space-y-4">
                        <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-indigo-100 dark:border-indigo-900/50 pb-1">
                            {t.config.geminiSection}
                        </h4>
                        <div className="grid gap-4">
                             <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.config.apiKey}</label>
                                <input 
                                    type="password"
                                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                    value={llmApiKey}
                                    onChange={e => updateConfig('llmApiKey', e.target.value)}
                                    placeholder="sk-..."
                                />
                             </div>
                             <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.config.baseUrl}</label>
                                <input 
                                    className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                                    value={llmBaseUrl}
                                    onChange={e => updateConfig('llmBaseUrl', e.target.value)}
                                    placeholder="https://generativelanguage.googleapis.com"
                                />
                                <p className="text-xs text-slate-500 mt-1">{t.config.baseUrlHelp}</p>
                             </div>
                        </div>
                    </section>

                    {/* Agent Settings Section */}
                    <section className="space-y-4">
                        <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider border-b border-indigo-100 dark:border-indigo-900/50 pb-1 flex items-center gap-2">
                            <Bot size={16} /> {t.config.agentSection}
                        </h4>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">{t.config.agentInstruction}</label>
                                <button 
                                    onClick={() => updateConfig('agentSystemInstruction', DEFAULT_CHAT_SYSTEM_INSTRUCTION)}
                                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                    {t.common.default}
                                </button>
                            </div>
                            <textarea 
                                className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 h-32 text-sm font-mono leading-relaxed"
                                value={agentSystemInstruction}
                                onChange={e => updateConfig('agentSystemInstruction', e.target.value)}
                                placeholder={t.config.agentInstructionPlaceholder}
                            />
                            <p className="text-xs text-slate-500 mt-1">{t.config.agentInstructionHelp}</p>
                        </div>
                    </section>
                </div>
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end">
                    <button 
                        onClick={onClose}
                        className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-sm"
                    >
                        {t.config.saveBtn}
                    </button>
                </div>
            </div>
        </div>
    );
};

const App: React.FC = () => {
  const { t, language, setLanguage } = useLanguage();
  const { llmApiKey, llmBaseUrl, llmProvider } = useConfig();
  
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.STUDIO); 
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null); 
  
  const [step, setStep] = useState<AppStep>(AppStep.UPLOAD);
  const [maxStep, setMaxStep] = useState<AppStep>(AppStep.UPLOAD); // Track max reached step for navigation

  const [files, setFiles] = useState<UploadedFiles>({
    audio: null, audioSource: 'local',
    video: null, videoSource: 'local',
    srt: null, srtSource: 'local', srtContent: ''
  });
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);
  const [confirmedVocab, setConfirmedVocab] = useState<VocabItem[]>([]);
  const [subtitleOutput, setSubtitleOutput] = useState("");
  const [markdownOutput, setMarkdownOutput] = useState("");
  const [analysisLog, setAnalysisLog] = useState(""); 
  const [uploadContext, setUploadContext] = useState(""); 
  
  const [parsedSubtitles, setParsedSubtitles] = useState<SubtitleItem[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  const [sidebarState, setSidebarState] = useState<'expanded' | 'collapsed' | 'hidden'>('expanded');
  const [isHoverRevealed, setIsHoverRevealed] = useState(false);
  const [isHoverHinting, setIsHoverHinting] = useState(false);
  
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [agentPrompt, setAgentPrompt] = useState<string | null>(null);
  
  const [toast, setToast] = useState<{message: string, type: ToastType, isVisible: boolean}>({
      message: '', type: 'info', isVisible: false
  });

  const [glossarySets, setGlossarySets] = useState<GlossarySet[]>([]);
  const [selectedGlossaryIds, setSelectedGlossaryIds] = useState<string[]>([]);
  const [targetLanguage, setTargetLanguage] = useState<string>("Chinese (Simplified)");
  const [selectedModel, setSelectedModel] = useState("gemini-3-pro-preview");

  const projectSessionRef = useRef<AnalysisSession | null>(null);

  // Initialize Theme and System Color Scheme fix
  useEffect(() => {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      let initialMode = false;

      if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        initialMode = true;
      }

      setIsDarkMode(initialMode);
      applyTheme(initialMode);
      
      storage.getAllGlossarySets().then(setGlossarySets);
  }, []);

  const applyTheme = (isDark: boolean) => {
      if (isDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.style.colorScheme = 'dark'; 
      } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.colorScheme = 'light';
      }
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
    applyTheme(newMode);
  };

  useEffect(() => {
      if (files.srtContent) {
          setParsedSubtitles(parseSubtitleToObjects(files.srtContent));
      } else {
          setParsedSubtitles([]);
      }
  }, [files.srtContent]);

  // --- FIXED RESOURCE MANAGEMENT ---
  // Create Video URL
  useEffect(() => {
      if (!files.video) {
          if (previewVideoUrl) {
              URL.revokeObjectURL(previewVideoUrl);
              setPreviewVideoUrl(null);
          }
          return;
      }

      const url = URL.createObjectURL(files.video);
      setPreviewVideoUrl(url);

      // Cleanup when file changes or component unmounts
      return () => {
          URL.revokeObjectURL(url);
      };
  }, [files.video]);

  // Create Audio URL
  useEffect(() => {
      if (!files.audio) {
          if (audioUrl) {
              URL.revokeObjectURL(audioUrl);
              setAudioUrl(null);
          }
          return;
      }

      const url = URL.createObjectURL(files.audio);
      setAudioUrl(url);

      // Cleanup when file changes or component unmounts
      return () => {
          URL.revokeObjectURL(url);
      };
  }, [files.audio]);

  // Timely caching of metadata/files logic
  useEffect(() => {
      if (currentProjectId) {
          const timeout = setTimeout(() => {
              saveCurrentState();
          }, 1000);
          return () => clearTimeout(timeout);
      }
  }, [files.srtContent, step, analysisResult, confirmedVocab, subtitleOutput, markdownOutput]);

  const saveCurrentState = async () => {
      if (!currentProjectId) return;
      await storage.saveWorkspaceState(currentProjectId, {
          step: Math.max(step, maxStep), // Save the furthest step reached
          srtContent: files.srtContent,
          analysisResult,
          confirmedVocab,
          subtitleOutput,
          markdownOutput,
          name: currentProjectName || "Untitled"
      });
  };

  const showToast = (message: string, type: ToastType = 'info') => {
      setToast({ message, type, isVisible: true });
  };

  const handleCreateProject = async (name: string) => {
      try {
          const id = await storage.createProject(name);
          setCurrentProjectId(id);
          setCurrentProjectName(name);
          setViewMode(ViewMode.STUDIO);
          setStep(AppStep.UPLOAD);
          setMaxStep(AppStep.UPLOAD);
          setFiles({ audio: null, audioSource: 'local', video: null, videoSource: 'local', srt: null, srtSource: 'local', srtContent: '' });
          setAnalysisResult(null);
          setVocabList([]);
          setConfirmedVocab([]);
          setSubtitleOutput("");
          setMarkdownOutput("");
          setAnalysisLog("");
          setUploadContext("");
          projectSessionRef.current = null;
          
          showToast(t.messages.projectCreated, 'success');
      } catch (e) {
          showToast(t.messages.projectCreateFailed, 'error');
      }
  };

  const handleOpenProject = async (id: string) => {
      setIsRestoring(true);
      try {
          const state = await storage.loadWorkspaceState(id);
          const loadedFiles = await storage.loadFiles(id);
          
          if (state) {
              setCurrentProjectId(id);
              setCurrentProjectName(state.name);
              setStep(state.step);
              setMaxStep(state.step); // Restore max progress
              setAnalysisResult(state.analysisResult);
              setConfirmedVocab(state.confirmedVocab);
              setVocabList(state.analysisResult?.vocabList || []);
              setSubtitleOutput(state.subtitleOutput);
              setMarkdownOutput(state.markdownOutput);
              setAnalysisLog("");
              
              if (loadedFiles) {
                 setFiles(prev => ({
                     ...prev,
                     audio: loadedFiles.audio.file, audioSource: loadedFiles.audio.source, audioDriveId: loadedFiles.audio.driveId,
                     video: loadedFiles.video.file, videoSource: loadedFiles.video.source, videoDriveId: loadedFiles.video.driveId,
                     srt: loadedFiles.srt.file, srtSource: loadedFiles.srt.source, srtDriveId: loadedFiles.srt.driveId,
                     srtContent: state.srtContent
                 }));
              }
              
              setViewMode(ViewMode.STUDIO);
              showToast(t.messages.projectLoaded, 'success');
          }
      } catch (e) {
          console.error(e);
          showToast(t.messages.projectLoadFailed, 'error');
      } finally {
          setIsRestoring(false);
      }
  };

  const handleUploadNext = async (selection: AnalyzeSelection, context: string) => {
      if (!llmApiKey) {
          showToast(t.errors.analysisFailed, 'error');
          setIsSettingsOpen(true);
          return;
      }
      
      setIsAnalyzing(true);
      setAnalysisLog("");
      setUploadContext(context); // Store context
      
      setStep(AppStep.CONFIRMATION);
      setMaxStep(Math.max(AppStep.CONFIRMATION, maxStep));

      // Save files to DB on transition
      if (currentProjectId) {
          storage.saveFiles(currentProjectId, 
              { file: files.audio, source: files.audioSource, driveId: files.audioDriveId },
              { file: files.video, source: files.videoSource, driveId: files.videoDriveId },
              { file: files.srt, source: files.srtSource, driveId: files.srtDriveId }
          );
      }

      try {
          const session = new AnalysisSession(llmApiKey, llmBaseUrl, selectedModel, llmProvider);
          projectSessionRef.current = session;

          const activeGlossaryItems = glossarySets
              .filter(set => selectedGlossaryIds.includes(set.id))
              .flatMap(set => set.items);

          const result = await session.start(
              files.srtContent,
              [], 
              targetLanguage,
              activeGlossaryItems,
              context, 
              (chunk) => setAnalysisLog(prev => prev + chunk)
          );

          setAnalysisResult(result);
          setVocabList(result.vocabList);
          showToast(t.analysis.success.title, 'success');
      } catch (e: any) {
          console.error(e);
          showToast(e.message || t.errors.analysisFailed, 'error');
          setStep(AppStep.UPLOAD);
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleReAnalyze = async (instruction: string, currentVocab?: VocabItem[]) => {
      if (!projectSessionRef.current) {
           projectSessionRef.current = new AnalysisSession(llmApiKey, llmBaseUrl, selectedModel, llmProvider);
      }
      setIsAnalyzing(true);
      setAnalysisLog("");
      try {
          const activeGlossaryItems = glossarySets
             .filter(set => selectedGlossaryIds.includes(set.id))
             .flatMap(set => set.items);
             
          const newResult = await projectSessionRef.current.iterate(
              currentVocab || vocabList,
              instruction + (uploadContext ? `\n(Original Context: ${uploadContext})` : ""),
              targetLanguage,
              activeGlossaryItems,
              (chunk) => setAnalysisLog(prev => prev + chunk)
          );
          setAnalysisResult(newResult);
          setVocabList(newResult.vocabList);
          showToast(t.messages.reAnalysisComplete, 'success');
      } catch (e) {
          showToast(t.messages.reAnalysisFailed, 'error');
      } finally {
          setIsAnalyzing(false);
      }
  };

  const handleExtractToGlossary = async (setName: string, isNew: boolean, existingSetId?: string) => {
      const verifiedTerms = confirmedVocab.filter(v => v.status === 'corrected');
      if (verifiedTerms.length === 0) {
          showToast(t.messages.noTermsFound, 'error');
          return;
      }

      try {
          const newItems = verifiedTerms.map(v => ({
              id: `term-${Date.now()}-${Math.random().toString(36).substr(2,5)}`,
              term: v.original,
              definition: v.corrected,
              remarks: `Extracted from ${currentProjectName}`
          }));

          if (isNew) {
              const newSet: GlossarySet = {
                  id: `set-${Date.now()}`,
                  title: setName,
                  tags: ['Extracted'],
                  description: `Extracted from ${currentProjectName}`,
                  items: newItems,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
              };
              await storage.saveGlossarySet(newSet);
          } else if (existingSetId) {
              const targetSet = glossarySets.find(s => s.id === existingSetId);
              if (targetSet) {
                  const merged = [...targetSet.items, ...newItems.filter(n => !targetSet.items.some(e => e.term === n.term))];
                  await storage.saveGlossarySet({ ...targetSet, items: merged, updatedAt: Date.now() });
              }
          }
          
          setGlossarySets(await storage.getAllGlossarySets());
          showToast(t.messages.extractSuccess.replace('{n}', verifiedTerms.length.toString()), 'success');
      } catch (e) {
          showToast(t.messages.extractFailed, 'error');
      }
  };

  const handleConfirmAnalysis = async (vocab: VocabItem[], extraContext: string, format: string) => {
      setConfirmedVocab(vocab);
      
      setStep(AppStep.GENERATION_SRT);
      setMaxStep(Math.max(AppStep.GENERATION_SRT, maxStep));
      
      setIsGenerating(true);
      setSubtitleOutput("");
      
      try {
          await generatePolishedSubtitle(
              files.srtContent,
              vocab,
              selectedModel,
              format, 
              llmApiKey,
              llmBaseUrl,
              llmProvider,
              (chunk) => setSubtitleOutput(prev => prev + chunk)
          );
      } catch (e) {
          showToast(t.messages.generationFailed, 'error');
      } finally {
          setIsGenerating(false);
      }
  };

  const handleNextToMarkdown = async () => {
      setStep(AppStep.GENERATION_MD);
      setMaxStep(Math.max(AppStep.GENERATION_MD, maxStep));
      
      setIsGenerating(true);
      setMarkdownOutput("");
      try {
          await generateFinalTranscript(
              subtitleOutput, confirmedVocab, selectedModel, targetLanguage, llmApiKey, llmBaseUrl, llmProvider,
              (chunk) => setMarkdownOutput(prev => prev + chunk)
          );
      } catch(e) { 
          showToast("Generation Failed", 'error'); 
      } finally { 
          setIsGenerating(false); 
      }
  };

  const handleRestartConfirm = async () => {
      setStep(AppStep.UPLOAD);
      setMaxStep(AppStep.UPLOAD);
      setAnalysisResult(null);
      setSubtitleOutput('');
      setMarkdownOutput('');
      setConfirmedVocab([]);
      setVocabList([]);
      setAnalysisLog("");
      setUploadContext("");
      projectSessionRef.current = null;
      setIsRestartConfirmOpen(false); 
      showToast(t.messages.workspaceReset, 'info');
  };

  // --- Sidebar Interaction Logic ---
  
  const handleHotZoneEnter = () => {
      if (sidebarState !== 'hidden') return;
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
      setIsHoverHinting(true);
      hoverTimeoutRef.current = setTimeout(() => {
          setIsHoverRevealed(true);
          setIsHoverHinting(false);
      }, 600);
  };

  const handleHotZoneLeave = () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      setIsHoverHinting(false);
  };

  const handleSidebarEnter = () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  };

  const handleSidebarLeave = () => {
      if (sidebarState === 'hidden') {
          closeTimeoutRef.current = setTimeout(() => {
              setIsHoverRevealed(false);
          }, 300);
      }
  };

  const pinSidebar = () => {
      setSidebarState('expanded');
      setIsHoverRevealed(false);
      setIsHoverHinting(false);
  };

  const layoutWidthClass = sidebarState === 'hidden' && !isHoverRevealed ? 'w-0' : (sidebarState === 'collapsed' ? 'w-20' : 'w-64');
  
  const sidebarContainerClass = `
    ${sidebarState === 'collapsed' ? 'w-20' : 'w-64'} 
    bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col shrink-0 
    transition-all duration-300 ease-in-out z-40
    ${sidebarState === 'hidden' ? 'fixed left-0 top-0 bottom-0 shadow-2xl' : 'relative'}
    ${sidebarState === 'hidden' && !isHoverRevealed ? '-translate-x-full' : 'translate-x-0'}
  `;

  const mainContentMargin = sidebarState === 'hidden' && isHoverRevealed ? 'ml-64' : 'ml-0';

  const navItemClass = (active: boolean) => `w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group relative ${
      active 
      ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-300 font-medium' 
      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
  } ${sidebarState === 'collapsed' ? 'justify-center' : ''}`;

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

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 overflow-hidden font-sans text-slate-900 dark:text-slate-100 transition-colors duration-200">
      
      <Toast message={toast.message} type={toast.type} isVisible={toast.isVisible} onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} />

      <ConfirmationModal 
          isOpen={isRestartConfirmOpen}
          onClose={() => setIsRestartConfirmOpen(false)}
          onConfirm={handleRestartConfirm}
          title={t.messages.restartConfirmTitle}
          message={t.messages.restartConfirmMessage}
          confirmText={t.common.confirm}
          cancelText={t.common.cancel}
          isDanger={true}
      />

      <SettingsModalInternal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      
      {/* Invisible Hot Zone for Hover Reveal */}
      {sidebarState === 'hidden' && (
          <div 
            className="fixed left-0 top-0 bottom-0 w-6 z-[50] bg-transparent cursor-e-resize"
            onMouseEnter={handleHotZoneEnter}
            onMouseLeave={handleHotZoneLeave}
          >
              <div className={`
                  absolute top-0 bottom-0 left-0 w-12 
                  bg-gradient-to-r from-indigo-500/10 to-transparent dark:from-indigo-400/10
                  backdrop-blur-[2px] border-r border-indigo-500/20
                  transition-all duration-500 ease-out
                  ${isHoverHinting && !isHoverRevealed ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full'}
              `}>
                  {/* Visual Hint Indicator */}
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400/50 shadow-[0_0_8px_rgba(99,102,241,0.5)] animate-pulse"></div>
                  <div className="absolute top-1/2 left-4 -translate-y-1/2 text-indigo-500 opacity-70">
                      <ChevronRight size={24} className="animate-bounce-right" />
                  </div>
              </div>
          </div>
      )}

      {/* Sidebar Container */}
      <div 
        className={sidebarContainerClass}
        onMouseEnter={handleSidebarEnter}
        onMouseLeave={handleSidebarLeave}
      >
          <div className={`p-6 flex items-center ${sidebarState === 'collapsed' ? 'justify-center' : 'gap-3'}`}>
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/30">
                  <Waves className="text-white" size={18} />
              </div>
              {sidebarState !== 'collapsed' && (
                  <div className="flex flex-col animate-in fade-in duration-300">
                      <span className="font-bold text-lg leading-tight tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">VerbaFlow</span>
                      <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">
                          {language === 'zh' ? 'AI 语流' : 'AI Studio'}
                      </span>
                  </div>
              )}
          </div>

          <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto">
              <button onClick={() => setViewMode(ViewMode.STUDIO)} className={navItemClass(viewMode === ViewMode.STUDIO)}>
                   <FolderOpen size={20} />
                   {sidebarState !== 'collapsed' && <span>{t.nav.studio}</span>}
              </button>
              <button onClick={() => setViewMode(ViewMode.GLOSSARY)} className={navItemClass(viewMode === ViewMode.GLOSSARY)}>
                   <Book size={20} />
                   {sidebarState !== 'collapsed' && <span>{t.nav.glossary}</span>}
              </button>
              <button onClick={() => setViewMode(ViewMode.AGENTS)} className={navItemClass(viewMode === ViewMode.AGENTS)}>
                   <MessageSquare size={20} />
                   {sidebarState !== 'collapsed' && <span>{t.nav.agents}</span>}
              </button>
              <button onClick={() => setViewMode('data' as ViewMode)} className={navItemClass(viewMode === 'data' as ViewMode)}>
                   <Database size={20} />
                   {sidebarState !== 'collapsed' && <span>{t.nav.data}</span>}
              </button>
          </nav>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <button onClick={() => setIsSettingsOpen(true)} className={navItemClass(false)}>
                  <SettingsIcon size={20} />
                  {sidebarState !== 'collapsed' && <span>{t.config.systemSettings}</span>}
              </button>
              {sidebarState !== 'collapsed' ? (
                  <div className="flex gap-2">
                      <button onClick={toggleDarkMode} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                          {isDarkMode ? <Sun size={14} /> : <Moon size={14} />} {isDarkMode ? t.nav.modeLight : t.nav.modeDark}
                      </button>
                      
                      {sidebarState === 'hidden' ? (
                          <button onClick={pinSidebar} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 transition-colors">
                              <Pin size={14} /> {t.nav.pin}
                          </button>
                      ) : (
                          <button onClick={() => setSidebarState('hidden')} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <PanelLeftClose size={14} /> {t.nav.hideBtn}
                          </button>
                      )}
                  </div>
              ) : (
                  <div className="flex flex-col gap-3 items-center">
                        <button onClick={toggleDarkMode} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">{isDarkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
                        <button onClick={() => setSidebarState('expanded')} className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"><ChevronRight size={20} /></button>
                  </div>
              )}
          </div>
      </div>

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all duration-300 ease-in-out ${mainContentMargin} relative z-0`}>
          {viewMode === ViewMode.STUDIO && (
              <>
                  {currentProjectId && (
                      <StepIndicator 
                          currentStep={step} 
                          maxStep={maxStep}
                          onStepClick={(s) => setStep(s)}
                      />
                  )}
                  
                  <div className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-slate-900">
                      {step === AppStep.UPLOAD && (
                          <FileUpload 
                              files={files} 
                              setFiles={setFiles} 
                              onNext={handleUploadNext}
                              selectedModel={selectedModel}
                              onModelChange={setSelectedModel}
                              targetLanguage={targetLanguage}
                              onLanguageChange={setTargetLanguage}
                              onOpenSettings={() => setIsSettingsOpen(true)}
                              glossarySets={glossarySets}
                              selectedGlossaryIds={selectedGlossaryIds}
                              onGlossarySelectionChange={setSelectedGlossaryIds}
                          />
                      )}
                      
                      {step === AppStep.CONFIRMATION && (
                          <AnalysisView 
                              data={analysisResult} 
                              isLoading={isAnalyzing}
                              onConfirm={handleConfirmAnalysis}
                              onRetry={() => setStep(AppStep.UPLOAD)}
                              onReAnalyze={handleReAnalyze}
                              audioUrl={audioUrl}
                              videoFile={files.video}
                              videoDriveId={files.videoDriveId}
                              previewVideoUrl={previewVideoUrl}
                              setPreviewVideoUrl={setPreviewVideoUrl}
                              subtitles={parsedSubtitles}
                              onOpenGlossary={() => setViewMode(ViewMode.GLOSSARY)}
                              glossarySets={glossarySets}
                              selectedGlossaryIds={selectedGlossaryIds}
                              onGlossarySelectionChange={setSelectedGlossaryIds}
                              hasGlossary={glossarySets.length > 0}
                              onAskAgent={(text) => {
                                  setAgentPrompt(text);
                              }}
                              defaultFormat={files.subtitleFormat}
                              streamLog={analysisLog}
                              onExtractToGlossary={handleExtractToGlossary}
                          />
                      )}

                      {step === AppStep.GENERATION_SRT && (
                          <FinalTranscript 
                              content={subtitleOutput} 
                              isGenerating={isGenerating} 
                              onRestart={() => setIsRestartConfirmOpen(true)}
                              currentStep={AppStep.GENERATION_SRT}
                              onNextStep={handleNextToMarkdown}
                              onDownload={() => {}} 
                          />
                      )}

                      {step === AppStep.GENERATION_MD && (
                          <FinalTranscript 
                              content={markdownOutput} 
                              isGenerating={isGenerating} 
                              onRestart={() => setIsRestartConfirmOpen(true)}
                              currentStep={AppStep.GENERATION_MD}
                              onDownload={() => {}} 
                          />
                      )}
                  </div>
              </>
          )}

          {viewMode === ViewMode.GLOSSARY && (
              <GlossaryManager 
                  glossarySets={glossarySets}
                  setGlossarySets={setGlossarySets}
                  srtContent={files.srtContent}
                  vocabList={vocabList}
                  modelName={selectedModel}
                  language={targetLanguage}
              />
          )}

          {viewMode === ViewMode.AGENTS && (
              <AgentManager />
          )}

          {viewMode === 'data' && (
              <DataManager />
          )}
          
          {/* Project List Overlay if no project selected and in Studio mode */}
          {viewMode === ViewMode.STUDIO && !currentProjectId && (
              <div className="absolute inset-0 bg-slate-50 dark:bg-slate-900 z-50 overflow-y-auto">
                  <ProjectList 
                      onOpenProject={handleOpenProject} 
                      onCreateProject={handleCreateProject}
                      onShowToast={showToast}
                  />
              </div>
          )}
      </div>

      <ChatWidget 
          externalPrompt={agentPrompt} 
          onClearExternalPrompt={() => setAgentPrompt(null)} 
      />
    </div>
  );
};

export default App;
