
import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, VocabItem, SubtitleItem, GlossarySet, GlossaryItem } from '../types';
import { 
  AlertCircle, Loader2, PlayCircle, Play, Pause, Undo2, Redo2, BookOpen, RefreshCw, 
  CheckCheck, HardDrive, Video, Maximize2, Minimize2, MessageSquare, Edit2, 
  ChevronDown, ChevronUp, Clock, Users, List, Wand2, Sparkles, FolderDown, Timer, 
  Captions, LayoutTemplate, Headphones, RotateCcw, RotateCw, Crosshair, FilePenLine, 
  PictureInPicture2, Eye, EyeOff, X, Cloud, Lock, LockOpen, Check, FileType
} from 'lucide-react';
import { extractStartTimeFromRange, formatTime, getContextFromSRT, parseFlexibleTime } from '../utils/srtParser';
import { useLanguage } from '../contexts/LanguageContext';
// import { saveToDrive, getDriveFileContent } from '../services/googleDriveService'; // Drive Disabled
import { getDriveFileContent } from '../services/googleDriveService'; // Keep for reading only
import { generateSmartGlossary, fixVocabTimestamps } from '../services/geminiService';
import { storage } from '../services/storage';
import { useConfig } from '../contexts/ConfigContext';
import { ConfirmationModal } from './ConfirmationModal';

// Extend VocabItem to include a frontend-only unique ID
interface ExtendedVocabItem extends VocabItem {
  internalId: string;
}

interface Props {
  data: AnalysisResult | null; // Allow null for loading state
  isLoading: boolean;
  onConfirm: (finalVocab: VocabItem[], extraContext: string, format: string) => void; // Added format param
  onRetry: () => void;
  onReAnalyze: (extraContext: string, currentVocab?: VocabItem[]) => void;
  audioUrl: string | null;
  videoFile?: File | null;
  videoDriveId?: string; // New
  previewVideoUrl?: string | null;
  setPreviewVideoUrl?: (url: string | null) => void;
  subtitles: SubtitleItem[];
  onOpenGlossary: () => void;
  hasGlossary: boolean;
  onAskAgent?: (text: string) => void;
  defaultFormat?: string;
}

export const AnalysisView: React.FC<Props> = ({ 
  data, 
  isLoading, 
  onConfirm, 
  onRetry, 
  onReAnalyze,
  audioUrl, 
  videoFile,
  videoDriveId,
  previewVideoUrl,
  setPreviewVideoUrl,
  subtitles,
  onOpenGlossary,
  hasGlossary,
  onAskAgent,
  defaultFormat = 'srt'
}) => {
  const { t } = useLanguage();
  const { llmApiKey, llmBaseUrl } = useConfig();
  
  const [vocabList, setVocabList] = useState<ExtendedVocabItem[]>([]);
  const [initialVocab, setInitialVocab] = useState<ExtendedVocabItem[]>([]);
  const [extraContext, setExtraContext] = useState("");
  const [showSummary, setShowSummary] = useState(true);
  const [isFixingTime, setIsFixingTime] = useState(false);
  
  // Output Format State
  const [selectedFormat, setSelectedFormat] = useState(defaultFormat);

  // Modals & Notifications
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [isInstructionModalOpen, setIsInstructionModalOpen] = useState(false);
  
  // Background Task State
  const [backgroundTask, setBackgroundTask] = useState<{message: string, type: 'loading' | 'success' | 'error'} | null>(null);

  const [tempContext, setTempContext] = useState("");
  
  // Confirmation Modal
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  
  // Video & Playback
  const videoRef = useRef<HTMLVideoElement>(null);
  const subtitleContainerRef = useRef<HTMLDivElement>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0); 
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Subtitle Display Logic
  const [showExpandedCaptions, setShowExpandedCaptions] = useState(true); 
  const [showBottomSubtitle, setShowBottomSubtitle] = useState(true); 
  const [captionLayout, setCaptionLayout] = useState<'overlay' | 'side'>('overlay');
  
  // Manual Time Input
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInputValue, setTimeInputValue] = useState("");

  // Auto-scroll Logic
  const [autoScroll, setAutoScroll] = useState(true);
  const isAutoScrollingRef = useRef(false); 

  // New State for source switching
  const hasVideo = !!videoFile || !!videoDriveId;
  const [activeMediaType, setActiveMediaType] = useState<'video' | 'audio'>(hasVideo ? 'video' : 'audio');

  // Detail Modal State
  const [editingItem, setEditingItem] = useState<ExtendedVocabItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItemContext, setEditingItemContext] = useState("");

  // Restore playback time
  useEffect(() => {
    const mediaKey = videoDriveId || videoFile?.name || 'default_media';
    const savedTime = localStorage.getItem(`verbaflow_progress_${mediaKey}`);
    
    if (savedTime && videoRef.current) {
        const time = parseFloat(savedTime);
        if(!isNaN(time)){
            setTimeout(() => {
                if(videoRef.current) videoRef.current.currentTime = time;
                setCurrentTime(time);
            }, 500);
        }
    }
  }, [videoDriveId, videoFile]);

  // Save playback time
  useEffect(() => {
      const interval = setInterval(() => {
          if (currentTime > 0) {
              const mediaKey = videoDriveId || videoFile?.name || 'default_media';
              localStorage.setItem(`verbaflow_progress_${mediaKey}`, currentTime.toString());
          }
      }, 1000);
      return () => clearInterval(interval);
  }, [currentTime, videoDriveId, videoFile]);

  // Handle Video Prop
  useEffect(() => {
      if (videoFile && setPreviewVideoUrl && !previewVideoUrl) {
          const url = URL.createObjectURL(videoFile);
          setPreviewVideoUrl(url);
          setActiveMediaType('video');
      }
  }, [videoFile, setPreviewVideoUrl, previewVideoUrl]);

  // Handle Drive Video
  useEffect(() => {
      if (videoDriveId && setPreviewVideoUrl && !previewVideoUrl) {
          const fetchDriveVideo = async () => {
              setIsLoadingMedia(true);
              try {
                  const blob = await getDriveFileContent(videoDriveId);
                  const url = URL.createObjectURL(blob);
                  setPreviewVideoUrl(url);
                  setActiveMediaType('video');
              } catch (e) {
                  console.error("Failed to load Drive video", e);
                  alert("Failed to load video from Drive. Please check network/permissions.");
              } finally {
                  setIsLoadingMedia(false);
              }
          };
          fetchDriveVideo();
      }
  }, [videoDriveId, setPreviewVideoUrl, previewVideoUrl]);

  // Load data & Assign Unique IDs
  useEffect(() => {
    if (data?.vocabList) {
      const processedList: ExtendedVocabItem[] = data.vocabList.map((v, index) => ({
          ...v,
          internalId: `row-${v.id}-${index}-${Date.now()}-${Math.random().toString(36).substring(7)}`, 
          aiReason: v.aiReason || (v as any).remarks || '', 
          remarks: undefined, 
          userNote: v.userNote || '',
          customStatus: v.customStatus || ''
      }));
      setVocabList(processedList);
      setInitialVocab(JSON.parse(JSON.stringify(processedList)));
    }
  }, [data]);

  // Expansion default
  useEffect(() => {
    if (isExpanded) {
        setShowBottomSubtitle(false);
    } else {
        setShowBottomSubtitle(true);
    }
  }, [isExpanded]);

  // Auto-Scroll
  useEffect(() => {
      if (autoScroll && captionLayout === 'side' && subtitleContainerRef.current) {
          if (currentIndex !== -1) {
              const activeEl = document.getElementById(`subtitle-${currentIndex}`);
              if (activeEl) {
                  isAutoScrollingRef.current = true;
                  activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  setTimeout(() => { isAutoScrollingRef.current = false; }, 500);
              }
          } 
      }
  }, [currentIndex, autoScroll, captionLayout]);

  const handleSubtitleContainerScroll = () => {
      if (!isAutoScrollingRef.current && autoScroll) {
          setAutoScroll(false);
      }
  };

  const handleToggleAutoScroll = () => {
      if (autoScroll) {
          setAutoScroll(false);
      } else {
          setAutoScroll(true);
          
          let targetIdx = currentIndex;
          
          if (targetIdx === -1 && subtitles.length > 0) {
              for (let i = subtitles.length - 1; i >= 0; i--) {
                  if (subtitles[i].startTime <= currentTime) {
                      targetIdx = i;
                      break;
                  }
              }
              if (targetIdx === -1) targetIdx = 0;
          }

          if (targetIdx !== -1 && subtitleContainerRef.current) {
              const activeEl = document.getElementById(`subtitle-${targetIdx}`);
              if (activeEl) {
                  isAutoScrollingRef.current = true;
                  activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  setTimeout(() => { isAutoScrollingRef.current = false; }, 500);
              }
          }
      }
  };

  const handleSwitchSource = (type: 'audio' | 'video') => {
      if (type === 'audio' && audioUrl) {
          setActiveMediaType('audio');
      } else if (type === 'video' && (videoFile || videoDriveId)) {
          setActiveMediaType('video');
      }
  };

  const activeSource = activeMediaType === 'video' ? previewVideoUrl : audioUrl;
  const isVideoMode = activeMediaType === 'video' && !!previewVideoUrl;

  const togglePiP = async () => {
      if (videoRef.current && isVideoMode && 'requestPictureInPicture' in videoRef.current && document.pictureInPictureEnabled) {
          try {
              if (document.pictureInPictureElement) {
                  await document.exitPictureInPicture();
              } else {
                  await (videoRef.current as HTMLVideoElement).requestPictureInPicture();
                  setShowBottomSubtitle(true);
              }
          } catch (e) {
              console.error("PiP failed:", e);
          }
      }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      if (videoRef.current.duration && !isNaN(videoRef.current.duration)) {
          setDuration(videoRef.current.duration);
      }
      const idx = subtitles.findIndex(s => time >= s.startTime && time <= s.endTime);
      setCurrentIndex(idx);
      setCurrentSubtitle(idx !== -1 ? subtitles[idx].text : "");
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (videoRef.current) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
          setAutoScroll(false); 
      }
  };

  const safePlay = () => {
      if (videoRef.current) {
          const playPromise = videoRef.current.play();
          if (playPromise !== undefined) {
              playPromise.catch(error => {
                  console.log("Playback prevented/interrupted:", error);
                  setIsPlaying(false);
              });
          }
          setIsPlaying(true);
      }
  };

  const handlePlaySegment = (timeRange: string) => {
    if (!videoRef.current) {
        if (!activeSource) alert("No audio/video source available.");
        return;
    }

    const startSeconds = extractStartTimeFromRange(timeRange);
    const leadIn = Math.max(0, startSeconds - 1.0);
    
    if (videoRef.current.readyState >= 1) {
        videoRef.current.currentTime = leadIn;
        safePlay();
    } else {
        const onLoaded = () => {
            if(videoRef.current) {
                videoRef.current.currentTime = leadIn;
                safePlay();
                videoRef.current.removeEventListener('loadedmetadata', onLoaded);
            }
        };
        videoRef.current.addEventListener('loadedmetadata', onLoaded);
    }
    setAutoScroll(true);
  };

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        safePlay();
      }
    }
  };

  const handlePrevLine = () => {
      if (videoRef.current && subtitles.length > 0) {
          const newIndex = Math.max(0, currentIndex - 1);
          videoRef.current.currentTime = Math.max(0, subtitles[newIndex].startTime - 0.5);
          setAutoScroll(true);
          if(!isPlaying) {
              safePlay();
          }
      }
  };

  const handleNextLine = () => {
      if (videoRef.current && subtitles.length > 0) {
          const newIndex = Math.min(subtitles.length - 1, currentIndex + 1);
          videoRef.current.currentTime = subtitles[newIndex].startTime;
          setAutoScroll(true);
          if(!isPlaying) {
              safePlay();
          }
      }
  };

  const handleTimeClick = () => {
      setTimeInputValue(formatTime(currentTime));
      setIsEditingTime(true);
      if(videoRef.current && isPlaying) {
          videoRef.current.pause();
          setIsPlaying(false);
      }
  };

  const handleTimeSubmit = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          const seconds = parseFlexibleTime(timeInputValue);
          if (seconds !== null && videoRef.current) {
              videoRef.current.currentTime = seconds;
              setAutoScroll(true);
          }
          setIsEditingTime(false);
      } else if (e.key === 'Escape') {
          setIsEditingTime(false);
      }
  };

  const handleUpdateVocab = (internalId: string, field: keyof VocabItem, value: string) => {
    setVocabList(prev => prev.map(item => 
      item.internalId === internalId ? { ...item, [field]: value } : item
    ));
    if (editingItem && editingItem.internalId === internalId) {
        setEditingItem(prev => prev ? { ...prev, [field]: value } : null);
    }
  };

  const handleStatusChange = (internalId: string, status: VocabItem['status']) => {
    setVocabList(prev => prev.map(item => 
      item.internalId === internalId ? { ...item, status } : item
    ));
  };

  const handleResetConfirm = () => {
    setVocabList(JSON.parse(JSON.stringify(initialVocab)));
    setIsResetConfirmOpen(false);
  };
  
  // Background Glossary Extraction Logic (Non-Blocking)
  const handleSmartExtract = async (mode: 'new' | 'append') => {
      // 1. Close Modal Immediately
      setIsExtractModalOpen(false);
      
      // 2. Set Background Task State
      setBackgroundTask({ message: t.analysis.extractModal.processing, type: 'loading' });

      try {
          const vocabText = vocabList
            .filter(v => v.status === 'corrected' || v.status === 'custom')
            .map(v => `${v.corrected} (${v.type})`).join('\n');
            
          if (!vocabText) {
             setBackgroundTask({ message: t.messages.noTermsFound, type: 'error' });
             setTimeout(() => setBackgroundTask(null), 3000);
             return;
          }

          // ASYNC OPERATION
          const newTerms = await generateSmartGlossary(vocabText, vocabList, 'gemini-3-flash-preview', 'Chinese', llmApiKey, llmBaseUrl);
          
          if (newTerms.length === 0) {
             setBackgroundTask({ message: t.messages.noTermsExtracted, type: 'error' });
             setTimeout(() => setBackgroundTask(null), 3000);
             return;
          }

          if (mode === 'new') {
              const newSet: GlossarySet = {
                  id: `set-${Date.now()}`,
                  title: `Extracted ${new Date().toLocaleTimeString()}`,
                  tags: ['Auto-Extracted'],
                  description: 'From Analysis Studio',
                  items: newTerms,
                  createdAt: Date.now(),
                  updatedAt: Date.now()
              };
              await storage.saveGlossarySet(newSet);
          } else {
              const sets = await storage.getAllGlossarySets();
              if (sets.length > 0) {
                  const target = sets[0]; 
                  const merged = [...target.items];
                  newTerms.forEach(nt => {
                      if (!merged.some(m => m.term.toLowerCase() === nt.term.toLowerCase())) {
                          merged.push(nt);
                      }
                  });
                  await storage.saveGlossarySet({ ...target, items: merged, updatedAt: Date.now() });
              } else {
                   // Fallback if no sets exist
                   const newSet: GlossarySet = {
                      id: `set-${Date.now()}`,
                      title: `Extracted ${new Date().toLocaleTimeString()}`,
                      tags: ['Auto-Extracted'],
                      description: 'From Analysis Studio',
                      items: newTerms,
                      createdAt: Date.now(),
                      updatedAt: Date.now()
                  };
                  await storage.saveGlossarySet(newSet);
              }
          }
          
          // 3. Success Notification
          setBackgroundTask({ message: t.messages.extractSuccess.replace('{n}', newTerms.length.toString()), type: 'success' });
          setTimeout(() => setBackgroundTask(null), 4000);

      } catch (e) {
          console.error(e);
          setBackgroundTask({ message: t.messages.extractFailed, type: 'error' });
          setTimeout(() => setBackgroundTask(null), 4000);
      }
  };

  const handleFixTimestamps = async () => {
      if(!subtitles.length || !llmApiKey) return;
      setIsFixingTime(true);
      try {
          const reconstructedSRT = subtitles.map((s, i) => `${i+1}\n${formatTime(s.startTime)} --> ${formatTime(s.endTime)}\n${s.text}`).join('\n\n');
          const fixedList = await fixVocabTimestamps(reconstructedSRT, vocabList, llmApiKey, llmBaseUrl);
          setVocabList(prev => prev.map(item => {
              const fixed = fixedList.find(f => f.id === item.id);
              return fixed ? { ...item, timeRange: fixed.timeRange } : item;
          }));
          alert(t.messages.timestampsFixed);
      } catch (e) {
          console.error(e);
          alert(t.messages.timestampsFailed);
      } finally {
          setIsFixingTime(false);
      }
  };

  const openDetailModal = (item: ExtendedVocabItem) => {
      setEditingItem(item);
      setEditingItemContext(getContextFromSRT(subtitles, item.timeRange));
      setIsModalOpen(true);
  };

  const handleAgentAsk = (item: VocabItem) => {
      if (onAskAgent) {
          const prompt = `
          I need help with this specific subtitle term:
          
          **Term**: "${item.original}"
          **Time**: ${item.timeRange}
          **Context**:
          ${getContextFromSRT(subtitles, item.timeRange, 1)}
          
          **AI Suggestion**: "${item.corrected}"
          **AI Reason**: ${item.aiReason || 'N/A'}
          **My Notes**: ${item.userNote || 'N/A'}
          `;
          onAskAgent(prompt);
      }
  };

  // Trigger Re-Analyze when saving instructions
  const handleInstructionSave = () => {
      setExtraContext(tempContext);
      setIsInstructionModalOpen(false);
      
      // TRIGGER RE-ANALYSIS WITH NEW CONTEXT
      // We pass the tempContext directly to ensure we use the latest input
      onReAnalyze(tempContext, vocabList); 
  };

  // --- RENDER LOADING STATE (If data is missing or explicitly loading initial analysis) ---
  if (isLoading && (!data || vocabList.length === 0)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center h-[50vh] animate-in fade-in zoom-in duration-300">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t.analysis.loadingTitle}</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-2">{t.analysis.loadingSub}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
      
      {isLoading && vocabList.length > 0 && (
          <div className="absolute inset-0 z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center animate-in fade-in duration-300">
               <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-2xl flex flex-col items-center border border-slate-200 dark:border-slate-700">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.analysis.reAnalyzing}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Updating analysis with latest instructions & glossary...</p>
               </div>
          </div>
      )}

      {/* --- BACKGROUND TASK TOAST --- */}
      {backgroundTask && (
          <div className="absolute bottom-32 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 pointer-events-none">
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md ${
                  backgroundTask.type === 'success' ? 'bg-green-500/90 text-white border-green-400' :
                  backgroundTask.type === 'error' ? 'bg-red-500/90 text-white border-red-400' :
                  'bg-slate-800/90 text-white border-slate-600'
              }`}>
                  {backgroundTask.type === 'loading' ? <Loader2 size={18} className="animate-spin" /> : 
                   backgroundTask.type === 'success' ? <CheckCheck size={18} /> : <AlertCircle size={18} />}
                  <span className="text-sm font-medium">{backgroundTask.message}</span>
              </div>
          </div>
      )}

      {/* ... Confirmation Modals ... */}
      <ConfirmationModal 
          isOpen={isResetConfirmOpen}
          onClose={() => setIsResetConfirmOpen(false)}
          onConfirm={handleResetConfirm}
          title="Reset Changes"
          message="Are you sure you want to discard all your edits and revert to the original AI suggestions?"
          isDanger={true}
      />

      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 z-20">
          <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 whitespace-nowrap">
                  <PlayCircle className="text-indigo-600 hidden md:block" size={20} />
                  {t.analysis.step3Title}
                  <span className="text-xs font-normal bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-full ml-1">
                      {vocabList.filter(v => v.status !== 'corrected').length} {t.analysis.needsAttention}
                  </span>
              </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Merged Instruction & Re-check Button */}
              <button title={t.analysis.instructionsBtn} onClick={() => { setTempContext(extraContext); setIsInstructionModalOpen(true); }} className="p-2 px-3 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors border border-indigo-100 dark:border-indigo-900/30">
                  <Wand2 size={16} /> 
                  <span className="hidden lg:inline">{t.analysis.instructionsBtn}</span>
                  {extraContext && <span className="w-2 h-2 rounded-full bg-indigo-500"></span>}
              </button>

              <button title={t.analysis.extractBtn} onClick={() => setIsExtractModalOpen(true)} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors border border-slate-200 dark:border-slate-700">
                  <FolderDown size={16} /> <span className="hidden lg:inline">{t.analysis.extractBtn}</span>
              </button>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 hidden md:block"></div>

              <button title={t.analysis.glossaryBtn} onClick={onOpenGlossary} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors border border-slate-200 dark:border-slate-700">
                  <BookOpen size={16} /> <span className="hidden lg:inline">{t.analysis.glossaryBtn}</span>
              </button>
              
              <button onClick={handleFixTimestamps} disabled={isFixingTime} className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors border border-slate-200 dark:border-slate-700" title={t.analysis.fixTimeBtn}>
                  {isFixingTime ? <Loader2 size={16} className="animate-spin" /> : <Timer size={16} />}
                  <span className="hidden lg:inline">{t.analysis.fixTimeBtn}</span>
              </button>

              <button onClick={() => setIsResetConfirmOpen(true)} className="p-2 text-slate-500 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700" title={t.analysis.resetBtn}>
                  <RotateCcw size={18} />
              </button>

              {/* Format Selector */}
              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 rounded-lg px-2 border border-slate-200 dark:border-slate-700 ml-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase">{t.analysis.formatLabel}</span>
                  <select 
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-200 outline-none py-1.5 cursor-pointer"
                  >
                      <option value="srt">.SRT</option>
                      <option value="vtt">.VTT</option>
                      <option value="ass">.ASS</option>
                      <option value="json">.JSON</option>
                  </select>
              </div>

              <button 
                  onClick={() => onConfirm(vocabList, extraContext, selectedFormat)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 flex items-center gap-2 transition-transform active:scale-95"
              >
                  <CheckCheck size={16} /> {t.analysis.confirmAllBtn}
              </button>
          </div>
      </div>

      {/* ... (Rest of the component remains the same: summary, table, modals, video player) ... */}
      
      {/* 2. Main Content Area - FLEXBOX LAYOUT (Solves Overlap) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
          {data.summary && (
              <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                  <button 
                    onClick={() => setShowSummary(!showSummary)}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm flex items-center gap-2">
                          <List size={16} className="text-indigo-500" />
                          {t.analysis.summaryTitle}
                      </h3>
                      {showSummary ? <ChevronUp size={16} className="text-slate-400"/> : <ChevronDown size={16} className="text-slate-400"/>}
                  </button>
                  
                  {showSummary && (
                      <div className="p-4 grid md:grid-cols-3 gap-6 text-sm">
                          <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                  <MessageSquare size={14} /> {t.analysis.topic}
                              </div>
                              <p className="font-medium text-slate-800 dark:text-slate-200">{data.summary.topic}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500 mt-2">
                                  <Clock size={12} /> {data.summary.duration}
                              </div>
                          </div>
                          
                          <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                  <Users size={14} /> {t.analysis.speakers}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                  {data.summary.speakers.map((s, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs">
                                          {s}
                                      </span>
                                  ))}
                              </div>
                          </div>

                          <div className="space-y-2">
                              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase">
                                  <List size={14} /> {t.analysis.agenda}
                              </div>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                                  {data.summary.agenda.slice(0, 5).map((a, i) => (
                                      <li key={i} className="whitespace-pre-wrap">{a}</li>
                                  ))}
                              </ul>
                          </div>
                      </div>
                  )}
              </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
              <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                      <tr>
                          <th className="p-4 w-12 text-center">#</th>
                          <th className="p-4 w-24">{t.analysis.table.time}</th>
                          <th className="p-4 w-1/4">{t.analysis.table.original}</th>
                          <th className="p-4 w-1/4">{t.analysis.table.corrected}</th>
                          <th className="p-4 w-28">{t.analysis.table.status}</th>
                          <th className="p-4 w-48 hidden 2xl:table-cell text-slate-400">AI Note</th>
                          <th className="p-4 w-48 hidden xl:table-cell text-slate-400">User Note</th>
                          <th className="p-4 w-20 text-center">{t.analysis.table.detail}</th>
                      </tr>
                  </thead>
                  <tbody className="text-sm text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800">
                      {vocabList.map((item) => (
                          <tr key={item.internalId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 group transition-colors">
                              <td className="p-3 text-center">
                                  <button onClick={() => handlePlaySegment(item.timeRange)} className="text-indigo-600 dark:text-indigo-400 hover:scale-110 transition-transform">
                                      <PlayCircle size={18} />
                                  </button>
                              </td>
                              <td className="p-3 text-slate-500 font-mono text-xs">{item.timeRange}</td>
                              <td className="p-3 font-medium select-text whitespace-pre-wrap">{item.original}</td>
                              <td className="p-3">
                                  <input 
                                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:bg-white dark:focus:bg-slate-950 rounded-md px-2 py-1.5 transition-all outline-none text-sm"
                                      value={item.corrected}
                                      onChange={(e) => handleUpdateVocab(item.internalId, 'corrected', e.target.value)}
                                  />
                              </td>
                              <td className="p-3">
                                  <div className="flex flex-col gap-1">
                                      <select 
                                          value={item.status}
                                          onChange={(e) => handleStatusChange(item.internalId, e.target.value as any)}
                                          className={`w-full p-1.5 rounded text-xs font-semibold border-none outline-none cursor-pointer ${
                                              item.status === 'corrected' ? 'text-green-700 bg-green-50 dark:bg-green-900/30' : 
                                              item.status === 'needs_confirmation' ? 'text-amber-700 bg-amber-50 dark:bg-amber-900/30' :
                                              item.status === 'ai_recheck' ? 'text-purple-700 bg-purple-50 dark:bg-purple-900/30' :
                                              item.status === 'custom' ? 'text-blue-700 bg-blue-50 dark:bg-blue-900/30' :
                                              'text-slate-600 bg-slate-100 dark:bg-slate-700'
                                          }`}
                                      >
                                          <option value="corrected">{t.analysis.statusOptions.verified}</option>
                                          <option value="needs_confirmation">{t.analysis.statusOptions.confirm}</option>
                                          <option value="ai_recheck">{t.analysis.statusOptions.ai_recheck}</option>
                                          <option value="check_spelling">{t.analysis.statusOptions.check}</option>
                                          <option value="custom">{t.analysis.statusOptions.custom}</option>
                                      </select>
                                      {item.status === 'custom' && (
                                          <input 
                                            placeholder="Status..."
                                            className="w-full text-xs p-1 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                                            value={item.customStatus || ''}
                                            onChange={(e) => handleUpdateVocab(item.internalId, 'customStatus', e.target.value)}
                                          />
                                      )}
                                  </div>
                              </td>
                              <td 
                                  className="p-3 hidden 2xl:table-cell cursor-pointer"
                                  onClick={() => openDetailModal(item)}
                                  title="Click to view full AI note"
                              >
                                  <div className="text-xs text-slate-500 line-clamp-2 hover:text-indigo-600 hover:underline transition-colors">
                                      {item.aiReason}
                                  </div>
                              </td>
                              <td className="p-3 hidden xl:table-cell">
                                  <input 
                                      className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none text-xs text-slate-600 dark:text-slate-400 placeholder:text-slate-300"
                                      value={item.userNote || ''}
                                      onChange={(e) => handleUpdateVocab(item.internalId, 'userNote', e.target.value)}
                                      placeholder="Add instructions..."
                                  />
                              </td>
                              <td className="p-3 text-center">
                                  <div className="flex justify-center gap-1">
                                      <button 
                                        className="xl:hidden p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                        onClick={() => openDetailModal(item)}
                                        title="Quick Instruction"
                                      >
                                          <FilePenLine size={16} />
                                          {item.userNote && <span className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-full"></span>}
                                      </button>
                                      <button onClick={() => openDetailModal(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                          <Edit2 size={16} />
                                      </button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      </div>

      {/* Extract Modal */}
      {isExtractModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6 border border-slate-200 dark:border-slate-700 animate-in fade-in zoom-in duration-200">
                <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Sparkles size={18} className="text-indigo-500" />
                    {t.analysis.extractModal.title}
                </h3>
                <p className="text-sm text-slate-500 mb-6">{t.analysis.extractModal.desc}</p>
                <div className="flex gap-3 flex-col">
                    <button onClick={() => handleSmartExtract('new')} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-left transition-colors flex items-center gap-3">
                        <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-full text-indigo-600"><FolderDown size={18} /></div>
                        <div className="flex-1"><div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{t.analysis.extractModal.newSet}</div></div>
                    </button>
                    <button onClick={() => handleSmartExtract('append')} className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left transition-colors flex items-center gap-3 opacity-75">
                         <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full text-slate-600"><List size={18} /></div>
                        <div className="flex-1"><div className="font-semibold text-sm text-slate-800 dark:text-slate-200">{t.analysis.extractModal.addTo}</div></div>
                    </button>
                </div>
                <div className="mt-6 flex justify-end">
                    <button onClick={() => setIsExtractModalOpen(false)} className="text-sm text-slate-500 hover:text-slate-800 px-4 py-2">{t.analysis.extractModal.cancel}</button>
                </div>
             </div>
          </div>
      )}

      {/* Instruction Modal */}
      {isInstructionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
                <h3 className="text-lg font-bold mb-4 text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Wand2 size={18} className="text-indigo-500" />
                    {t.analysis.instructionModal.title}
                </h3>
                <p className="text-sm text-slate-500 mb-4">{t.analysis.instructionModal.desc}</p>
                <textarea 
                    className="w-full h-32 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    placeholder={t.analysis.instructionModal.placeholder}
                    value={tempContext}
                    onChange={(e) => setTempContext(e.target.value)}
                />
                <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => setIsInstructionModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-sm">{t.common.cancel}</button>
                    <button 
                        onClick={handleInstructionSave}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <RefreshCw size={14} />
                        {t.analysis.instructionModal.save}
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Detail Modal */}
      {isModalOpen && editingItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
              <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-950">
                      <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center gap-2"><Edit2 size={18} className="text-indigo-600" /> {t.analysis.detailPanel.title}</h3>
                      <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full"><X size={20} /></button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-6">
                      <div className="flex items-center gap-2 text-sm text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg w-fit"><Timer size={14} /><span>{editingItem.timeRange}</span></div>
                      <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700"><label className="text-xs font-bold text-slate-500 uppercase mb-2 block">{t.analysis.detailPanel.context}</label><p className="text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{editingItemContext}</p></div>
                      {editingItem.aiReason && (<div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-900/30"><label className="text-xs font-bold text-indigo-600 uppercase mb-1 block">AI Note</label><p className="text-sm text-indigo-800 dark:text-indigo-200">{editingItem.aiReason}</p></div>)}
                      <div className="space-y-4">
                          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.analysis.detailPanel.correction}</label><input className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors" value={editingItem.corrected} onChange={(e) => handleUpdateVocab(editingItem.internalId, 'corrected', e.target.value)} /></div>
                          <div><label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t.analysis.detailPanel.userNote}</label><textarea className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none transition-colors" value={editingItem.userNote || ''} onChange={(e) => handleUpdateVocab(editingItem.internalId, 'userNote', e.target.value)} placeholder="Add instructions for AI re-analysis..." /></div>
                      </div>
                  </div>
                  <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex justify-between">
                      <button onClick={() => handleAgentAsk(editingItem)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 flex items-center gap-2 text-sm font-medium"><MessageSquare size={16} /> {t.analysis.askAgent}</button>
                      <button onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md transition-colors">{t.analysis.detailPanel.save}</button>
                  </div>
              </div>
          </div>
      )}

      {/* Persistent Player Bar */}
      <div 
        className={`flex-shrink-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col relative`}
        style={{ height: isExpanded ? '60vh' : '96px' }}
      >
          {/* ... (Player controls remain the same) ... */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700 cursor-pointer group z-40">
              <div
                  className="h-full bg-indigo-600 relative transition-all duration-100 ease-out"
                  style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              >
                   <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity transform scale-150" />
              </div>
              <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Seek"
              />
          </div>

          <div className="flex flex-col h-full max-w-full relative">
              
              {/* Keep Video Alive Logic: When collapsed, use h-px opacity-0 instead of h-0 to prevent browser pausing logic */}
              <div className={`relative bg-black flex overflow-hidden group transition-all duration-300 ${isExpanded ? 'flex-1' : 'h-px opacity-0 pointer-events-none'}`}>
                    {isVideoMode && activeSource ? (
                        <div className="flex-1 relative flex items-center justify-center bg-black h-full">
                             <div className={`relative flex items-center justify-center w-full h-full ${captionLayout === 'side' && isExpanded ? 'pr-80 lg:pr-96' : ''}`}>
                                 <video 
                                    ref={videoRef}
                                    src={previewVideoUrl}
                                    className="w-full h-full object-contain"
                                    onTimeUpdate={handleTimeUpdate}
                                    onEnded={() => setIsPlaying(false)}
                                    playsInline
                                 />
                                 
                                 {showExpandedCaptions && captionLayout === 'overlay' && isExpanded && (
                                     <div className="absolute bottom-10 left-0 right-0 text-center z-20 px-8 pointer-events-none">
                                         <div className="inline-block bg-black/70 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-lg transition-all space-y-2 max-w-4xl mx-auto">
                                             <p className="text-lg md:text-xl font-bold leading-relaxed text-balance">
                                                 {currentSubtitle || "..."}
                                             </p>
                                         </div>
                                     </div>
                                 )}

                                 <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-black/60 backdrop-blur-md rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                      <button onClick={() => setCaptionLayout(l => l === 'overlay' ? 'side' : 'overlay')} className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"><LayoutTemplate size={18} /></button>
                                      <button onClick={() => setShowExpandedCaptions(!showExpandedCaptions)} className={`p-2 rounded-full transition-colors ${showExpandedCaptions ? 'text-indigo-400 bg-indigo-500/20' : 'text-white/80 hover:bg-white/10'}`}><Captions size={18} /></button>
                                      <div className="w-px h-4 bg-white/20 mx-1"></div>
                                      <button onClick={() => setIsExpanded(false)} className="p-2 text-white/80 hover:text-white hover:bg-red-500/20 rounded-full transition-colors"><Minimize2 size={18} /></button>
                                 </div>
                             </div>
                             
                             {captionLayout === 'side' && isExpanded && (
                                 <div className="absolute right-0 top-0 bottom-0 w-80 lg:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col z-20">
                                      <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs uppercase tracking-wider text-slate-500">Transcript</div>
                                      <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={subtitleContainerRef} onScroll={handleSubtitleContainerScroll}>
                                          {subtitles.map((s, idx) => (
                                              <div key={s.id} id={`subtitle-${idx}`} onClick={() => handlePlaySegment(`${formatTime(s.startTime)}-${formatTime(s.endTime)}`)} className={`cursor-pointer transition-all duration-200 text-sm p-3 rounded-lg border ${idx === currentIndex ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                                                  <div className={`flex items-center justify-between text-xs font-mono mb-1 ${idx === currentIndex ? 'text-indigo-200' : 'opacity-50'}`}><span>{formatTime(s.startTime)}</span></div>
                                                  <p className="font-medium leading-relaxed">{s.text}</p>
                                              </div>
                                          ))}
                                      </div>
                                      {!autoScroll && (
                                          <button onClick={handleToggleAutoScroll} className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition-transform active:scale-95 animate-in fade-in zoom-in duration-200 flex items-center gap-2 px-4 font-bold text-xs z-30"><Crosshair size={14} /> Sync</button>
                                      )}
                                 </div>
                             )}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center w-full h-full bg-slate-900 p-8">
                            {isLoadingMedia ? (
                                <div className="text-center">
                                    <Loader2 size={48} className="animate-spin text-indigo-500 mb-4 mx-auto" />
                                    <p className="text-slate-400">Loading media from Cloud...</p>
                                </div>
                            ) : (
                                <>
                                    <div className="p-8 rounded-full bg-slate-800 mb-6 animate-pulse ring-4 ring-slate-800/50"><Headphones size={64} className="text-indigo-400" /></div>
                                    <div className="max-w-xl text-center space-y-4">
                                        <p className="text-2xl font-bold text-white">{currentSubtitle || "..."}</p>
                                        <p className="text-slate-500 text-sm">Audio Mode Active</p>
                                    </div>
                                    <audio 
                                        ref={videoRef as any}
                                        src={audioUrl || undefined}
                                        onTimeUpdate={handleTimeUpdate}
                                        onEnded={() => setIsPlaying(false)}
                                    />
                                </>
                            )}
                            <button onClick={() => setIsExpanded(false)} className="absolute top-4 right-4 p-2 text-white/50 hover:text-white rounded-lg hover:bg-white/10"><Minimize2 size={20} /></button>
                        </div>
                    )}
              </div>

              <div className="flex-shrink-0 h-24 px-6 flex items-center gap-6 w-full relative z-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-4">
                      {/* REDESIGNED CONTROLS: SMALLER CIRCULAR PREV/NEXT */}
                      <button title={t.videoControls.prev} onClick={handlePrevLine} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-indigo-600 transition-all active:scale-95 border border-slate-200 dark:border-slate-700"><RotateCcw size={20} /></button>
                      <button onClick={togglePlayback} disabled={!activeSource} className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30 flex-shrink-0 transition-transform active:scale-95">
                          {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                      </button>
                      <button title={t.videoControls.next} onClick={handleNextLine} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-indigo-600 transition-all active:scale-95 border border-slate-200 dark:border-slate-700"><RotateCw size={20} /></button>
                  </div>

                  <div className="ml-6 min-w-[120px] hidden md:block">
                     {isEditingTime ? (
                         <div className="flex items-center justify-center">
                             <input 
                                className="w-24 bg-transparent border-b-2 border-indigo-600 text-center font-mono text-sm focus:outline-none text-indigo-600 dark:text-indigo-400 font-bold" 
                                value={timeInputValue} 
                                onChange={(e) => setTimeInputValue(e.target.value)} 
                                onKeyDown={handleTimeSubmit} 
                                autoFocus 
                                onBlur={() => setIsEditingTime(false)} 
                             />
                         </div>
                     ) : (
                         <div className="text-xs font-mono font-medium text-slate-500 cursor-text hover:bg-slate-100 dark:hover:bg-slate-800 px-2 py-1 rounded transition-colors group relative" onClick={handleTimeClick} title="Click to jump to time">
                             <span className="text-slate-800 dark:text-slate-200 group-hover:text-indigo-600">{formatTime(currentTime)}</span>
                             <span className="mx-1 opacity-50">/</span>
                             <span className="opacity-70">{formatTime(duration)}</span>
                         </div>
                     )}
                  </div>

                  <div className="flex-1 mx-4 relative group">
                      {showBottomSubtitle ? (
                          <div className="text-center px-4 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden flex items-center justify-center h-14">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{currentSubtitle || <span className="text-slate-400 opacity-50 text-xs italic">...</span>}</p>
                          </div>
                      ) : (
                          <div className="h-14 flex items-center justify-center border border-dashed border-slate-200 dark:border-slate-800 rounded-lg text-xs text-slate-400">Subtitle Hidden</div>
                      )}
                      <button onClick={() => setShowBottomSubtitle(!showBottomSubtitle)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-indigo-600 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors opacity-0 group-hover:opacity-100">{showBottomSubtitle ? <Eye size={16} /> : <EyeOff size={16} />}</button>
                  </div>

                  <div className="flex items-center gap-2">
                     <button onClick={handleToggleAutoScroll} className={`p-2 rounded-lg transition-colors hidden md:block ${autoScroll ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`} title={autoScroll ? "Lock Scroll (On)" : "Lock Scroll (Off)"}>
                         {autoScroll ? <Lock size={20} /> : <LockOpen size={20} />}
                     </button>
                     <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-2 hidden md:block"></div>
                     
                     <div className="bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl flex items-center border border-slate-200 dark:border-slate-700">
                        <button onClick={() => handleSwitchSource('audio')} disabled={!audioUrl} className={`p-2 rounded-lg transition-all ${activeMediaType === 'audio' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'} ${!audioUrl ? 'opacity-50 cursor-not-allowed' : ''}`}><Headphones size={20} /></button>
                        <button onClick={() => handleSwitchSource('video')} disabled={!hasVideo} className={`p-2 rounded-lg relative transition-all ${activeMediaType === 'video' ? 'bg-white dark:bg-slate-700 shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'} ${!hasVideo ? 'opacity-50 cursor-not-allowed' : ''}`}><Video size={20} /></button>
                     </div>
                     <div className="w-px h-6 bg-slate-300 dark:bg-slate-700 mx-2"></div>
                     {videoDriveId && (
                         <div title="Streaming from Drive" className="text-blue-500 mr-1"><Cloud size={20} /></div>
                     )}
                     <button onClick={togglePiP} disabled={!isVideoMode} className={`p-2 rounded-lg transition-colors hidden md:block ${!isVideoMode ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><PictureInPicture2 size={20} /></button>
                     <button onClick={() => setIsExpanded(!isExpanded)} className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>{isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}</button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
