export type Role = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  status?: 'streaming' | 'complete' | 'error' | 'cancelled';
  /** Selection-action metadata for replace-on-page. */
  selection?: {
    action: SelectionAction;
    originalText: string;
    tabId?: number;
    canReplace: boolean;
  };
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

export type ModelTier = 'high' | 'balanced' | 'light';

export interface ModelInfo {
  id: string;
  label: string;
  family: string;
  sizeLabel: string;
  estimatedBytes: number;
  vramMb: number;
  recommendedRamGb: number;
  description: string;
  /** UI grouping — high-end models need more VRAM/RAM. */
  tier?: ModelTier;
  /** Short chip shown in the picker, e.g. "Highest quality". */
  badge?: string;
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
  | {
      type: 'SELECTION_ACTION';
      action: SelectionAction;
      text: string;
      url?: string;
      title?: string;
      canReplace?: boolean;
    }
  | { type: 'REPLACE_SELECTION'; text: string }
  | { type: 'REPLACE_SELECTION_IN_TAB'; tabId: number; text: string }
  | { type: 'GET_SELECTION' }
  | { type: 'PING' };

export type SelectionAction =
  | 'explain'
  | 'summarize'
  | 'rewrite'
  | 'translate'
  | 'eli5'
  | 'improve';

export interface PendingSelectionAction {
  action: SelectionAction;
  text: string;
  url?: string;
  title?: string;
  tabId?: number;
  canReplace: boolean;
  createdAt: number;
}

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
