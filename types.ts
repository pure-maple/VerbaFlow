
export enum AppStep {
  UPLOAD = 1,
  CONFIRMATION = 2, // Analysis loading state happens inside this view initially
  GENERATION_SRT = 3,
  GENERATION_MD = 4,
}

export enum ViewMode {
  STUDIO = 'studio',
  GLOSSARY = 'glossary',
  AGENTS = 'agents'
}

export type FileSource = 'local' | 'drive';

export interface ProjectMetadata {
  id: string;
  name: string;
  updatedAt: number;
  createdAt: number;
  step: AppStep;
  previewText?: string; // Short summary or first few words
}

// New Interface for Export/Import
export interface ProjectExport {
  version: number;
  metadata: ProjectMetadata;
  workspaceState: any; // Using any to avoid circular dependency with storage types, typically WorkspaceState
  timestamp: number;
}

export interface AnalyzeSelection {
  video: boolean;
  audio: boolean;
  srt: boolean;
}

export interface UploadedFiles {
  audio: File | null;
  audioSource: FileSource;
  audioDriveId?: string;
  
  video: File | null;
  videoSource: FileSource;
  videoDriveId?: string;

  srt: File | null;
  srtSource: FileSource;
  srtDriveId?: string;
  
  srtContent: string;
  subtitleFormat?: string; // srt, vtt, ass, etc.
}

export interface SubtitleItem {
  id: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  text: string;
}

export interface VocabItem {
  id: number;
  timeRange: string;
  original: string;
  corrected: string;
  type: string;
  status: 'corrected' | 'needs_confirmation' | 'check_spelling' | 'custom' | 'ai_recheck';
  customStatus?: string; // For user defined status
  userNote?: string;      // User's instructions/notes (editable)
  aiReason?: string;      // AI's original reason (read-only reference)
}

export interface AnalysisResult {
  summary: {
    topic: string;
    speakers: string[];
    duration: string;
    agenda: string[];
  };
  vocabList: VocabItem[];
}

export interface GlossaryItem {
  id: string;
  term: string;
  definition: string; // Description
  remarks?: string;   // Extra notes
}

export interface GlossarySet {
  id: string;
  title: string;
  description: string;
  tags: string[]; // For categorization (e.g., "Medical", "Gaming", "Legal")
  items: GlossaryItem[];
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: number;
}

export interface StepProps {
  onNext: () => void;
  onBack?: () => void;
}
