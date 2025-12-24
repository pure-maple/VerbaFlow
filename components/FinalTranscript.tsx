import React, { useRef, useEffect, useState } from 'react';
import { Download, CheckCircle, RefreshCw, FileText, Subtitles, HardDrive, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useLanguage } from '../contexts/LanguageContext';
import { AppStep } from '../types';
import { saveToDrive } from '../services/googleDriveService';

interface Props {
  content: string;
  isGenerating: boolean;
  onRestart: () => void;
  currentStep: AppStep;
  onNextStep?: () => void;
}

const FinalTranscript: React.FC<Props> = ({ content, isGenerating, onRestart, currentStep, onNextStep }) => {
  const { t } = useLanguage();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isGenerating) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [content, isGenerating]);

  const handleDownload = () => {
    const isSRT = currentStep === AppStep.GENERATION_SRT;
    const type = isSRT ? 'text/plain' : 'text/markdown';
    const ext = isSRT ? 'srt' : 'md';
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verbaflow_output_${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleDriveSave = async () => {
    setIsSaving(true);
    try {
      const isSRT = currentStep === AppStep.GENERATION_SRT;
      const ext = isSRT ? 'srt' : 'md';
      const mime = isSRT ? 'text/plain' : 'text/markdown';
      const filename = `verbaflow_output_${Date.now()}.${ext}`;
      
      await saveToDrive(content, filename, mime);
      alert("Successfully saved to Google Drive!");
    } catch (e: any) {
      console.error(e);
      alert(`Drive upload failed: ${e.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const title = currentStep === AppStep.GENERATION_SRT ? t.srt.title : t.transcript.title;
  const desc = currentStep === AppStep.GENERATION_SRT ? t.srt.desc : "";

  return (
    <div className="max-w-4xl mx-auto pb-20 pt-8">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[75vh]">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-slate-800">{title}</h2>
              {isGenerating && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
              )}
            </div>
            {desc && <p className="text-xs text-slate-500">{desc}</p>}
          </div>
          
          <div className="flex gap-2">
             <button
              onClick={handleDriveSave}
              disabled={!content || isGenerating || isSaving}
              className={`px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 border ${
                !content || isGenerating 
                  ? 'border-slate-200 text-slate-300 cursor-not-allowed' 
                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin"/> : <HardDrive size={16} />}
              <span className="hidden sm:inline">Drive</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={!content || isGenerating}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                !content || isGenerating 
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              <Download size={16} />
              {currentStep === AppStep.GENERATION_SRT ? t.srt.download : t.transcript.exportBtn}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-white font-mono text-sm">
          {currentStep === AppStep.GENERATION_MD ? (
            <div className="prose prose-slate max-w-none font-sans">
               <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap text-slate-700">{content}</pre>
          )}
          {!content && !isGenerating && (
            <div className="text-center text-slate-400 py-20 italic">
              {t.transcript.waiting}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {!isGenerating && content && (
          <div className="p-4 bg-green-50 border-t border-green-100 flex justify-between items-center">
             <div className="flex items-center gap-2 text-green-700">
               <CheckCircle size={20} />
               <span className="font-medium">{t.transcript.complete}</span>
             </div>
             
             <div className="flex gap-3">
               <button 
                  onClick={onRestart}
                  className="text-sm text-slate-500 hover:text-slate-800 font-medium flex items-center gap-1"
               >
                 <RefreshCw size={14} />
                 {t.transcript.startNew}
               </button>
               
               {currentStep === AppStep.GENERATION_SRT && onNextStep && (
                 <button 
                   onClick={onNextStep}
                   className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2"
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
