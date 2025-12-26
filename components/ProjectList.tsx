
import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit2, FolderOpen, Clock, Calendar, ArrowRight, Loader2, Download, Upload } from 'lucide-react';
import { ProjectMetadata, AppStep } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { storage } from '../services/storage';
import { ConfirmationModal } from './ConfirmationModal';
import { InputModal } from './InputModal';
import { ToastType } from './Toast';

interface Props {
  onOpenProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onShowToast: (message: string, type: ToastType) => void;
}

const ProjectList: React.FC<Props> = ({ onOpenProject, onCreateProject, onShowToast }) => {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Import Refs
  const importInputRef = useRef<HTMLInputElement>(null);
  
  // Modals
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{id: string, name: string} | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setIsLoading(true);
    try {
        const list = await storage.listProjects();
        setProjects(list);
    } catch (e) {
        console.error("Failed to load projects", e);
        onShowToast(t.messages.projectLoadFailed, 'error');
    } finally {
        setIsLoading(false);
    }
  };

  const handleDelete = async () => {
      if (deleteTargetId) {
          setIsDeleting(true);
          try {
              await storage.deleteProject(deleteTargetId);
              setDeleteTargetId(null);
              await loadProjects();
          } catch (error) {
              console.error("Delete failed", error);
              onShowToast(t.messages.deleteFailed, 'error');
          } finally {
              setIsDeleting(false);
          }
      }
  };

  const handleRename = async (newName: string) => {
      if (renameTarget && newName.trim()) {
          try {
              await storage.renameProject(renameTarget.id, newName);
              setRenameTarget(null);
              setIsRenameModalOpen(false);
              loadProjects();
          } catch (e) {
              console.error("Rename failed", e);
              onShowToast("Rename failed", 'error');
          }
      }
  };

  const handleExport = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
          const exportData = await storage.exportProject(id);
          if (exportData) {
              const dataStr = JSON.stringify(exportData, null, 2);
              const blob = new Blob([dataStr], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              // Sanitize filename
              const safeName = exportData.metadata.name.replace(/[^a-z0-9\u4e00-\u9fa5]/gi, '_').substring(0, 50);
              link.download = `${safeName}.vfproj`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
              onShowToast(t.messages.exportSuccess, 'success');
          }
      } catch (err) {
          console.error(err);
          onShowToast("Export failed", 'error');
      }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          
          reader.onload = async (ev) => {
              try {
                  const content = ev.target?.result as string;
                  if (!content) throw new Error("Empty file content");
                  
                  let data;
                  try {
                      data = JSON.parse(content);
                  } catch (parseErr) {
                      throw new Error("Invalid JSON format");
                  }
                  
                  if (!data || typeof data !== 'object') {
                      throw new Error("Invalid data structure");
                  }

                  // 1. Standard Format Check
                  let importData = data;

                  // 2. Legacy/Raw Format Compatibility
                  // If 'metadata' is missing but 'step' or 'srtContent' exists, assume it's a raw state dump
                  if (!data.metadata && (data.step || data.srtContent !== undefined)) {
                      console.warn("Detected legacy project format. Attempting conversion...");
                      const now = Date.now();
                      importData = {
                          version: 1,
                          timestamp: now,
                          metadata: {
                              id: data.id || `legacy-${now}`,
                              name: data.name || file.name.replace('.vfproj', '').replace('.json', '') || "Imported Project",
                              updatedAt: now,
                              createdAt: now,
                              step: data.step || AppStep.UPLOAD,
                              previewText: ""
                          },
                          workspaceState: {
                              ...data,
                              // Ensure ID matches
                              id: data.id || `legacy-${now}`
                          }
                      };
                  }

                  // 3. Final Validation
                  if (!importData.metadata || !importData.workspaceState) {
                      console.error("Missing fields:", importData);
                      throw new Error("Invalid Project Format: Missing metadata or workspace state.");
                  }

                  await storage.importProject(importData);
                  await loadProjects();
                  onShowToast(t.messages.importSuccess, 'success');
              } catch (err: any) {
                  console.error("Import Error:", err);
                  onShowToast(`${t.messages.importFailed} ${err.message}`, 'error');
              } finally {
                  // Reset input
                  if (importInputRef.current) importInputRef.current.value = '';
              }
          };
          reader.readAsText(file);
      }
  };

  const getStepLabel = (step: AppStep) => {
      const map: Record<number, string> = t.projects.steps;
      return map[step] || "Unknown";
  };

  const getStepColor = (step: AppStep) => {
      switch(step) {
          case AppStep.UPLOAD: return 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300';
          case AppStep.CONFIRMATION: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
          case AppStep.GENERATION_SRT: return 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300';
          case AppStep.GENERATION_MD: return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
          default: return 'bg-slate-100';
      }
  };

  // Skeleton Loader Component
  const ProjectSkeleton = () => (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm animate-pulse">
          <div className="flex justify-between items-center mb-4">
              <div className="h-5 w-20 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
              <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded-lg"></div>
          </div>
          <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-700 rounded mb-3"></div>
          <div className="h-4 w-full bg-slate-200 dark:bg-slate-700 rounded mb-2"></div>
          <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
          <div className="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
              <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded"></div>
              <div className="h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded"></div>
          </div>
      </div>
  );

  return (
    <div className="h-full flex flex-col p-6 md:p-8 max-w-7xl mx-auto w-full animate-in fade-in duration-500">
        <ConfirmationModal
            isOpen={!!deleteTargetId}
            onClose={() => !isDeleting && setDeleteTargetId(null)}
            onConfirm={handleDelete}
            title={t.common.delete}
            message={t.projects.deleteConfirm}
            isDanger={true}
            isLoading={isDeleting}
            confirmText={t.common.delete}
            cancelText={t.common.cancel}
        />
        
        <InputModal 
            isOpen={isRenameModalOpen}
            onClose={() => setIsRenameModalOpen(false)}
            onConfirm={handleRename}
            title={t.common.rename}
            message=""
            initialValue={renameTarget?.name || ""}
            placeholder="Project Name"
        />

        <InputModal 
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onConfirm={onCreateProject}
            title={t.projects.newProject}
            message=""
            initialValue={t.projects.untitled}
            placeholder="Project Name"
        />

        <input 
            type="file" 
            ref={importInputRef} 
            className="hidden" 
            accept=".vfproj,.json"
            onChange={handleImport}
        />

        <div className="flex justify-between items-center mb-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <FolderOpen className="text-indigo-600" />
                    {t.projects.title}
                </h1>
                <p className="text-slate-500 mt-1">{t.projects.subtitle}</p>
            </div>
            <div className="flex gap-3">
                <button 
                    onClick={() => importInputRef.current?.click()}
                    className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 font-medium transition-all"
                >
                    <Upload size={18} /> {t.projects.importProject}
                </button>
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 flex items-center gap-2 font-medium transition-all active:scale-95 hover:shadow-lg hover:shadow-indigo-500/20"
                >
                    <Plus size={20} /> {t.projects.newProject}
                </button>
            </div>
        </div>

        {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <ProjectSkeleton key={i} />)}
            </div>
        ) : projects.length === 0 ? (
            <div className="flex-1 flex flex-col justify-center items-center text-slate-400 animate-in zoom-in-95 duration-500">
                <div className="bg-slate-100 dark:bg-slate-800 p-6 rounded-full mb-6">
                    <FolderOpen size={64} className="opacity-40 text-indigo-500" />
                </div>
                <p className="text-lg font-medium text-slate-600 dark:text-slate-300 mb-2">{t.projects.empty}</p>
                <button 
                    onClick={() => setIsCreateModalOpen(true)} 
                    className="text-indigo-600 hover:underline text-sm"
                >
                    {t.projects.createFirst}
                </button>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                {projects.map((project, index) => (
                    <div 
                        key={project.id} 
                        onClick={() => onOpenProject(project.id)}
                        className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm hover:shadow-xl hover:border-indigo-400 dark:hover:border-indigo-500 transition-all cursor-pointer relative flex flex-col h-full animate-in slide-in-from-bottom-4 fade-in duration-500"
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        <div className="flex justify-between items-start mb-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStepColor(project.step)}`}>
                                {getStepLabel(project.step)}
                            </span>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-1 group-hover:translate-y-0" onClick={e => e.stopPropagation()}>
                                <button 
                                    onClick={(e) => handleExport(project.id, e)}
                                    className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    title={t.projects.exportProject}
                                >
                                    <Download size={14} />
                                </button>
                                <button 
                                    onClick={() => { setRenameTarget({id: project.id, name: project.name}); setIsRenameModalOpen(true); }}
                                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                    title={t.common.rename}
                                >
                                    <Edit2 size={14} />
                                </button>
                                <button 
                                    onClick={() => setDeleteTargetId(project.id)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title={t.common.delete}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                        
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2 truncate group-hover:text-indigo-600 transition-colors">
                            {project.name}
                        </h3>
                        
                        <div className="flex-1">
                            {project.previewText ? (
                                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                                    {project.previewText}
                                </p>
                            ) : (
                                <p className="text-sm text-slate-400 italic mb-4">{t.projects.noSummary}</p>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700 pt-3 mt-2">
                            <div className="flex items-center gap-1">
                                <Clock size={12} />
                                <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center gap-1 text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0">
                                {t.projects.openBtn} <ArrowRight size={12} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
    </div>
  );
};

export default ProjectList;
