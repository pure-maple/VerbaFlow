
import React, { useRef, useEffect, useState } from 'react';
import { Download, CheckCircle, RefreshCw, FileText, Zap, ArrowDown, Loader2, RefreshCcw, Check, Sparkles, BrainCircuit } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../contexts/LanguageContext';
import { AppStep } from '../types';

interface Props {
  content: string;
  isGenerating: boolean;
  onRestart: () => void;
  currentStep: AppStep;
  onNextStep?: () => void;
  onDownload: () => void;
}

const FinalTranscript: React.FC<Props> = ({ content, isGenerating, onRestart, currentStep, onNextStep, onDownload }) => {
  const { t } = useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  
  // Real State Tracking
  const hasStartedStreaming = content.length > 0;
  const isFinished = !isGenerating && hasStartedStreaming;

  // Sanitize content
  const displayContent = content
    ? content
        .replace(/^Here is the.*?:\s*/i, '') // Remove "Here is the refined transcript:"
        .replace(/\\n/g, '\n')
        .replace(/^"|"$/g, '')
        .replace(/^\[|\]$/g, '')
        .trim()
    : '';

  // Force Scroll Effect
  useEffect(() => {
    if (autoScroll && containerRef.current) {
        // Use scrollTop = scrollHeight to ensure we are at the very bottom
        containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, autoScroll]);

  // Handle Manual Scroll with Buffer
  const handleScroll = () => {
      if (!containerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      
      // Allow 20px buffer for precision issues
      const distanceToBottom = Math.abs(scrollHeight - scrollTop - clientHeight);
      const isAtBottom = distanceToBottom < 20;
      
      if (!isAtBottom && autoScroll) {
          setAutoScroll(false);
      }
  };

  const handleResumeScroll = () => {
      if (containerRef.current) {
          // Force scroll first
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
          // Then lock
          setTimeout(() => setAutoScroll(true), 50);
      }
  };

  // Implement Actual Download
  const handleDownload = () => {
      if (!displayContent) return;
      
      const isSRT = currentStep === AppStep.GENERATION_SRT;
      const mimeType = isSRT ? 'text/plain' : 'text/markdown';
      const extension = isSRT ? 'srt' : 'md';
      const filename = `verbaflow_export_${new Date().toISOString().slice(0, 10)}.${extension}`;

      const blob = new Blob([displayContent], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
  };

  const title = currentStep === AppStep.GENERATION_SRT ? t.srt.title : t.transcript.title;
  const desc = currentStep === AppStep.GENERATION_SRT ? t.srt.desc : "";

  return (
    <div className="max-w-4xl mx-auto pb-20 pt-8 px-4 h-full flex flex-col">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col flex-1 relative group">
        
        {/* Floating Resume Button */}
        {!autoScroll && isGenerating && content.length > 0 && (
            <div className="absolute bottom-20 right-8 z-30 animate-in slide-in-from-bottom-2 fade-in zoom-in duration-300">
                <button 
                    onClick={handleResumeScroll}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg backdrop-blur-sm px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all active:scale-95"
                >
                    <ArrowDown size={14} className="animate-bounce" />
                    {t.transcript.resumeScroll}
                </button>
            </div>
        )}

        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center z-10 relative shrink-0">
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
              {isGenerating && (
                <div className="flex items-center gap-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-bold animate-pulse">
                    <Loader2 size={12} className="animate-spin" />
                    {t.common.processing}
                </div>
              )}
            </div>
            {desc && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{desc}</p>}
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              disabled={!content || isGenerating}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${
                !content || isGenerating 
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md active:scale-95'
              }`}
            >
              <Download size={16} />
              {currentStep === AppStep.GENERATION_SRT ? t.srt.download : t.transcript.exportBtn}
            </button>
          </div>
        </div>

        {/* Progress Bar (Visual only) */}
        {isGenerating && hasStartedStreaming && (
            <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div className="h-full bg-indigo-500 animate-progress-indeterminate origin-left"></div>
            </div>
        )}

        <div 
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-8 bg-white dark:bg-slate-900 font-mono text-sm relative scroll-smooth"
        >
          {isGenerating && !hasStartedStreaming ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-8 animate-in fade-in duration-500">
                 <div className="relative">
                     <div className="absolute inset-0 bg-indigo-500 blur-2xl opacity-20 rounded-full animate-pulse"></div>
                     <BrainCircuit size={64} className="relative text-indigo-400 dark:text-indigo-500 animate-pulse" />
                 </div>
                 
                 {/* Real State Indicator */}
                 <div className="w-full max-w-xs space-y-4">
                    <div className="flex items-center gap-3 opacity-100">
                        <CheckCircle size={18} className="text-green-500" />
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">
                            {t.generation.progressStages.init}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 opacity-100">
                        <Loader2 size={18} className="animate-spin text-indigo-500" />
                        <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 animate-pulse">
                            {t.generation.progressStages.drafting}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 opacity-30">
                        <div className="w-[18px]"/>
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                            {t.generation.progressStages.polishing}
                        </span>
                    </div>
                 </div>
             </div>
          ) : (
              <>
                {currentStep === AppStep.GENERATION_MD ? (
                    <div className="prose prose-slate dark:prose-invert max-w-none font-sans">
                        <ReactMarkdown>{displayContent}</ReactMarkdown>
                    </div>
                ) : (
                    <pre className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 leading-relaxed">{displayContent}</pre>
                )}
                <div ref={bottomRef} />
              </>
          )}
        </div>

        {!isGenerating && content && (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border-t border-green-100 dark:border-green-900/50 flex justify-between items-center z-10 relative shrink-0 animate-in slide-in-from-bottom-2 fade-in">
             <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
               <CheckCircle size={20} />
               <span className="font-medium">{t.transcript.complete}</span>
             </div>
             
             <div className="flex gap-3">
               <button 
                  onClick={onRestart}
                  className="px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium flex items-center gap-1 transition-colors"
               >
                 <RefreshCcw size={14} />
                 {t.transcript.resetProject}
               </button>
               
               {currentStep === AppStep.GENERATION_SRT && onNextStep && (
                 <button 
                   onClick={onNextStep}
                   className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                 >
                   <FileText size={16} />
                   {t.srt.next}
                 </button>
               )}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinalTranscript;
