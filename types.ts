export enum AppStep {
  UPLOAD = 1,
  ANALYSIS = 2,
  CONFIRMATION = 3,
  GENERATION_SRT = 4,
  GENERATION_MD = 5,
}

export enum ViewMode {
  STUDIO = 'studio',
  GLOSSARY = 'glossary'
}

export interface UploadedFiles {
  audio: File | null;
  srt: File | null;
  srtContent: string;
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
  status: 'corrected' | 'needs_confirmation' | 'check_spelling' | 'custom';
  customStatus?: string; // For user defined status
  remarks?: string;      // For extra notes
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
  definition: string; // Contextual definition
  context?: string;   // Example usage or strict rule
  selected?: boolean; // For UI selection
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
