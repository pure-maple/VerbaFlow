import Dexie, { Table } from 'dexie';
import { ChatSession, GlossarySet, VocabItem, AnalysisResult, AppStep, FileSource } from '../types';

// Define Database Schema Interfaces
export interface WorkspaceState {
  id: string; // 'current'
  step: AppStep;
  srtContent: string;
  analysisResult: AnalysisResult | null;
  confirmedVocab: VocabItem[];
  subtitleOutput: string; // Separate output for Step 3
  markdownOutput: string; // Separate output for Step 4
  updatedAt: number;
}

export interface FileStorage {
  id: string; // 'current_files'
  
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
}

class VerbaFlowDatabase extends Dexie {
  workspace!: Table<WorkspaceState, string>;
  files!: Table<FileStorage, string>;
  chats!: Table<ChatSession, string>;
  glossarySets!: Table<GlossarySet, string>;

  constructor() {
    super('VerbaFlowDB_v5'); // Incremented version for Schema change
    (this as any).version(1).stores({
      workspace: 'id',
      files: 'id',
      chats: 'id, title, createdAt',
      glossarySets: 'id, title, tags'
    });
  }
}

export const db = new VerbaFlowDatabase();

class StorageService {
  
  // --- Workspace State (JSON Data) ---
  
  async saveWorkspaceState(state: Partial<WorkspaceState>) {
    // Merge with existing state to avoid wiping fields not passed
    const existing: Partial<WorkspaceState> = await db.workspace.get('current') || {};
    
    await db.workspace.put({
      id: 'current',
      step: state.step ?? existing.step ?? AppStep.UPLOAD,
      srtContent: state.srtContent ?? existing.srtContent ?? '',
      analysisResult: state.analysisResult ?? existing.analysisResult ?? null,
      confirmedVocab: state.confirmedVocab ?? existing.confirmedVocab ?? [],
      subtitleOutput: state.subtitleOutput ?? existing.subtitleOutput ?? '',
      markdownOutput: state.markdownOutput ?? existing.markdownOutput ?? '',
      updatedAt: Date.now()
    });
  }

  async loadWorkspaceState(): Promise<WorkspaceState | undefined> {
    return await db.workspace.get('current');
  }

  // --- File Storage ---
  
  async saveFiles(
    audio: { file: File | null, source: FileSource, driveId?: string },
    video: { file: File | null, source: FileSource, driveId?: string },
    srt: { file: File | null, source: FileSource, driveId?: string }
  ) {
    await db.files.put({
      id: 'current_files',
      
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

  async loadFiles(): Promise<{ 
      audio: { file: File | null, source: FileSource, driveId?: string }, 
      video: { file: File | null, source: FileSource, driveId?: string }, 
      srt: { file: File | null, source: FileSource, driveId?: string } 
  } | null> {
    const record = await db.files.get('current_files');
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
    
    const fileRec = await db.files.get('current_files');
    let size = 0;
    if (fileRec?.audioBlob) size += fileRec.audioBlob.size;
    if (fileRec?.videoBlob) size += fileRec.videoBlob.size;
    
    return { projectSize: size, chatCount, glossaryCount };
  }

  async clear(storeName: 'projects' | 'chats' | 'glossary') {
    if (storeName === 'projects') {
        await db.workspace.clear();
        await db.files.clear();
    } else if (storeName === 'chats') {
        await db.chats.clear();
    } else if (storeName === 'glossary') {
        await db.glossarySets.clear();
    }
  }
}

export const storage = new StorageService();