export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  status?: 'streaming' | 'complete' | 'error' | 'cancelled';
}

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pageUrl?: string;
  pageTitle?: string;
}

export type ModelStatus = 'not_downloaded' | 'downloading' | 'ready' | 'loading' | 'error';

export interface ModelInfo {
  id: string;
  label: string;
  family: string;
  sizeLabel: string;
  estimatedBytes: number;
  vramMb: number;
  recommendedRamGb: number;
  description: string;
}

export interface DownloadProgress {
  progress: number;
  text: string;
  timeElapsed: number;
}

export interface GenerationSettings {
  temperature: number;
  topP: number;
  maxTokens: number;
  systemPrompt: string;
}

export interface AppSettings {
  selectedModelId: string;
  theme: 'dark' | 'light' | 'system';
  memoryEnabled: boolean;
  autoSummarize: boolean;
  generation: GenerationSettings;
}

export interface InitProgressReport {
  progress: number;
  text: string;
  timeElapsed: number;
}

export interface ChatRequest {
  messages: Array<{ role: Role; content: string }>;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatChunk {
  content: string;
  done: boolean;
}

export type RuntimeMessage =
  | { type: 'OPEN_SIDE_PANEL' }
  | { type: 'GET_PAGE_CONTEXT' }
  | { type: 'PAGE_CONTEXT_RESULT'; payload: PageContext }
  | { type: 'SELECTION_ACTION'; action: SelectionAction; text: string }
  | { type: 'PING' };

export type SelectionAction =
  | 'explain'
  | 'summarize'
  | 'rewrite'
  | 'translate'
  | 'eli5'
  | 'improve';

export interface PageContext {
  url: string;
  title: string;
  headings: string[];
  paragraphs: string[];
  lists: string[];
  tables: string[];
  text: string;
}

export interface AIProvider {
  initialize(modelId: string, onProgress?: (p: InitProgressReport) => void): Promise<void>;
  downloadModel(modelId: string, onProgress?: (p: InitProgressReport) => void): Promise<void>;
  chat(
    request: ChatRequest,
    onChunk?: (chunk: ChatChunk) => void,
  ): Promise<string>;
  summarize(text: string, style?: 'tldr' | 'bullets' | 'facts' | 'actions'): Promise<string>;
  embed(texts: string[]): Promise<number[][]>;
  cancel(): Promise<void>;
  dispose(): Promise<void>;
  isReady(): boolean;
  getModelId(): string | null;
}
