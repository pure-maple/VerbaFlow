
import Dexie, { Table } from 'dexie';
import { ChatSession, GlossarySet, VocabItem, AnalysisResult, AppStep, FileSource, ProjectMetadata, ProjectExport } from '../types';

// Define Database Schema Interfaces
export interface WorkspaceState {
  id: string; // Project ID
  name: string;
  step: AppStep;
  srtContent: string;
  analysisResult: AnalysisResult | null;
  confirmedVocab: VocabItem[];
  subtitleOutput: string;
  markdownOutput: string;
  updatedAt: number;
}

export interface FileStorage {
  id: string; // Project ID (Matches WorkspaceState.id)
  
  audioBlob: Blob | null;
  audioName: string | null;
  audioType: string | null;
  audioSource: FileSource;
  audioDriveId?: string;

  videoBlob: Blob | null;
  videoName: string | null;
  videoType: string | null;
  videoSource: FileSource;
  videoDriveId?: string;

  srtBlob: Blob | null;
  srtSource: FileSource;
  srtDriveId?: string;
  
  updatedAt: number;
}

export interface StorageStats {
  projectSize: number;
  chatCount: number;
  glossaryCount: number;
  projectCount: number;
}

class VerbaFlowDatabase extends Dexie {
  projects!: Table<ProjectMetadata, string>; // Lightweight list
  workspace!: Table<WorkspaceState, string>; // Heavy JSON data
  files!: Table<FileStorage, string>; // Heavy Blobs
  chats!: Table<ChatSession, string>;
  glossarySets!: Table<GlossarySet, string>;

  constructor() {
    super('VerbaFlowDB_v6'); 
    (this as any).version(1).stores({
      projects: 'id, updatedAt', // New table for listing
      workspace: 'id',
      files: 'id',
      chats: 'id, title, createdAt',
      glossarySets: 'id, title, tags'
    });
  }
}

export const db = new VerbaFlowDatabase();

class StorageService {
  
  // --- Project Management ---

  async createProject(name: string): Promise<string> {
    const id = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const meta: ProjectMetadata = {
      id,
      name,
      updatedAt: now,
      createdAt: now,
      step: AppStep.UPLOAD,
      previewText: ''
    };

    // Initialize empty state
    await db.transaction('rw', db.projects, db.workspace, db.files, async () => {
      await db.projects.add(meta);
      await db.workspace.add({
        id,
        name,
        step: AppStep.UPLOAD,
        srtContent: '',
        analysisResult: null,
        confirmedVocab: [],
        subtitleOutput: '',
        markdownOutput: '',
        updatedAt: now
      });
      // Don't create file entry until files are added to save space
    });

    return id;
  }

  async listProjects(): Promise<ProjectMetadata[]> {
    return await db.projects.orderBy('updatedAt').reverse().toArray();
  }

  async deleteProject(id: string) {
    await db.transaction('rw', db.projects, db.workspace, db.files, async () => {
      await db.projects.delete(id);
      await db.workspace.delete(id);
      await db.files.delete(id);
    });
  }

  async renameProject(id: string, newName: string) {
      await db.projects.update(id, { name: newName, updatedAt: Date.now() });
      await db.workspace.update(id, { name: newName }); // Sync name to workspace
  }

  // --- Import / Export ---

  async exportProject(id: string): Promise<ProjectExport | null> {
      const meta = await db.projects.get(id);
      const state = await db.workspace.get(id);
      
      if (!meta || !state) return null;

      return {
          version: 1,
          timestamp: Date.now(),
          metadata: meta,
          workspaceState: state
      };
  }

  async importProject(data: ProjectExport): Promise<string> {
      // 1. Generate NEW ID to avoid conflicts (Import as copy)
      const newId = `proj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const now = Date.now();

      // 2. Prepare new objects with new ID
      const newMeta: ProjectMetadata = {
          ...data.metadata,
          id: newId,
          name: `${data.metadata.name} (Imported)`,
          createdAt: now,
          updatedAt: now
      };

      const newState: WorkspaceState = {
          ...data.workspaceState,
          id: newId,
          name: newMeta.name,
          updatedAt: now
      };

      // 3. Save
      await db.transaction('rw', db.projects, db.workspace, async () => {
          await db.projects.add(newMeta);
          await db.workspace.add(newState);
      });

      return newId;
  }

  // --- Workspace State (JSON Data) ---
  
  async saveWorkspaceState(projectId: string, state: Partial<WorkspaceState>) {
    if (!projectId) return; // Guard against legacy calls without ID

    const now = Date.now();
    
    await db.transaction('rw', db.workspace, db.projects, async () => {
        const existing: Partial<WorkspaceState> = await db.workspace.get(projectId) || {};
        
        // 1. Update Detail State
        await db.workspace.put({
          id: projectId,
          name: state.name ?? existing.name ?? 'Untitled Project',
          step: state.step ?? existing.step ?? AppStep.UPLOAD,
          srtContent: state.srtContent ?? existing.srtContent ?? '',
          analysisResult: state.analysisResult ?? existing.analysisResult ?? null,
          confirmedVocab: state.confirmedVocab ?? existing.confirmedVocab ?? [],
          subtitleOutput: state.subtitleOutput ?? existing.subtitleOutput ?? '',
          markdownOutput: state.markdownOutput ?? existing.markdownOutput ?? '',
          updatedAt: now
        });

        // 2. Update Metadata (for List View)
        // We only update relevant metadata fields
        const metaUpdate: Partial<ProjectMetadata> = { updatedAt: now };
        if (state.step) metaUpdate.step = state.step;
        if (state.name) metaUpdate.name = state.name;
        // Optionally update preview text based on summary topic
        if (state.analysisResult?.summary?.topic) {
            metaUpdate.previewText = state.analysisResult.summary.topic;
        }

        await db.projects.update(projectId, metaUpdate);
    });
  }

  async loadWorkspaceState(projectId: string): Promise<WorkspaceState | undefined> {
    return await db.workspace.get(projectId);
  }

  // --- File Storage ---
  
  async saveFiles(
    projectId: string,
    audio: { file: File | null, source: FileSource, driveId?: string },
    video: { file: File | null, source: FileSource, driveId?: string },
    srt: { file: File | null, source: FileSource, driveId?: string }
  ) {
    if (!projectId) return;

    await db.files.put({
      id: projectId,
      
      audioBlob: audio.file, 
      audioName: audio.file ? audio.file.name : (audio.driveId ? 'Drive Audio' : null),
      audioType: audio.file ? audio.file.type : null,
      audioSource: audio.source,
      audioDriveId: audio.driveId,

      videoBlob: video.file,
      videoName: video.file ? video.file.name : (video.driveId ? 'Drive Video' : null),
      videoType: video.file ? video.file.type : null,
      videoSource: video.source,
      videoDriveId: video.driveId,

      srtBlob: srt.file,
      srtSource: srt.source,
      srtDriveId: srt.driveId,
      
      updatedAt: Date.now()
    });
  }

  async loadFiles(projectId: string): Promise<{ 
      audio: { file: File | null, source: FileSource, driveId?: string }, 
      video: { file: File | null, source: FileSource, driveId?: string }, 
      srt: { file: File | null, source: FileSource, driveId?: string } 
  } | null> {
    const record = await db.files.get(projectId);
    if (!record) return null;

    let audioFile: File | null = null;
    if (record.audioBlob && record.audioName) {
        audioFile = new File([record.audioBlob], record.audioName, { type: record.audioType || undefined });
    }

    let videoFile: File | null = null;
    if (record.videoBlob && record.videoName) {
        videoFile = new File([record.videoBlob], record.videoName, { type: record.videoType || undefined });
    }

    let srtFile: File | null = null;
    if (record.srtBlob) {
        srtFile = new File([record.srtBlob], "uploaded.srt", { type: "text/plain" });
    }

    return { 
        audio: { file: audioFile, source: record.audioSource || 'local', driveId: record.audioDriveId }, 
        video: { file: videoFile, source: record.videoSource || 'local', driveId: record.videoDriveId },
        srt: { file: srtFile, source: record.srtSource || 'local', driveId: record.srtDriveId }
    };
  }

  // --- Chats ---

  async saveChats(chats: ChatSession[]) {
    await db.chats.bulkPut(chats);
  }

  async loadChats(): Promise<ChatSession[]> {
    return await db.chats.orderBy('createdAt').reverse().toArray();
  }
  
  async deleteChat(id: string) {
      await db.chats.delete(id);
  }
  
  async saveChatSession(session: ChatSession) {
      await db.chats.put(session);
  }

  // --- Glossary ---

  async saveGlossarySet(set: GlossarySet) {
    await db.glossarySets.put({ ...set, updatedAt: Date.now() });
  }

  async getAllGlossarySets(): Promise<GlossarySet[]> {
    return await db.glossarySets.toArray();
  }

  async deleteGlossarySet(id: string) {
    await db.glossarySets.delete(id);
  }

  // --- Utility ---

  async getStats(): Promise<StorageStats> {
    const chatCount = await db.chats.count();
    const glossaryCount = await db.glossarySets.count();
    const projectCount = await db.projects.count();
    
    // Calculate total size roughly
    let size = 0;
    // Iterate over files is expensive, maybe just sample or use a different method if slow
    // For now, we'll just count how many file records
    // Ideally Dexie doesn't give size directly.
    
    return { projectSize: size, chatCount, glossaryCount, projectCount };
  }

  async clear(storeName: 'projects' | 'chats' | 'glossary') {
    if (storeName === 'projects') {
        await db.workspace.clear();
        await db.projects.clear();
        await db.files.clear();
    } else if (storeName === 'chats') {
        await db.chats.clear();
    } else if (storeName === 'glossary') {
        await db.glossarySets.clear();
    }
  }
}

export const storage = new StorageService();
