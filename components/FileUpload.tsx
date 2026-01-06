
import React, { useRef, useState, useEffect } from 'react';
import { Upload, FileAudio, FileText, CheckCircle2, Settings2, Globe, Video, File, X, PlayCircle, Sparkles, AlertCircle, Info, Cloud, Book, BrainCircuit } from 'lucide-react';
import { UploadedFiles, GlossarySet, AnalyzeSelection } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { detectSubtitleFormat } from '../utils/srtParser';
import { useConfig } from '../contexts/ConfigContext';
import { openDrivePicker, getDriveFileText, getDriveFileMetadata } from '../services/googleDriveService';
import { ConfirmationModal } from './ConfirmationModal';

interface Props {
  files: UploadedFiles;
  setFiles: React.Dispatch<React.SetStateAction<UploadedFiles>>;
  onNext: (selection: AnalyzeSelection, extraContext: string) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  targetLanguage: string;
  onLanguageChange: (lang: string) => void;
  onOpenSettings: () => void; 
  glossarySets: GlossarySet[];
  selectedGlossaryIds: string[];
  onGlossarySelectionChange: (ids: string[]) => void;
}

const FileUpload: React.FC<Props> = ({ 
  files, 
  setFiles, 
  onNext, 
  selectedModel, 
  onModelChange, 
  targetLanguage,
  onLanguageChange,
  onOpenSettings,
  glossarySets,
  selectedGlossaryIds,
  onGlossarySelectionChange
}) => {
  const { t, language } = useLanguage();
  const { driveClientId, driveApiKey, manualDriveToken } = useConfig();
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [isConfigWarningOpen, setIsConfigWarningOpen] = useState(false);
  const [extraContext, setExtraContext] = useState("");

  // Drag State Tracking
  const [dragActive, setDragActive] = useState<{ video: boolean; audio: boolean; srt: boolean }>({
      video: false,
      audio: false,
      srt: false
  });

  // Analyze Selection State
  const [analyzeSelection, setAnalyzeSelection] = useState<AnalyzeSelection>({
      video: false,
      audio: false,
      srt: true
  });

  const isReady = (!!files.video || !!files.videoDriveId) || (!!files.audio || !!files.audioDriveId) || (!!files.srt || !!files.srtDriveId);

  // Auto-enable analysis toggles when files are added
  useEffect(() => {
      setAnalyzeSelection(prev => ({
          ...prev,
          video: (!!files.video || !!files.videoDriveId) ? true : false,
          audio: (!!files.audio || !!files.audioDriveId) ? true : false,
          srt: (!!files.srt || !!files.srtDriveId) ? true : false // Force true if SRT exists
      }));
  }, [files.video, files.videoDriveId, files.audio, files.audioDriveId, files.srt, files.srtDriveId]);

  // --- Core File Processors ---

  const processVideoFile = (file: File) => {
      if (!file.type.startsWith('video/')) {
          alert("Invalid file type. Please upload a video file.");
          return;
      }
      setFiles(prev => ({ ...prev, video: file, videoSource: 'local' }));
  };

  const processAudioFile = (file: File) => {
      if (!file.type.startsWith('audio/')) {
          alert("Invalid file type. Please upload an audio file.");
          return;
      }
      setFiles(prev => ({ ...prev, audio: file, audioSource: 'local' }));
  };

  const processSrtFile = async (file: File) => {
      try {
          const text = await file.text();
          const format = detectSubtitleFormat(text);
          setFiles(prev => ({ 
              ...prev, 
              srt: file, 
              srtSource: 'local',
              srtContent: text,
              subtitleFormat: format 
          }));
      } catch (err) {
          console.error("Error reading subtitle file:", err);
          alert(language === 'zh' ? "读取字幕文件失败" : "Failed to read subtitle file");
      }
  };

  // --- Event Handlers (Input) ---

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
      e.stopPropagation(); // CRITICAL: Stop bubbling to parent div to prevent infinite loop
      (e.target as HTMLInputElement).value = ''; // Clear value to allow re-selecting same file
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processVideoFile(e.target.files[0]);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processAudioFile(e.target.files[0]);
  };

  const handleSrtUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) processSrtFile(e.target.files[0]);
  };

  // --- Event Handlers (Drag & Drop) ---

  const handleDrag = (e: React.DragEvent, type: 'video' | 'audio' | 'srt') => {
      e.preventDefault();
      e.stopPropagation();
      if (e.type === 'dragenter' || e.type === 'dragover') {
          setDragActive(prev => ({ ...prev, [type]: true }));
      } else if (e.type === 'dragleave') {
          // Prevent flickering when dragging over child elements
          if (e.currentTarget.contains(e.relatedTarget as Node)) return;
          setDragActive(prev => ({ ...prev, [type]: false }));
      }
  };

  const handleDrop = (e: React.DragEvent, type: 'video' | 'audio' | 'srt') => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(prev => ({ ...prev, [type]: false }));
      
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          const file = e.dataTransfer.files[0];
          if (type === 'video') processVideoFile(file);
          if (type === 'audio') processAudioFile(file);
          if (type === 'srt') processSrtFile(file);
      }
  };

  // --- Drive Logic ---

  const handleDriveSelect = async (type: 'video' | 'audio' | 'srt') => {
      const hasStandardConfig = driveClientId?.trim() && driveApiKey?.trim();
      const hasManualConfig = manualDriveToken?.trim();

      if (!hasStandardConfig && !hasManualConfig) {
          setIsConfigWarningOpen(true);
          return;
      }

      let mimeTypes = "";
      if (type === 'video') mimeTypes = "video/mp4,video/quicktime,video/webm";
      if (type === 'audio') mimeTypes = "audio/mpeg,audio/wav,audio/x-m4a";
      if (type === 'srt') mimeTypes = "text/plain,application/x-subrip,text/vtt";

      try {
        openDrivePicker(driveClientId, driveApiKey, mimeTypes, async (file) => {
            await processDriveFile(file.id, type);
        });
      } catch (e) {
        console.error("Picker Launch Error:", e);
        alert("Failed to launch Google Picker. Check console.");
      }
  };

  const processDriveFile = async (fileId: string, type: 'video' | 'audio' | 'srt') => {
      try {
          if (type === 'srt') {
              const text = await getDriveFileText(fileId);
              const format = detectSubtitleFormat(text);
              setFiles(prev => ({
                  ...prev,
                  srt: null,
                  srtSource: 'drive',
                  srtDriveId: fileId,
                  srtContent: text,
                  subtitleFormat: format
              }));
          } else {
              setFiles(prev => ({
                  ...prev,
                  [type]: null,
                  [`${type}Source`]: 'drive',
                  [`${type}DriveId`]: fileId
              }));
          }
      } catch (e) {
          console.error(e);
          alert(language === 'zh' ? "加载失败" : "Failed to load file.");
      }
  };

  const removeFile = (type: 'video' | 'audio' | 'srt') => {
      setFiles(prev => {
          const newState = { ...prev };
          if (type === 'video') { newState.video = null; newState.videoSource = 'local'; newState.videoDriveId = undefined; }
          if (type === 'audio') { newState.audio = null; newState.audioSource = 'local'; newState.audioDriveId = undefined; }
          if (type === 'srt') {
              newState.srt = null;
              newState.srtSource = 'local';
              newState.srtDriveId = undefined;
              newState.srtContent = '';
              newState.subtitleFormat = undefined;
          }
          return newState;
      });
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
  
  const handleGlossaryToggle = (id: string) => {
      if (selectedGlossaryIds.includes(id)) {
          onGlossarySelectionChange(selectedGlossaryIds.filter(gid => gid !== id));
      } else {
          onGlossarySelectionChange([...selectedGlossaryIds, id]);
      }
  };

  const FileCard = ({ 
      type, 
      file, 
      source, 
      driveId,
      label, 
      sub, 
      accept, 
      inputRef, 
      onUpload,
      icon: Icon,
      bgColor,
      textColor
  }: {
      type: 'video' | 'audio' | 'srt',
      file: File | null,
      source: 'local' | 'drive',
      driveId?: string,
      label: string,
      sub: string,
      accept: string,
      inputRef: React.RefObject<HTMLInputElement>,
      onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void,
      icon: any,
      bgColor: string,
      textColor: string
  }) => {
      const hasFile = !!(file || driveId);
      const isSelectedForAnalysis = analyzeSelection[type];
      const isDragging = dragActive[type];
      
      return (
      <div 
        onClick={() => {
            if (!hasFile) {
                inputRef.current?.click();
            }
        }}
        onDragEnter={(e) => handleDrag(e, type)}
        onDragLeave={(e) => handleDrag(e, type)}
        onDragOver={(e) => handleDrag(e, type)}
        onDrop={(e) => handleDrop(e, type)}
        className={`flex flex-col h-full rounded-xl border-2 transition-all duration-200 group relative ${
            isDragging 
            ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 scale-[1.02] shadow-lg border-solid' 
            : hasFile 
                ? 'border-indigo-500 shadow-md bg-slate-50 dark:bg-slate-900/50 border-solid' 
                : 'border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer bg-slate-50 dark:bg-slate-900/50'
        }`}
      >
          <div className="flex-1 p-4 flex flex-col items-center justify-center text-center relative select-none pointer-events-none">
              <input 
                type="file" 
                ref={inputRef} 
                onChange={onUpload} 
                onClick={handleInputClick}
                accept={accept} 
                className="hidden pointer-events-auto" 
              />
              
              {hasFile ? (
                  <>
                      <div className={`p-3 rounded-full ${bgColor} mb-2`}>
                          <CheckCircle2 size={32} className={textColor} />
                      </div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 break-all text-sm px-2">
                          {source === 'local' ? file?.name : `Drive File (${driveId?.slice(0, 6)}...)`}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                          {source === 'local' ? `${(file!.size / 1024 / 1024).toFixed(2)} MB` : 'Cloud Resource'}
                      </p>
                      {source === 'drive' && (
                          <span className="mt-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded text-[10px] flex items-center gap-1">
                              <Cloud size={10} /> Google Drive
                          </span>
                      )}
                      
                      {/* Analysis Toggle Checkbox */}
                      <div className="mt-3 w-full border-t border-slate-200 dark:border-slate-700 pt-2 pointer-events-auto" onClick={e => e.stopPropagation()}>
                          <label className="flex items-center justify-center gap-2 cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-indigo-600">
                              <input 
                                type="checkbox" 
                                checked={isSelectedForAnalysis}
                                onChange={(e) => setAnalyzeSelection(prev => ({ ...prev, [type]: e.target.checked }))}
                                className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                              />
                              {language === 'zh' ? '提交 AI 分析' : 'Submit to AI'}
                          </label>
                      </div>
                  </>
              ) : (
                  <>
                      <div className={`p-3 rounded-full bg-white dark:bg-slate-800 shadow-sm mb-3 group-hover:scale-110 transition-transform duration-200 ${isDragging ? 'scale-110' : ''}`}>
                          <Icon size={32} className={`transition-colors ${isDragging ? 'text-indigo-500' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                      </div>
                      <p className={`font-medium transition-colors ${isDragging ? 'text-indigo-600' : 'text-slate-700 dark:text-slate-300 group-hover:text-indigo-600'}`}>
                          {isDragging ? 'Drop to Upload' : label}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">{sub}</p>
                      
                      {/* Hint Text */}
                      <div className={`mt-4 transition-opacity duration-200 ${isDragging || 'opacity-0 group-hover:opacity-100'}`}>
                          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full">
                             {t.upload.browse}
                          </span>
                      </div>
                  </>
              )}
          </div>

          {/* Close Button Only */}
          {hasFile && (
             <button 
                  onClick={(e) => { e.stopPropagation(); removeFile(type); }}
                  className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 bg-white/50 dark:bg-slate-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors backdrop-blur-sm pointer-events-auto"
              >
                  <X size={16} />
              </button>
          )}
      </div>
      );
  };

  return (
    <div className="h-full overflow-y-auto px-4 md:px-8">
      <div className="max-w-5xl mx-auto space-y-8 pt-6 pb-20">
      <ConfirmationModal
        isOpen={isConfigWarningOpen}
        onClose={() => setIsConfigWarningOpen(false)}
        onConfirm={onOpenSettings}
        title={language === 'zh' ? "Google Drive 未配置" : "Google Drive Not Configured"}
        message={language === 'zh' ? "您尚未配置 Google Drive 的 API Key 或 Access Token，无法访问云端文件。是否立即前往设置？" : "You have not configured the Google Drive API Key or Access Token. Would you like to go to Settings now?"}
        confirmText={language === 'zh' ? "去设置" : "Go to Settings"}
        cancelText={language === 'zh' ? "取消" : "Cancel"}
      />

      {/* Configuration Card - Enhanced Visuals */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 p-4 opacity-5">
            <Settings2 size={120} />
        </div>

        <div className="flex items-center gap-2 mb-6 border-b border-slate-100 dark:border-slate-700 pb-3">
          <Settings2 size={20} className="text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.config.title}</h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 relative z-10">
          {/* Model Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Sparkles size={14} className="text-indigo-500" /> {t.config.modelLabel}
            </label>
            <div className="flex gap-2">
              <select 
                className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
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
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
              />
            )}
          </div>

          {/* Language Selection */}
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Globe size={14} className="text-indigo-500" /> {t.upload.outputLangLabel}
            </label>
            <select 
              className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-colors"
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

        {/* Glossary Selection Area */}
        <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700 relative z-10">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 mb-4">
              <Book size={14} className="text-indigo-500" /> {language === 'zh' ? '关联术语库 (可选)' : 'Link Glossary Sets (Optional)'}
            </label>
            {glossarySets.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {glossarySets.map(set => (
                        <div 
                            key={set.id} 
                            onClick={() => handleGlossaryToggle(set.id)}
                            className={`cursor-pointer px-3 py-2.5 rounded-lg border text-xs font-medium flex items-center justify-between transition-all ${
                                selectedGlossaryIds.includes(set.id)
                                ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-500 text-indigo-700 dark:text-indigo-300 shadow-sm ring-1 ring-indigo-500/20'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                        >
                            <span className="truncate">{set.title}</span>
                            {selectedGlossaryIds.includes(set.id) && <CheckCircle2 size={14} className="text-indigo-600 dark:text-indigo-400" />}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-slate-400 italic bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                    {language === 'zh' ? '暂无术语库。分析后可提取生成。' : 'No glossary sets available. Create one later.'}
                </p>
            )}
        </div>
      </div>

      {/* NEW: Pre-Prompting Area */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 mb-4">
              <BrainCircuit size={20} className="text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{t.upload.prePromptTitle}</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.upload.prePromptDesc}</p>
          
          <div className="relative">
              <textarea 
                  className="w-full p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-800 dark:text-slate-200 placeholder:text-slate-400 transition-all"
                  rows={3}
                  placeholder={t.upload.contextPlaceholder}
                  value={extraContext}
                  onChange={(e) => setExtraContext(e.target.value)}
              />
              <div className="absolute top-3 right-3 opacity-30">
                  <Sparkles size={16} />
              </div>
          </div>
      </div>

      {/* File Upload Area */}
      <div className="p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
            {t.upload.title}
        </h2>
        
        {/* Persistent Tip Box */}
        <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl flex items-start gap-3 text-sm text-indigo-800 dark:text-indigo-200">
            <Info size={20} className="shrink-0 mt-0.5" />
            <div>
                <strong className="block font-semibold mb-1">
                    {language === 'zh' ? "关于多模态分析" : "About Multimodal Analysis"}
                </strong>
                <p className="opacity-90 leading-relaxed">
                    {language === 'zh' 
                        ? "您可以上传视频或音频文件进行 AI 辅助分析。若只用于本地预览，请取消文件卡片下方的“提交 AI 分析”勾选，以节省流量并保护隐私。" 
                        : "You can upload video/audio for AI analysis. Uncheck 'Submit to AI' if you only want local preview to save bandwidth and privacy."}
                </p>
            </div>
        </div>

        {/* SRT Warning Box (Conditional) */}
        {!files.srt && !files.srtDriveId && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-3 text-sm text-amber-800 dark:text-amber-200">
                <AlertCircle size={20} className="shrink-0 mt-0.5" />
                <div>
                    <strong className="block font-semibold mb-1">{t.upload.srTWarningTitle}</strong>
                    <p className="opacity-90">{t.upload.srtWarningDesc}</p>
                </div>
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-72">
            <FileCard 
                type="video"
                file={files.video}
                source={files.videoSource}
                driveId={files.videoDriveId}
                label={t.upload.videoLabel}
                sub={t.upload.fileTypeVideo}
                accept="video/*"
                inputRef={videoInputRef}
                onUpload={handleVideoUpload}
                icon={Video}
                bgColor="bg-blue-50 dark:bg-blue-900/30"
                textColor="text-blue-600 dark:text-blue-400"
            />
            
            <FileCard 
                type="audio"
                file={files.audio}
                source={files.audioSource}
                driveId={files.audioDriveId}
                label={t.upload.audioLabel}
                sub={t.upload.fileTypeAudio}
                accept="audio/*"
                inputRef={audioInputRef}
                onUpload={handleAudioUpload}
                icon={FileAudio}
                bgColor="bg-purple-50 dark:bg-purple-900/30"
                textColor="text-purple-600 dark:text-purple-400"
            />

            <FileCard 
                type="srt"
                file={files.srt}
                source={files.srtSource}
                driveId={files.srtDriveId}
                label={t.upload.srtLabel}
                sub={t.upload.fileTypeSrt}
                accept=".srt,.vtt,.ass,.ssa,.sub,.sbv,.json"
                inputRef={srtInputRef}
                onUpload={handleSrtUpload}
                icon={FileText}
                bgColor="bg-orange-50 dark:bg-orange-900/30"
                textColor="text-orange-600 dark:text-orange-400"
            />
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={() => onNext(analyzeSelection, extraContext)}
            disabled={!isReady || !selectedModel}
            className={`px-8 py-3 rounded-lg font-bold flex items-center gap-2 transition-transform active:scale-95 ${
              isReady && selectedModel
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-200 dark:shadow-indigo-900/30' 
                : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            }`}
          >
            {t.upload.startBtn} <PlayCircle size={20} />
          </button>
        </div>
      </div>
      </div>
    </div>
  );
};

export default FileUpload;
