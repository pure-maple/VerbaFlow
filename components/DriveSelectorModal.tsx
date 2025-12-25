
import React, { useState, useEffect } from 'react';
import { X, Search, FileText, Video, Music, AlertCircle, Loader2, Link, File, Folder, FolderOpen, ChevronRight, Home, ArrowLeft, Filter, RefreshCw, KeyRound } from 'lucide-react';
import { listDriveFiles, extractDriveFileId, requestDriveRelogin } from '../services/googleDriveService';
import { ConfirmationModal } from './ConfirmationModal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (fileId: string) => void;
  title: string;
  category: 'video' | 'audio' | 'srt' | 'all';
}

export const DriveSelectorModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, title, category }) => {
  const [activeTab, setActiveTab] = useState<'browse' | 'link'>('browse');
  const [files, setFiles] = useState<Array<any>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  
  // Navigation State
  const [currentFolderId, setCurrentFolderId] = useState('root');
  const [breadcrumbs, setBreadcrumbs] = useState<{id: string, name: string}[]>([{id: 'root', name: 'My Drive'}]);
  
  // Search & Filter State
  const [currentFilter, setCurrentFilter] = useState<'video' | 'audio' | 'srt' | 'all'>(category);
  const [searchTerm, setSearchTerm] = useState("");

  // Confirmation Modal State
  const [isReAuthConfirmOpen, setIsReAuthConfirmOpen] = useState(false);

  // Reset on open
  useEffect(() => {
      if (isOpen) {
          setCurrentFolderId('root');
          setBreadcrumbs([{id: 'root', name: 'My Drive'}]);
          setActiveTab('browse');
          setError(null);
          setCurrentFilter(category);
          setSearchTerm("");
      }
  }, [isOpen, category]);

  // Fetch Logic
  useEffect(() => {
    if (isOpen && activeTab === 'browse') {
        const timer = setTimeout(() => {
            fetchFiles(currentFolderId, searchTerm);
        }, searchTerm ? 500 : 0); // Debounce search
        return () => clearTimeout(timer);
    }
  }, [isOpen, activeTab, currentFolderId, currentFilter, searchTerm]);

  const fetchFiles = async (folderId: string, search: string) => {
      setIsLoading(true);
      setError(null);
      try {
          const list = await listDriveFiles(currentFilter, folderId, search);
          setFiles(list);
      } catch (e: any) {
          console.error(e);
          setError(e.message || "Failed to load files");
      } finally {
          setIsLoading(false);
      }
  };

  const handleFolderClick = (folder: any) => {
      setCurrentFolderId(folder.id);
      setBreadcrumbs(prev => [...prev, { id: folder.id, name: folder.name }]);
      setSearchTerm(""); // Clear search when entering folder
  };

  const handleBreadcrumbClick = (index: number) => {
      const target = breadcrumbs[index];
      setCurrentFolderId(target.id);
      setBreadcrumbs(prev => prev.slice(0, index + 1));
      setSearchTerm("");
  };

  const handleReAuthConfirm = async () => {
      // Logic moved from native confirm callback to here
      const success = await requestDriveRelogin();
      if (success) {
          fetchFiles(currentFolderId, searchTerm);
      }
  };

  const handleManualSubmit = () => {
      const id = extractDriveFileId(linkInput);
      if (id) {
          onConfirm(id);
          onClose();
      } else {
          setError("Invalid Link or ID");
      }
  };

  const getIcon = (mimeType: string) => {
      if (mimeType === 'application/vnd.google-apps.folder') return <Folder size={20} className="text-yellow-500 fill-yellow-500/20" />;
      if (mimeType.includes('video')) return <Video size={20} className="text-blue-500" />;
      if (mimeType.includes('audio')) return <Music size={20} className="text-purple-500" />;
      if (mimeType.includes('text') || mimeType.includes('json') || mimeType.includes('subrip')) return <FileText size={20} className="text-orange-500" />;
      return <File size={20} className="text-slate-400" />;
  };

  const formatSize = (bytes?: string) => {
      if (!bytes) return '';
      const b = parseInt(bytes);
      if (b > 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
      return `${(b / 1024).toFixed(1)} KB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      
      {/* Custom Confirmation Modal replaces native confirm() */}
      <ConfirmationModal
        isOpen={isReAuthConfirmOpen}
        onClose={() => setIsReAuthConfirmOpen(false)}
        onConfirm={handleReAuthConfirm}
        title="Google Drive Re-Authorization"
        message="This will open the Google Auth window again. Please ensure you check the box for 'See and download all your Google Drive files' to fix the permission issue."
        confirmText="Proceed to Auth"
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden border border-slate-200 dark:border-slate-700 flex flex-col h-[85vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <div className="flex flex-col gap-1">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <FolderOpen className="text-indigo-600" size={20} /> 
                  {title}
              </h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex">
            <button 
                onClick={() => setActiveTab('browse')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'browse' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                <Search size={16} /> Browse
            </button>
            <button 
                onClick={() => setActiveTab('link')}
                className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors flex items-center justify-center gap-2 ${activeTab === 'link' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
                <Link size={16} /> Paste Link
            </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-900/50">
            {activeTab === 'browse' ? (
                <>
                    {/* Navigation & Search Bar */}
                    <div className="px-4 py-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 space-y-2">
                        {/* Search Input */}
                         <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                                placeholder="Search all files..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                        
                        {/* Breadcrumbs (Hide if searching) */}
                        {!searchTerm && (
                            <div className="flex items-center gap-1 overflow-x-auto text-sm scrollbar-hide pt-1">
                                {breadcrumbs.map((crumb, i) => (
                                    <div key={crumb.id} className="flex items-center whitespace-nowrap">
                                        {i > 0 && <ChevronRight size={14} className="text-slate-400 mx-1" />}
                                        <button 
                                            onClick={() => handleBreadcrumbClick(i)}
                                            className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors ${i === breadcrumbs.length - 1 ? 'font-bold text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}
                                        >
                                            {i === 0 && <Home size={14} />}
                                            {crumb.name}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                        
                         {/* Filter Select */}
                         <div className="flex items-center gap-2">
                            <Filter size={12} className="text-slate-400" />
                            <select 
                                value={currentFilter}
                                onChange={(e) => setCurrentFilter(e.target.value as any)}
                                className="bg-transparent text-slate-500 text-xs font-medium focus:outline-none cursor-pointer hover:text-slate-800 dark:hover:text-slate-200"
                            >
                                <option value="video">Filter: Videos</option>
                                <option value="audio">Filter: Audio</option>
                                <option value="srt">Filter: Subtitles</option>
                                <option value="all">Filter: All Files</option>
                            </select>
                        </div>
                    </div>

                    {/* File List */}
                    <div className="flex-1 overflow-y-auto p-2">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-60">
                                <Loader2 className="animate-spin text-indigo-600" size={32} />
                                <p className="text-slate-500 text-sm">Loading...</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
                                <AlertCircle className="text-red-500" size={32} />
                                <p className="text-slate-800 dark:text-slate-200 font-medium">Access Error</p>
                                <p className="text-slate-500 text-xs max-w-xs mb-4 font-mono bg-red-50 dark:bg-red-900/20 p-2 rounded">{error}</p>
                                <div className="flex gap-2">
                                    <button onClick={() => fetchFiles(currentFolderId, searchTerm)} className="text-xs flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50"><RefreshCw size={12}/> Retry</button>
                                    <button onClick={() => setIsReAuthConfirmOpen(true)} className="text-xs flex items-center gap-1 bg-indigo-600 text-white border border-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700"><KeyRound size={12}/> Re-Authorize</button>
                                </div>
                            </div>
                        ) : files.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                                <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-full">
                                    <Folder className="text-slate-300 dark:text-slate-600" size={48} />
                                </div>
                                <div>
                                    <p className="text-slate-600 dark:text-slate-300 font-medium">{searchTerm ? "No results found" : "Empty Folder"}</p>
                                    <div className="text-slate-400 text-xs mt-2 max-w-xs mx-auto space-y-2">
                                        <p>{searchTerm ? `No files matching "${searchTerm}".` : `No files in this view.`}</p>
                                        
                                        {/* DIAGNOSTIC / FIX UI */}
                                        <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/30 text-amber-800 dark:text-amber-200 text-left">
                                            <p className="font-bold mb-1 flex items-center gap-1"><AlertCircle size={10} /> Potential Scope Issue</p>
                                            <p className="opacity-90">Can't see your files? You may have limited the app's access permissions.</p>
                                            <button 
                                                onClick={() => setIsReAuthConfirmOpen(true)}
                                                className="mt-2 w-full py-1.5 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded text-xs font-semibold shadow-sm hover:bg-amber-100 dark:hover:bg-amber-900/40"
                                            >
                                                Fix Permissions (Re-login)
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 gap-1">
                                {files.map(file => {
                                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                                    return (
                                        <button 
                                            key={file.id}
                                            onClick={() => isFolder ? handleFolderClick(file) : (onConfirm(file.id), onClose())}
                                            className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-indigo-500 hover:shadow-sm transition-all text-left group active:scale-[0.99]"
                                        >
                                            <div className={`p-2 rounded-lg transition-colors ${isFolder ? 'bg-yellow-50 dark:bg-yellow-900/10 group-hover:bg-yellow-100 dark:group-hover:bg-yellow-900/30' : 'bg-slate-100 dark:bg-slate-900 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30'}`}>
                                                {getIcon(file.mimeType)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{file.name}</div>
                                                <div className="text-xs text-slate-500 flex gap-2">
                                                    <span>{new Date(file.modifiedTime).toLocaleDateString()}</span>
                                                    {!isFolder && file.size && <span>• {formatSize(file.size)}</span>}
                                                </div>
                                            </div>
                                            {isFolder && <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500" />}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-col gap-4 p-6">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                        Paste a Google Drive sharing link or file ID directly. 
                        <br/>
                        <span className="text-xs text-slate-400">(Right click file in Drive &gt; Share &gt; Copy Link)</span>
                    </p>
                    <textarea 
                        className="w-full p-3 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm resize-none"
                        placeholder="https://drive.google.com/file/d/..."
                        rows={4}
                        value={linkInput}
                        onChange={e => setLinkInput(e.target.value)}
                    />
                    {error && <p className="text-red-500 text-sm flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}
                    <div className="flex justify-end">
                        <button onClick={handleManualSubmit} disabled={!linkInput} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
                            Load File
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
