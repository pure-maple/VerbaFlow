import React, { useState, useRef, useEffect } from 'react';
import { AnalysisResult, VocabItem, SubtitleItem, GlossaryItem } from '../types';
import { AlertCircle, Check, Loader2, PlayCircle, Play, Pause, RotateCcw, BookOpen, RefreshCw, CheckCheck, ChevronLeft, ChevronRight, HardDrive } from 'lucide-react';
import { extractStartTimeFromRange, formatTime } from '../utils/srtParser';
import { useLanguage } from '../contexts/LanguageContext';
import { saveToDrive } from '../services/googleDriveService';

interface Props {
  data: AnalysisResult;
  isLoading: boolean;
  onConfirm: (finalVocab: VocabItem[], extraContext: string) => void;
  onRetry: () => void;
  onReAnalyze: (extraContext: string) => void;
  audioUrl: string | null;
  subtitles: SubtitleItem[];
  onOpenGlossary: () => void;
  hasGlossary: boolean;
}

const AnalysisView: React.FC<Props> = ({ 
  data, 
  isLoading, 
  onConfirm, 
  onRetry, 
  onReAnalyze,
  audioUrl, 
  subtitles,
  onOpenGlossary,
  hasGlossary
}) => {
  const { t } = useLanguage();
  const [vocabList, setVocabList] = useState<VocabItem[]>([]);
  const [initialVocab, setInitialVocab] = useState<VocabItem[]>([]);
  const [extraContext, setExtraContext] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>("");
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);

  // Load data and keep a backup for reset
  useEffect(() => {
    if (data?.vocabList) {
      setVocabList(data.vocabList);
      setInitialVocab(JSON.parse(JSON.stringify(data.vocabList)));
    }
  }, [data]);

  // Sync subtitle with audio/video
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      setCurrentTime(time);
      const idx = subtitles.findIndex(s => time >= s.startTime && time <= s.endTime);
      setCurrentIndex(idx);
      setCurrentSubtitle(idx !== -1 ? subtitles[idx].text : "");
    }
  };

  const handlePlaySegment = (timeRange: string) => {
    if (videoRef.current) {
      const startSeconds = extractStartTimeFromRange(timeRange);
      videoRef.current.currentTime = startSeconds;
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const togglePlayback = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const jumpSubtitle = (direction: 'prev' | 'next') => {
    if (!videoRef.current || subtitles.length === 0) return;
    
    // If no current index found (gap in silence), find the next closest one
    let targetIdx = currentIndex;
    
    if (direction === 'next') {
        if (targetIdx < subtitles.length - 1) {
            targetIdx = currentIndex + 1;
        } else if (currentIndex === -1) {
             // Find first subtitle after current time
             targetIdx = subtitles.findIndex(s => s.startTime > currentTime);
        }
    } else {
        if (targetIdx > 0) {
            targetIdx = currentIndex - 1;
        } else if (currentIndex === -1) {
             // Find first subtitle before current time
             // simple loop backwards
             for (let i = subtitles.length - 1; i >= 0; i--) {
                 if (subtitles[i].endTime < currentTime) {
                     targetIdx = i;
                     break;
                 }
             }
        }
    }

    if (targetIdx !== -1 && subtitles[targetIdx]) {
        videoRef.current.currentTime = subtitles[targetIdx].startTime;
        videoRef.current.play();
        setIsPlaying(true);
    }
  };

  const handleUpdateVocab = (id: number, field: keyof VocabItem, value: string) => {
    setVocabList(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const handleStatusChange = (id: number, status: VocabItem['status']) => {
    setVocabList(prev => prev.map(item => 
      item.id === id ? { ...item, status } : item
    ));
  };

  const handleReset = () => {
    if (confirm("Reset all changes to initial AI results?")) {
      setVocabList(JSON.parse(JSON.stringify(initialVocab)));
    }
  };

  const handleConfirmAll = () => {
    setVocabList(prev => prev.map(item => ({ ...item, status: 'corrected' })));
  };
  
  const handleDriveSave = async () => {
    setIsSaving(true);
    try {
      const content = JSON.stringify({ summary: data.summary, vocabList }, null, 2);
      await saveToDrive(content, `verbaflow_analysis_${Date.now()}.json`, 'application/json');
      alert("Successfully saved analysis to Google Drive!");
    } catch (e: any) {
      console.error(e);
      alert(`Drive upload failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mt-12">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t.analysis.loadingTitle}</h3>
        <p className="text-slate-500 dark:text-slate-400 mt-2">{hasGlossary ? t.analysis.reAnalyzing : t.analysis.loadingSub}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-3xl mx-auto p-12 text-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 mt-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{t.analysis.failedTitle}</h3>
        <button onClick={onRetry} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg">{t.analysis.retryBtn}</button>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-48 pt-6">
      
      {/* Top Controls: Summary + Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
           <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <PlayCircle className="text-indigo-600" size={20} />
            {t.analysis.summaryTitle}
          </h2>
          <div className="grid grid-cols-2 gap-4 text-sm text-slate-600 dark:text-slate-300">
            <div><span className="font-semibold text-slate-500 dark:text-slate-400">{t.analysis.topic}:</span> {summary.topic}</div>
            <div><span className="font-semibold text-slate-500 dark:text-slate-400">{t.analysis.duration}:</span> {summary.duration}</div>
            <div className="col-span-2"><span className="font-semibold text-slate-500 dark:text-slate-400">{t.analysis.speakers}:</span> {summary.speakers.join(', ')}</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col justify-between">
           <div className="space-y-3">
             <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t.analysis.extraContextLabel}</label>
             <textarea 
               className="w-full h-24 p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
               placeholder={t.analysis.extraContextPlaceholder}
               value={extraContext}
               onChange={(e) => setExtraContext(e.target.value)}
             />
           </div>
           <div className="flex gap-2 mt-4">
             <button 
               onClick={onOpenGlossary}
               className="flex-1 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium hover:bg-slate-200 dark:hover:bg-slate-600 flex items-center justify-center gap-1"
             >
               <BookOpen size={14} /> {t.analysis.glossaryBtn}
             </button>
             <button 
               onClick={() => onReAnalyze(extraContext)}
               className="flex-1 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center justify-center gap-1"
             >
               <RefreshCw size={14} /> {t.analysis.reAnalyzeBtn}
             </button>
           </div>
        </div>
      </div>

      {/* Vocabulary Editor */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{t.analysis.step3Title}</h2>
          
          <div className="flex items-center gap-3">
            <span className="text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 px-3 py-1 rounded-full font-medium">
              {vocabList.filter(v => v.status !== 'corrected').length} {t.analysis.needsAttention}
            </span>
            <button onClick={handleReset} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 p-2" title={t.analysis.resetBtn}>
              <RotateCcw size={16} />
            </button>
            <button 
              onClick={handleConfirmAll}
              className="px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg text-sm font-medium hover:bg-green-100 dark:hover:bg-green-900/50 flex items-center gap-1"
            >
              <CheckCheck size={14} /> {t.analysis.confirmAllBtn}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-200 text-sm border-b border-slate-200 dark:border-slate-600">
                <th className="p-3 font-semibold w-12">{t.analysis.table.play}</th>
                <th className="p-3 font-semibold w-20">{t.analysis.table.time}</th>
                <th className="p-3 font-semibold">{t.analysis.table.original}</th>
                <th className="p-3 font-semibold">{t.analysis.table.corrected}</th>
                <th className="p-3 font-semibold w-32">{t.analysis.table.remarks}</th>
                <th className="p-3 font-semibold w-32">{t.analysis.table.status}</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-700 dark:text-slate-200">
              {vocabList.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 group">
                  <td className="p-3">
                    {audioUrl && (
                       <button 
                        onClick={() => handlePlaySegment(item.timeRange)}
                        className="p-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900"
                       >
                         <Play size={14} fill="currentColor" />
                       </button>
                    )}
                  </td>
                  <td className="p-3 text-slate-500 dark:text-slate-400 font-mono whitespace-nowrap text-xs">{item.timeRange}</td>
                  <td className="p-3 font-medium">{item.original}</td>
                  <td className="p-3">
                    <input 
                      type="text" 
                      value={item.corrected}
                      onChange={(e) => handleUpdateVocab(item.id, 'corrected', e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded focus:border-indigo-500 outline-none transition-colors text-slate-900 dark:text-slate-100"
                    />
                  </td>
                   <td className="p-3">
                    <input 
                      type="text" 
                      value={item.remarks || ''}
                      placeholder="..."
                      onChange={(e) => handleUpdateVocab(item.id, 'remarks', e.target.value)}
                      className="w-full p-2 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-500 focus:border-indigo-500 outline-none text-slate-500 dark:text-slate-400"
                    />
                  </td>
                  <td className="p-3">
                     <div className="flex flex-col gap-1">
                       <select 
                        value={item.status === 'custom' ? 'custom' : item.status}
                        onChange={(e) => handleStatusChange(item.id, e.target.value as any)}
                        className={`p-1.5 w-full rounded text-xs font-semibold border-none cursor-pointer outline-none ring-1 ring-inset ${
                          item.status === 'corrected' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 ring-green-600/20' : 
                          item.status === 'needs_confirmation' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 ring-amber-600/20' :
                          item.status === 'check_spelling' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-blue-600/20' :
                          'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 ring-purple-600/20'
                        }`}
                       >
                         <option value="corrected">{t.analysis.statusOptions.verified}</option>
                         <option value="needs_confirmation">{t.analysis.statusOptions.confirm}</option>
                         <option value="check_spelling">{t.analysis.statusOptions.check}</option>
                         <option value="custom">{t.analysis.statusOptions.custom}</option>
                       </select>
                       {item.status === 'custom' && (
                         <input 
                           type="text"
                           value={item.customStatus || ''}
                           onChange={(e) => handleUpdateVocab(item.id, 'customStatus', e.target.value)}
                           className="text-xs p-1 border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 rounded"
                           placeholder="Status..."
                         />
                       )}
                     </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-between">
           <button
            onClick={handleDriveSave}
            disabled={isSaving}
            className={`px-4 py-3 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-semibold hover:bg-slate-50 dark:hover:bg-slate-600 shadow-sm flex items-center gap-2 ${isSaving ? 'opacity-50' : ''}`}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin"/> : <HardDrive size={18} />}
            {t.nav.drive}
          </button>

          <button
            onClick={() => onConfirm(vocabList, extraContext)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 shadow-md flex items-center gap-2"
          >
            <Check size={18} />
            {t.analysis.nextStepBtn}
          </button>
        </div>
      </div>

      {/* Floating Video Player */}
      {audioUrl && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-[0_-5px_20px_-5px_rgba(0,0,0,0.1)] p-4 z-40 transition-all duration-300">
          <div className="max-w-5xl mx-auto flex flex-col gap-2">
            
            <div className="flex items-center gap-4">
              {/* Play/Pause */}
              <button 
                onClick={togglePlayback}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm flex-shrink-0"
              >
                {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-0.5" />}
              </button>

              {/* Prev/Next Subtitle */}
               <div className="flex gap-1">
                <button onClick={() => jumpSubtitle('prev')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title={t.analysis.videoControls.prev}><ChevronLeft size={20} /></button>
                <button onClick={() => jumpSubtitle('next')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300" title={t.analysis.videoControls.next}><ChevronRight size={20} /></button>
              </div>
              
              {/* Timeline */}
              <div className="flex-1 flex flex-col">
                 <div className="mb-1 min-h-[1.5em] flex justify-center">
                    {currentSubtitle ? (
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 inline-block px-3 py-0.5 rounded-md shadow-sm border border-slate-200 dark:border-slate-600 truncate max-w-[50vw]">
                        {currentSubtitle}
                        </p>
                    ) : (
                        <p className="text-slate-400 italic text-xs pt-1">{t.analysis.noSubtitle}</p>
                    )}
                 </div>
                 
                 {/* Video Element (Hidden but active for audio, Visible for video) */}
                 <div className="relative w-full h-1 bg-slate-200 dark:bg-slate-700 rounded cursor-pointer group">
                    <div 
                      className="absolute top-0 left-0 h-full bg-indigo-500 rounded" 
                      style={{ width: `${videoRef.current ? (currentTime / videoRef.current.duration) * 100 : 0}%` }}
                    />
                    {/* Visualizer for video (Small preview) */}
                    <video 
                        ref={videoRef}
                        src={audioUrl}
                        onTimeUpdate={handleTimeUpdate}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        className="fixed bottom-24 right-6 w-48 rounded-lg shadow-lg border-2 border-white bg-black hidden md:block"
                        style={{ display: audioUrl ? 'block' : 'none' }}
                    />
                 </div>
              </div>

              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 w-16 text-right">
                {formatTime(currentTime)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalysisView;
