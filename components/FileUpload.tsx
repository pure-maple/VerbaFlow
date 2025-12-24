import React, { useRef, useState } from 'react';
import { Upload, FileAudio, FileText, CheckCircle2, Settings2, Globe } from 'lucide-react';
import { UploadedFiles } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  files: UploadedFiles;
  setFiles: React.Dispatch<React.SetStateAction<UploadedFiles>>;
  onNext: () => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
}

const FileUpload: React.FC<Props> = ({ 
  files, 
  setFiles, 
  onNext, 
  selectedModel, 
  onModelChange,
  targetLanguage,
  onLanguageChange
}) => {
  const { t } = useLanguage();
  const srtInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isCustomModel, setIsCustomModel] = useState(false);

  const handleSrtUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const text = await file.text();
      setFiles(prev => ({ ...prev, srt: file, srtContent: text }));
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFiles(prev => ({ ...prev, audio: e.target.files![0] }));
    }
  };

  const handleModelSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === 'custom') {
      setIsCustomModel(true);
      onModelChange('');
    } else {
      setIsCustomModel(false);
      onModelChange(val);
    }
  };

  const isReady = !!files.srt;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      
      {/* Settings Card */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100 border-b border-slate-100 dark:border-slate-700 pb-2">
          <Settings2 size={20} className="text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold">{t.config.title}</h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Model Selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              {t.config.modelLabel}
            </label>
            <div className="flex gap-2">
              <select 
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
                value={isCustomModel ? 'custom' : selectedModel}
                onChange={handleModelSelect}
              >
                <option value="gemini-3-flash-preview">{t.config.modelFast}</option>
                <option value="gemini-3-pro-preview">{t.config.modelSmart}</option>
                <option value="custom">{t.config.customModel}</option>
              </select>
            </div>
            {isCustomModel && (
              <input 
                type="text" 
                placeholder={t.config.customPlaceholder}
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="w-full mt-2 p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
              />
            )}
          </div>

          {/* Language Selection */}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-2">
              <Globe size={16} /> {t.config.languageLabel}
            </label>
            <select 
              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
              value={targetLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
            >
              <option value="Chinese (Simplified)">中文 (默认/Default)</option>
              <option value="English">English</option>
              <option value="Japanese">日本語 (Japanese)</option>
              <option value="Korean">한국어 (Korean)</option>
              <option value="French">Français</option>
              <option value="Spanish">Español</option>
            </select>
          </div>
        </div>
      </div>

      {/* File Upload Card */}
      <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">{t.upload.title}</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Audio Upload */}
          <div 
            onClick={() => audioInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
              files.audio 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <input 
              type="file" 
              ref={audioInputRef} 
              onChange={handleAudioUpload} 
              accept="audio/*,video/*" 
              className="hidden" 
            />
            {files.audio ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mb-4" />
                <p className="text-indigo-900 dark:text-indigo-300 font-medium truncate max-w-full px-4">{files.audio.name}</p>
                <p className="text-indigo-600 dark:text-indigo-400 text-sm mt-1">{t.upload.audioReceived}</p>
              </>
            ) : (
              <>
                <FileAudio className="w-12 h-12 text-slate-400 dark:text-slate-500 mb-4" />
                <p className="text-slate-700 dark:text-slate-300 font-medium">{t.upload.audioLabel}</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.upload.audioSub}</p>
              </>
            )}
          </div>

          {/* SRT Upload */}
          <div 
            onClick={() => srtInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all ${
              files.srt 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <input 
              type="file" 
              ref={srtInputRef} 
              onChange={handleSrtUpload} 
              accept=".srt" 
              className="hidden" 
            />
            {files.srt ? (
              <>
                <CheckCircle2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 mb-4" />
                <p className="text-indigo-900 dark:text-indigo-300 font-medium truncate max-w-full px-4">{files.srt.name}</p>
                <p className="text-indigo-600 dark:text-indigo-400 text-sm mt-1">{t.upload.srtReceived}</p>
              </>
            ) : (
              <>
                <FileText className="w-12 h-12 text-slate-400 dark:text-slate-500 mb-4" />
                <p className="text-slate-700 dark:text-slate-300 font-medium">{t.upload.srtLabel}</p>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t.upload.srtSub}</p>
              </>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={onNext}
            disabled={!isReady || !selectedModel}
            className={`px-6 py-3 rounded-lg font-semibold flex items-center gap-2 ${
              isReady && selectedModel
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-md' 
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            <Upload size={18} />
            {t.upload.startBtn}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
