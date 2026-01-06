
import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, VocabItem, SubtitleItem, GlossarySet } from '../types';
import { 
  AlertCircle, Loader2, PlayCircle, Play, Pause, BookOpen, RefreshCw, 
  CheckCheck, Video, Maximize2, Minimize2, MessageSquare, Edit2, 
  ChevronDown, ChevronUp, Clock, Users, List, Wand2, FolderDown, Timer, 
  Captions, LayoutTemplate, Headphones, RotateCcw, RotateCw, Crosshair, FilePenLine, 
  PictureInPicture2, Eye, EyeOff, Cloud, Lock, LockOpen, Check, BrainCircuit, Terminal,
  ArrowRight, ArrowLeft, Sidebar, Monitor, Save, Plus, X, Sparkles, Music, Film
} from 'lucide-react';
import { extractStartTimeFromRange, formatTime, getContextFromSRT, parseFlexibleTime } from '../utils/srtParser';
import { useLanguage } from '../contexts/LanguageContext';
import { getDriveFileContent } from '../services/googleDriveService';
import { generateSmartGlossary, fixVocabTimestamps } from '../services/geminiService';
import { storage } from '../services/storage';
import { useConfig } from '../contexts/ConfigContext';
import { ConfirmationModal } from './ConfirmationModal';
import { GlossarySelectorModal } from './GlossarySelectorModal';

// Extend VocabItem to include a frontend-only unique ID
interface ExtendedVocabItem extends VocabItem {
  internalId: string;
}

interface Props {
  data: AnalysisResult | null;
  isLoading: boolean;
  onConfirm: (finalVocab: VocabItem[], extraContext: string, format: string) => void;
  onRetry: () => void;
  onReAnalyze: (extraContext: string, currentVocab?: VocabItem[]) => void;
  audioUrl: string | null;
  videoFile?: File | null;
  videoDriveId?: string;
  previewVideoUrl?: string | null;
  setPreviewVideoUrl?: (url: string | null) => void;
  subtitles: SubtitleItem[];
  // Replaced simple toggle with more robust props
  onOpenGlossary: () => void; 
  glossarySets: GlossarySet[];
  selectedGlossaryIds: string[];
  onGlossarySelectionChange: (ids: string[]) => void;
  hasGlossary: boolean;
  onAskAgent?: (text: string) => void;
  defaultFormat?: string;
  streamLog?: string;
  onExtractToGlossary?: (setName: string, isNew: boolean, existingSetId?: string) => void;
}

const AnalysisLoadingState: React.FC<{ t: any, streamLog?: string }> = ({ t, streamLog }) => {
    const logRef = useRef<HTMLDivElement>(null);
    const hasData = streamLog && streamLog.length > 0;
    // New: Artificial staging to ensure animations are seen
    const [visualStep, setVisualStep] = useState(0); 
    
    // Auto-scroll log
    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [streamLog]);

    // Force step progression timer
    useEffect(() => {
        const timers: ReturnType<typeof setTimeout>[] = [];
        timers.push(setTimeout(() => setVisualStep(1), 800)); // Connect done
        
        if (hasData) {
             timers.push(setTimeout(() => setVisualStep(2), 1600)); // Streaming done
             timers.push(setTimeout(() => setVisualStep(3), 2400)); // Parsing done
        }

        return () => timers.forEach(clearTimeout);
    }, [hasData]);

    const dataSize = streamLog ? (new TextEncoder().encode(streamLog).length / 1024).toFixed(2) + ' KB' : '0 KB';

    return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-[70vh] animate-in fade-in zoom-in duration-500">
            <div className="relative mb-8">
                <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl relative border border-indigo-100 dark:border-indigo-900/30">
                    <BrainCircuit className={`w-12 h-12 text-indigo-600 ${hasData ? 'animate-pulse-fast' : 'animate-pulse'}`} />
                </div>
            </div>
            
            <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6">
                {t.analysis.loadingTitle}
            </h3>
            
            {/* Steps */}
            <div className="w-full max-w-lg mb-8 grid grid-cols-3 gap-4">
                <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-500 ${
                    visualStep >= 1 ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-60'
                }`}>
                    {visualStep >= 1 ? <Check className="text-green-500" size={20} /> : <Loader2 className="animate-spin text-indigo-600" size={20} />}
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.analysis.realtimeSteps.connect}</span>
                </div>
                <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-500 ${
                    visualStep >= 2 ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-40'
                }`}>
                    {visualStep >= 2 ? <Check className="text-green-500" size={20} /> : (visualStep >= 1 ? <RefreshCw className="animate-spin text-indigo-600" size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>)}
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.analysis.realtimeSteps.streaming}</span>
                </div>
                <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-500 ${
                    visualStep >= 3 ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 shadow-sm' : 'bg-slate-50 dark:bg-slate-800/50 border-transparent opacity-40'
                }`}>
                    {visualStep >= 3 ? <Check className="text-green-500" size={20} /> : (visualStep >= 2 ? <Loader2 className="animate-spin text-indigo-600" size={20} /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600"></div>)}
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t.analysis.realtimeSteps.parsing}</span>
                </div>
            </div>

            {/* Terminal */}
            <div className="w-full max-w-2xl bg-slate-950 rounded-lg shadow-2xl border border-slate-800 flex flex-col overflow-hidden text-left h-64 relative group">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800">
                    <Terminal size={14} className="text-slate-400" />
                    <span className="text-xs font-mono text-slate-400">{t.analysis.terminal.logFile}</span>
                    <div className="flex-1"></div>
                    {hasData && <div className="text-[10px] text-green-400 font-mono flex items-center gap-1"><ArrowRight size={10}/> {dataSize}</div>}
                </div>
                <div 
                    ref={logRef}
                    className="flex-1 p-4 overflow-y-auto font-mono text-xs text-green-400/90 whitespace-pre-wrap scrollbar-thin scrollbar-thumb-slate-700 leading-relaxed"
                >
                    {streamLog || (
                        <div className="h-full flex items-center justify-center text-slate-600 italic">
                            <Loader2 className="animate-spin mr-2" size={14} />
                            {t.analysis.terminal.waiting}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const AnalysisSuccessState: React.FC<{ t: any }> = ({ t }) => (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-[70vh] animate-in fade-in zoom-in duration-300">
        <div className="bg-green-100 dark:bg-green-900/30 p-6 rounded-full mb-6 animate-in zoom-in spin-in-12 duration-500">
            <CheckCheck className="w-16 h-16 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">{t.analysis.success.title}</h2>
        <p className="text-slate-500 dark:text-slate-400 animate-pulse">{t.analysis.success.redirect}</p>
    </div>
);

export const AnalysisView: React.FC<Props> = ({ 
  data, isLoading, onConfirm, onRetry, onReAnalyze, audioUrl, videoFile, videoDriveId, previewVideoUrl, setPreviewVideoUrl,
  subtitles, onOpenGlossary, hasGlossary, onAskAgent, defaultFormat = 'srt', streamLog, glossarySets = [], selectedGlossaryIds, onGlossarySelectionChange, onExtractToGlossary
}) => {
  const { t, language } = useLanguage();
  const { llmApiKey, llmBaseUrl } = useConfig();
  
  const [vocabList, setVocabList] = useState<ExtendedVocabItem[]>([]);
  const [extraContext, setExtraContext] = useState("");
  const [showSummary, setShowSummary] = useState(true);
  
  // Transition
  const [showTransition, setShowTransition] = useState(false);
  const prevLoadingRef = useRef(isLoading);

  // States
  const [selectedFormat, setSelectedFormat] = useState(defaultFormat);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isGlossarySelectorOpen, setIsGlossarySelectorOpen] = useState(false);
  
  // Video & Playback
  // Unified Media Ref - used for BOTH video and audio modes
  const mediaRef = useRef<HTMLVideoElement>(null);
  
  const subtitleContainerRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null); 
  
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0); 
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // View States
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Mode Management
  // hasVideoSource: True if a video file/ID was provided
  const hasVideoSource = !!videoFile || !!videoDriveId;
  const [viewMode, setViewMode] = useState<'video' | 'audio'>(hasVideoSource ? 'video' : 'audio');
  
  // Determine source - prefers video if available, else audio
  const activeSource = hasVideoSource ? previewVideoUrl : audioUrl;

  // View Settings
  const [showBottomSubtitle, setShowBottomSubtitle] = useState(true); 
  const [showExpandedCaptions, setShowExpandedCaptions] = useState(true);
  const [captionLayout, setCaptionLayout] = useState<'overlay' | 'side'>('overlay');
  const [autoScroll, setAutoScroll] = useState(true);
  const isProgrammaticScrollRef = useRef(false);

  // New Modals
  const [editingItem, setEditingItem] = useState<ExtendedVocabItem | null>(null);
  const [isExtractModalOpen, setIsExtractModalOpen] = useState(false);
  const [extractionTarget, setExtractionTarget] = useState<'new' | 'existing'>('new');
  const [newSetName, setNewSetName] = useState("");
  const [existingSetId, setExistingSetId] = useState("");

  // --- Effects ---
  useEffect(() => {
      if (prevLoadingRef.current && !isLoading && data) {
          setShowTransition(true);
          const timer = setTimeout(() => setShowTransition(false), 2000);
          return () => clearTimeout(timer);
      }
      prevLoadingRef.current = isLoading;
  }, [isLoading, data]);

  useEffect(() => {
    if (videoFile && setPreviewVideoUrl && !previewVideoUrl) {
        setPreviewVideoUrl(URL.createObjectURL(videoFile));
    }
  }, [videoFile]);

  useEffect(() => {
      if (videoDriveId && setPreviewVideoUrl && !previewVideoUrl) {
          setIsLoadingMedia(true);
          getDriveFileContent(videoDriveId)
            .then(blob => {
                setPreviewVideoUrl(URL.createObjectURL(blob));
            })
            .catch(console.error)
            .finally(() => setIsLoadingMedia(false));
      }
  }, [videoDriveId]);

  useEffect(() => {
    if (data?.vocabList) {
      const processedList: ExtendedVocabItem[] = data.vocabList.map((v, index) => ({
          ...v,
          internalId: `row-${v.id}-${index}-${Math.random().toString(36).substring(7)}`, 
          aiReason: v.aiReason || '', 
          userNote: v.userNote || '',
          customStatus: v.customStatus || ''
      }));
      setVocabList(processedList);
    }
  }, [data]);

  // Handle Lyrics Auto-scroll (Audio Mode)
  useEffect(() => {
      if (autoScroll && viewMode === 'audio' && lyricsContainerRef.current && currentIndex !== -1) {
          const activeEl = document.getElementById(`lyric-${currentIndex}`);
          if (activeEl) {
              activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
  }, [currentIndex, autoScroll, viewMode]);

  // Handle Transcript Auto-scroll (Side Layout)
  useEffect(() => {
      if (autoScroll && captionLayout === 'side' && subtitleContainerRef.current && currentIndex !== -1) {
          const activeEl = document.getElementById(`subtitle-${currentIndex}`);
          if (activeEl) {
              isProgrammaticScrollRef.current = true;
              activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => { isProgrammaticScrollRef.current = false; }, 600);
          }
      }
  }, [currentIndex, autoScroll, captionLayout]);

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      const time = mediaRef.current.currentTime;
      setCurrentTime(time);
      if (mediaRef.current.duration) setDuration(mediaRef.current.duration);
      const idx = subtitles.findIndex(s => time >= s.startTime && time <= s.endTime);
      setCurrentIndex(idx);
      // Only set subtitle if it exists, otherwise empty string
      setCurrentSubtitle(idx !== -1 ? subtitles[idx].text : "");
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (mediaRef.current) {
          mediaRef.current.currentTime = time;
          setCurrentTime(time);
          setAutoScroll(false); 
      }
  };

  const togglePiP = async () => {
      if (!mediaRef.current) return;
      try {
          if (document.pictureInPictureElement) {
              await document.exitPictureInPicture();
          } else {
              await mediaRef.current.requestPictureInPicture();
          }
      } catch (error) {
          console.error("PiP failed", error);
      }
  };

  const safePlay = () => {
      mediaRef.current?.play().then(() => setIsPlaying(true)).catch(e => console.log(e));
  };

  const handlePlaySegment = (timeRange: string) => {
    if (!mediaRef.current) return;
    const startSeconds = extractStartTimeFromRange(timeRange);
    mediaRef.current.currentTime = Math.max(0, startSeconds - 1.0);
    safePlay();
    setAutoScroll(true);
  };

  const togglePlayback = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
        setIsPlaying(false);
      } else {
        safePlay();
      }
    }
  };

  // --- Logic for Modals ---
  const handleSaveEdit = (updatedItem: ExtendedVocabItem) => {
      setVocabList(prev => prev.map(item => item.internalId === updatedItem.internalId ? updatedItem : item));
      setEditingItem(null);
  };

  // --- Sub-components ---
  const DetailEditModal = () => {
      if (!editingItem) return null;
      
      const context = getContextFromSRT(subtitles, editingItem.timeRange, 1);

      return (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                      <h3 className="font-bold text-slate-800 dark:text-slate-100">{t.analysis.detailPanel.title}</h3>
                      <button onClick={() => setEditingItem(null)}><X size={20} className="text-slate-400" /></button>
                  </div>
                  <div className="p-6 overflow-y-auto space-y-4">
                      {/* Context */}
                      <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-bold text-slate-500 uppercase block mb-1">{t.analysis.detailPanel.context}</span>
                          <p className="text-sm font-mono whitespace-pre-wrap opacity-80">{context}</p>
                      </div>

                      {/* AI Reason */}
                      <div>
                          <span className="text-xs font-bold text-slate-500 uppercase block mb-1">{t.analysis.detailPanel.aiReason}</span>
                          <p className="text-sm text-slate-700 dark:text-slate-300 italic">{editingItem.aiReason}</p>
                      </div>

                      {/* Correction */}
                      <div>
                          <span className="text-xs font-bold text-slate-500 uppercase block mb-1">{t.analysis.detailPanel.correction}</span>
                          <input 
                              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-950"
                              value={editingItem.corrected}
                              onChange={e => setEditingItem({...editingItem, corrected: e.target.value})}
                          />
                      </div>

                      {/* User Note */}
                      <div>
                          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase block mb-1 flex items-center gap-1">
                              <Edit2 size={12} /> {t.analysis.detailPanel.userNote}
                          </span>
                          <textarea 
                              className="w-full p-2 border border-indigo-200 dark:border-indigo-900/50 rounded-lg dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                              rows={3}
                              placeholder="Add instructions for AI re-check..."
                              value={editingItem.userNote || ''}
                              onChange={e => setEditingItem({...editingItem, userNote: e.target.value})}
                          />
                      </div>
                  </div>
                  <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-end gap-2">
                      <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-200 rounded-lg">{t.common.cancel}</button>
                      <button onClick={() => handleSaveEdit(editingItem)} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">{t.analysis.detailPanel.save}</button>
                  </div>
              </div>
          </div>
      );
  };

  const ExtractionModal = () => {
      if (!isExtractModalOpen) return null;
      return (
          <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6 border border-slate-200 dark:border-slate-700">
                  <h3 className="font-bold text-lg mb-2">{t.analysis.extractModal.title}</h3>
                  <p className="text-sm text-slate-500 mb-4">{t.analysis.extractModal.desc}</p>
                  
                  <div className="space-y-3 mb-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" checked={extractionTarget === 'new'} onChange={() => setExtractionTarget('new')} />
                          <span className="text-sm font-medium">{t.analysis.extractModal.newSet}</span>
                      </label>
                      {extractionTarget === 'new' && (
                          <input 
                              className="w-full p-2 border rounded-lg text-sm ml-6 w-[calc(100%-1.5rem)]"
                              placeholder="Set Name (e.g. Project Terms)"
                              value={newSetName}
                              onChange={e => setNewSetName(e.target.value)}
                          />
                      )}

                      {glossarySets.length > 0 && (
                          <>
                              <label className="flex items-center gap-2 cursor-pointer mt-4">
                                  <input type="radio" checked={extractionTarget === 'existing'} onChange={() => setExtractionTarget('existing')} />
                                  <span className="text-sm font-medium">{t.analysis.extractModal.addTo}</span>
                              </label>
                              {extractionTarget === 'existing' && (
                                  <select 
                                      className="w-full p-2 border rounded-lg text-sm ml-6 w-[calc(100%-1.5rem)]"
                                      value={existingSetId}
                                      onChange={e => setExistingSetId(e.target.value)}
                                  >
                                      <option value="">-- Select Set --</option>
                                      {glossarySets.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                  </select>
                              )}
                          </>
                      )}
                  </div>

                  <div className="flex justify-end gap-2">
                      <button onClick={() => setIsExtractModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">{t.common.cancel}</button>
                      <button 
                          onClick={() => {
                              if (onExtractToGlossary) {
                                  onExtractToGlossary(newSetName || `Extracted ${new Date().toLocaleDateString()}`, extractionTarget === 'new', existingSetId);
                                  setIsExtractModalOpen(false);
                              }
                          }}
                          disabled={(extractionTarget === 'new' && !newSetName) || (extractionTarget === 'existing' && !existingSetId)}
                          className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                      >
                          {t.analysis.extractModal.confirm}
                      </button>
                  </div>
              </div>
          </div>
      );
  };

  if (isLoading && (!data || vocabList.length === 0)) return <AnalysisLoadingState t={t} streamLog={streamLog} />;
  if (showTransition) return <AnalysisSuccessState t={t} />;
  if (!data) return null;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
      
      <ConfirmationModal
          isOpen={isResetConfirmOpen}
          onClose={() => setIsResetConfirmOpen(false)}
          onConfirm={() => { onRetry(); setIsResetConfirmOpen(false); }}
          title={t.messages.restartConfirmTitle}
          message={t.messages.restartConfirmMessage}
          confirmText={t.common.confirm}
          cancelText={t.common.cancel}
          isDanger={true}
      />

      <DetailEditModal />
      <ExtractionModal />
      <GlossarySelectorModal 
          isOpen={isGlossarySelectorOpen} 
          onClose={() => setIsGlossarySelectorOpen(false)}
          glossarySets={glossarySets}
          selectedIds={selectedGlossaryIds}
          onSave={onGlossarySelectionChange}
      />

      {/* Re-Analyzing Overlay */}
      {isLoading && vocabList.length > 0 && (
          <div className="absolute inset-0 z-50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center">
               <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-xl flex flex-col items-center border border-slate-200 dark:border-slate-700">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin mb-3" />
                    <h3 className="text-lg font-bold">{t.analysis.reAnalyzing}</h3>
               </div>
          </div>
      )}

      {/* Header Bar */}
      <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm px-4 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 z-20">
          <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 whitespace-nowrap">
                  <PlayCircle className="text-indigo-600 hidden md:block" size={20} />
                  {t.analysis.step3Title}
              </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
              {onExtractToGlossary && (
                  <button 
                      onClick={() => setIsExtractModalOpen(true)}
                      className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg flex items-center gap-2 text-sm font-medium border border-indigo-200 dark:border-indigo-800/50 transition-all active:scale-95"
                      title={t.analysis.extractBtn}
                  >
                      <FolderDown size={16} /> <span className="hidden lg:inline">{t.analysis.extractBtn}</span>
                  </button>
              )}

              <button 
                  onClick={() => setIsGlossarySelectorOpen(true)} 
                  className={`p-2 rounded-lg flex items-center gap-2 text-sm font-medium border transition-all active:scale-95 ${
                      selectedGlossaryIds.length > 0 
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                  }`}
                  title={t.analysis.glossaryBtn}
              >
                  <BookOpen size={16} /> 
                  <span className="hidden lg:inline">{t.analysis.glossaryBtn} {selectedGlossaryIds.length > 0 && `(${selectedGlossaryIds.length})`}</span>
              </button>
              
              <button 
                  onClick={() => setIsResetConfirmOpen(true)} 
                  className="p-2 text-slate-500 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                  title={t.common.retry}
              >
                  <RotateCcw size={18} />
              </button>

              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 rounded-lg px-2 border border-slate-200 dark:border-slate-700 ml-2">
                  <span className="text-xs font-semibold text-slate-500 uppercase hidden md:inline">{t.analysis.formatLabel}</span>
                  <select 
                    value={selectedFormat}
                    onChange={(e) => setSelectedFormat(e.target.value)}
                    className="bg-transparent text-sm font-medium text-slate-800 dark:text-slate-200 outline-none py-1.5 cursor-pointer"
                  >
                      <option value="srt">SRT</option>
                      <option value="vtt">VTT</option>
                      <option value="ass">ASS</option>
                      <option value="json">JSON</option>
                  </select>
              </div>

              <button 
                  onClick={() => onConfirm(vocabList, extraContext, selectedFormat)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-md hover:bg-indigo-700 flex items-center gap-2 active:scale-95 transition-all"
              >
                  <CheckCheck size={16} /> <span className="hidden md:inline">{t.analysis.confirmAllBtn}</span>
              </button>
          </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20">
          
          {/* Re-Analyze Control Bar */}
          <div className="mb-6 bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/50 flex flex-col gap-3">
              <label className="text-xs font-bold text-indigo-800 dark:text-indigo-300 uppercase flex items-center gap-2">
                  <Sparkles size={12} /> {t.analysis.extraContextLabel}
              </label>
              <div className="flex gap-2">
                  <input 
                      className="flex-1 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder={t.analysis.extraContextPlaceholder}
                      value={extraContext}
                      onChange={e => setExtraContext(e.target.value)}
                      onKeyDown={e => { if(e.key === 'Enter') onReAnalyze(extraContext); }}
                  />
                  <button 
                      onClick={() => onReAnalyze(extraContext)}
                      disabled={isLoading}
                      className="px-4 md:px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 shadow-sm flex items-center justify-center gap-2 whitespace-nowrap disabled:opacity-50 active:scale-95 transition-all"
                  >
                      <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                      <span className="hidden md:inline">{t.analysis.reAnalyzeBtn}</span>
                  </button>
              </div>
          </div>

          {/* Summary Card */}
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
                          <div>
                              <p className="font-medium text-slate-800 dark:text-slate-200">{data.summary.topic}</p>
                          </div>
                          <div>
                              <div className="flex flex-wrap gap-1">
                                  {data.summary.speakers.map((s, i) => (
                                      <span key={i} className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded text-xs">{s}</span>
                                  ))}
                              </div>
                          </div>
                          <div>
                              <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-400">
                                  {data.summary.agenda.slice(0, 3).map((a, i) => <li key={i}>{a}</li>)}
                              </ul>
                          </div>
                      </div>
                  )}
              </div>
          )}

          {/* Table Container */}
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
              <div className="overflow-x-auto w-full">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                      <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                          <tr>
                              <th className="p-4 w-12 text-center">#</th>
                              <th className="p-4 w-28">{t.analysis.table.time}</th>
                              <th className="p-4 w-[25%]">{t.analysis.table.original}</th>
                              <th className="p-4 w-[25%]">{t.analysis.table.corrected}</th>
                              <th className="p-4 w-[15%]">{t.analysis.table.status}</th>
                              <th className="p-4 w-[15%]">{t.analysis.table.remarks}</th>
                              <th className="p-4 w-16 text-center">{t.analysis.table.detail}</th>
                          </tr>
                      </thead>
                      <tbody className="text-sm text-slate-700 dark:text-slate-200 divide-y divide-slate-100 dark:divide-slate-800">
                          {vocabList.map((item) => {
                              const itemStart = extractStartTimeFromRange(item.timeRange);
                              const isActive = isPlaying && currentTime >= itemStart && currentTime < itemStart + 5; 
                              
                              return (
                              <tr key={item.internalId} className={`group hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${isActive ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}>
                                  <td className="p-3 text-center align-top pt-4">
                                      <button onClick={() => handlePlaySegment(item.timeRange)} className={`hover:scale-110 transition-transform ${isActive ? 'text-indigo-600 animate-pulse' : 'text-slate-400 hover:text-indigo-600'}`}>
                                          <PlayCircle size={18} />
                                      </button>
                                  </td>
                                  <td className="p-3 text-slate-500 font-mono text-xs align-top pt-4">{item.timeRange}</td>
                                  <td className="p-3 align-top">
                                      <p className="whitespace-pre-wrap leading-relaxed select-text">{item.original}</p>
                                  </td>
                                  <td className="p-3 align-top">
                                      <textarea 
                                          className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 outline-none text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none min-h-[40px] leading-relaxed"
                                          rows={2}
                                          value={item.corrected}
                                          onChange={(e) => {
                                              setVocabList(prev => prev.map(i => i.internalId === item.internalId ? { ...i, corrected: e.target.value } : i));
                                          }}
                                      />
                                  </td>
                                  <td className="p-3 align-top pt-3">
                                      <select 
                                          value={item.status}
                                          onChange={(e) => {
                                              setVocabList(prev => prev.map(i => i.internalId === item.internalId ? { ...i, status: e.target.value as any } : i));
                                          }}
                                          className="w-full p-1.5 rounded text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                      >
                                          <option value="corrected">{t.analysis.statusOptions.verified}</option>
                                          <option value="needs_confirmation">{t.analysis.statusOptions.confirm}</option>
                                          <option value="ai_recheck">{t.analysis.statusOptions.ai_recheck}</option>
                                      </select>
                                  </td>
                                  <td className="p-3 align-top">
                                      <input 
                                          className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none text-xs text-slate-600 dark:text-slate-400 placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors py-1"
                                          placeholder={t.analysis.table.addNotePlaceholder}
                                          value={item.userNote || ''}
                                          onChange={(e) => {
                                              setVocabList(prev => prev.map(i => i.internalId === item.internalId ? { ...i, userNote: e.target.value } : i));
                                          }}
                                      />
                                  </td>
                                  <td className="p-3 text-center align-top pt-3">
                                      <button onClick={() => setEditingItem(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors">
                                          <Edit2 size={16} />
                                      </button>
                                  </td>
                              </tr>
                              );
                          })}
                      </tbody>
                  </table>
              </div>
          </div>
      </div>

      {/* Persistent Player Bar */}
      <div 
        className={`flex-shrink-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] transition-all duration-300 flex flex-col relative`}
        style={{ height: isExpanded ? '60vh' : '96px' }}
      >
          <div className="flex flex-col h-full max-w-full relative">
              {/* Expanded Media Area */}
              <div className={`relative bg-black flex overflow-hidden group transition-all duration-300 ${isExpanded ? 'flex-1' : 'h-px opacity-0 pointer-events-none'}`}>
                    
                    {/* UNIFIED PLAYER CONTAINER */}
                    <div className="flex-1 relative flex items-center justify-center bg-black h-full overflow-hidden">
                         
                         {/* LAYER 1: The One True Media Element */}
                         <div className={`relative flex items-center justify-center w-full h-full transition-all duration-500 ${captionLayout === 'side' && isExpanded ? 'pr-80 lg:pr-96' : ''}`}>
                             <video 
                                ref={mediaRef}
                                src={activeSource || undefined}
                                className={`w-full h-full object-contain transition-opacity duration-500 ${viewMode === 'audio' ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                                onTimeUpdate={handleTimeUpdate}
                                onEnded={() => setIsPlaying(false)}
                                playsInline
                             />
                             
                             {/* Floating Overlay Controls (Inside Expanded View) */}
                             <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-30">
                                 {/* Layout Toggle (Moved Here) */}
                                 {viewMode === 'video' && (
                                     <button 
                                        onClick={() => setCaptionLayout(prev => prev === 'side' ? 'overlay' : 'side')} 
                                        className={`p-3 rounded-full backdrop-blur-md transition-all shadow-lg ${captionLayout === 'side' ? 'bg-indigo-600 text-white shadow-indigo-500/50' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}
                                        title={t.videoControls.transcript}
                                     >
                                         <Sidebar size={20} />
                                     </button>
                                 )}

                                 <button 
                                    onClick={() => setAutoScroll(!autoScroll)} 
                                    className={`p-3 rounded-full backdrop-blur-md transition-all shadow-lg ${autoScroll ? 'bg-indigo-600 text-white shadow-indigo-500/50' : 'bg-black/40 text-white/50 hover:bg-black/60'}`}
                                    title={t.videoControls.sync}
                                 >
                                     <Crosshair size={20} />
                                 </button>
                                 
                                 {/* Only show caption toggle if NOT in Audio mode */}
                                 {viewMode === 'video' && (
                                     <button 
                                        onClick={() => setShowBottomSubtitle(!showBottomSubtitle)} 
                                        className={`p-3 rounded-full backdrop-blur-md transition-all shadow-lg ${showBottomSubtitle ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-black/40 text-white/50 hover:bg-black/60'}`}
                                        title={t.videoControls.captions}
                                     >
                                         <Captions size={20} />
                                     </button>
                                 )}
                             </div>

                             {/* Movie Subtitle Overlay (Video Mode Only) */}
                             {viewMode === 'video' && showExpandedCaptions && captionLayout === 'overlay' && showBottomSubtitle && currentSubtitle && (
                                 <div className="absolute bottom-12 left-0 right-0 text-center z-20 px-8 pointer-events-none">
                                     <div className="inline-block bg-black/60 backdrop-blur-sm text-white px-6 py-3 rounded-xl shadow-lg border border-white/10 animate-in fade-in slide-in-from-bottom-2">
                                         <p className="text-lg md:text-xl font-bold tracking-wide">{currentSubtitle}</p>
                                     </div>
                                 </div>
                             )}
                         </div>

                         {/* LAYER 2: Audio/Lyrics Overlay (Only Visible in Audio Mode) */}
                         <div 
                            className={`absolute inset-0 z-20 bg-slate-900 transition-opacity duration-500 flex flex-col ${viewMode === 'audio' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                         >
                            <div className="absolute inset-0 bg-gradient-to-b from-indigo-900/20 to-slate-950 pointer-events-none"></div>
                            <div className="flex-1 overflow-y-auto relative z-10 px-8 py-12 scroll-smooth" ref={lyricsContainerRef}>
                                <div className="max-w-2xl mx-auto space-y-8 text-center min-h-[50vh] flex flex-col justify-center">
                                    {subtitles.length > 0 ? subtitles.map((s, idx) => (
                                        <div 
                                            key={s.id} 
                                            id={`lyric-${idx}`}
                                            onClick={() => handlePlaySegment(`${formatTime(s.startTime)}-${formatTime(s.endTime)}`)}
                                            className={`transition-all duration-300 cursor-pointer ${
                                                idx === currentIndex 
                                                ? 'scale-110 opacity-100 text-white font-bold text-2xl md:text-3xl leading-relaxed py-4' 
                                                : 'scale-100 opacity-40 text-slate-400 text-lg md:text-xl hover:opacity-70'
                                            }`}
                                        >
                                            {s.text}
                                        </div>
                                    )) : (
                                        <div className="flex flex-col items-center justify-center opacity-50 h-full">
                                            <Music size={64} className="mb-4 text-indigo-400" />
                                            <p className="text-slate-400 text-lg">No synchronized lyrics available</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                         </div>
                         
                         {/* LAYER 3: Side Transcript Panel (Shared Logic) */}
                         {captionLayout === 'side' && isExpanded && viewMode === 'video' && (
                             <div className="absolute right-0 top-0 bottom-0 w-80 lg:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-xl">
                                  <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 font-bold text-xs uppercase text-slate-500 flex justify-between items-center">
                                      <span>{t.videoControls.transcript}</span>
                                      <button onClick={() => setCaptionLayout('overlay')} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"><X size={14}/></button>
                                  </div>
                                  <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth" ref={subtitleContainerRef}>
                                      {subtitles.map((s, idx) => (
                                          <div key={s.id} id={`subtitle-${idx}`} onClick={() => handlePlaySegment(`${formatTime(s.startTime)}-${formatTime(s.endTime)}`)} className={`cursor-pointer text-sm p-3 rounded-lg border transition-all ${idx === currentIndex ? 'bg-indigo-600 text-white shadow-md scale-[1.02]' : 'bg-slate-50 dark:bg-slate-800 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
                                              <div className="text-xs font-mono mb-1 opacity-70">{formatTime(s.startTime)}</div>
                                              <p className="font-medium leading-relaxed">{s.text}</p>
                                          </div>
                                      ))}
                                  </div>
                             </div>
                         )}
                    </div>
              </div>

              {/* Controls Container */}
              <div className="flex-shrink-0 h-24 px-6 flex items-center justify-between w-full relative z-20 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
                  
                  {/* Interactive Progress Bar */}
                  <div className="absolute -top-1 left-0 right-0 h-1 hover:h-2 bg-slate-200 dark:bg-slate-700 cursor-pointer group z-40 transition-all duration-200">
                      <div className="h-full bg-indigo-600 relative transition-all duration-75" style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}>
                          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-indigo-600 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"></div>
                      </div>
                      <input type="range" min={0} max={duration || 100} step="0.1" value={currentTime} onChange={handleSeek} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  </div>

                  {/* Left: Playback Controls */}
                  <div className="flex items-center gap-4">
                      <button onClick={() => {if(mediaRef.current) mediaRef.current.currentTime -= 5;}} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><RotateCcw size={20} /></button>
                      <button onClick={togglePlayback} disabled={!activeSource} className="w-14 h-14 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">
                          {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                      </button>
                      <button onClick={() => {if(mediaRef.current) mediaRef.current.currentTime += 5;}} className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><RotateCw size={20} /></button>
                      
                      <div className="ml-4 text-xs font-mono font-medium text-slate-500">
                          {formatTime(currentTime)} / {formatTime(duration)}
                      </div>
                  </div>

                  {/* Right: View & Mode Controls (SIMPLIFIED & GROUPED) */}
                  <div className="flex items-center gap-4">
                     
                     {/* 1. Mode Toggle (Segmented Control) */}
                     {hasVideoSource && (
                         <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-1 flex">
                             <button 
                                onClick={() => setViewMode('video')} 
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'video' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                             >
                                 <Film size={14} /> Video
                             </button>
                             <button 
                                onClick={() => setViewMode('audio')} 
                                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${viewMode === 'audio' ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                             >
                                 <Headphones size={14} /> Audio
                             </button>
                         </div>
                     )}

                     <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>

                     {/* 2. PiP Controls */}
                     <div className="flex items-center gap-1">
                         {/* PiP - Only available for Video */}
                         {viewMode === 'video' && (
                             <button 
                                onClick={togglePiP} 
                                className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                title={t.videoControls.pip}
                             >
                                 <PictureInPicture2 size={18} />
                             </button>
                         )}
                     </div>

                     <div className="w-px h-6 bg-slate-200 dark:bg-slate-700"></div>
                     
                     {/* 3. Expand Toggle */}
                     <button 
                        onClick={() => setIsExpanded(!isExpanded)} 
                        className={`p-2 rounded-lg transition-colors ${isExpanded ? 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        title={isExpanded ? t.videoControls.collapse : t.videoControls.expand}
                     >
                        {isExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
                     </button>
                  </div>
              </div>
          </div>
      </div>
    </div>
  );
};
