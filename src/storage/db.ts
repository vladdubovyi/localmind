import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { AppSettings, Conversation, ModelStatus } from '@/types';
import { DEFAULT_MODEL_ID } from '@/models/catalog';

interface LocalMindDB extends DBSchema {
  settings: {
    key: string;
    value: AppSettings;
  };
  conversations: {
    key: string;
    value: Conversation;
    indexes: { 'by-updated': number };
  };
  modelMeta: {
    key: string;
    value: {
      modelId: string;
      status: ModelStatus;
      lastUsedAt?: number;
      error?: string;
    };
  };
}

const DB_NAME = 'localmind';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<LocalMindDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<LocalMindDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
        if (!db.objectStoreNames.contains('conversations')) {
          const store = db.createObjectStore('conversations', { keyPath: 'id' });
          store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('modelMeta')) {
          db.createObjectStore('modelMeta', { keyPath: 'modelId' });
        }
      },
    });
  }
  return dbPromise;
}

export const DEFAULT_SETTINGS: AppSettings = {
  selectedModelId: DEFAULT_MODEL_ID,
  theme: 'dark',
  memoryEnabled: false,
  autoSummarize: false,
  analyticsEnabled: false,
  crashReportingEnabled: false,
  projectBrowseCaptureEnabled: true,
  generation: {
    temperature: 0.7,
    topP: 0.95,
    maxTokens: 1024,
    systemPrompt: '',
  },
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb();
  const stored = await db.get('settings', 'app');
  return stored ? { ...DEFAULT_SETTINGS, ...stored, generation: { ...DEFAULT_SETTINGS.generation, ...stored.generation } } : DEFAULT_SETTINGS;
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb();
  await db.put('settings', settings, 'app');
}

export async function listConversations(): Promise<Conversation[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('conversations', 'by-updated');
  return all.reverse();
}

export async function getConversation(id: string): Promise<Conversation | undefined> {
  const db = await getDb();
  return db.get('conversations', id);
}

export async function saveConversation(conversation: Conversation): Promise<void> {
  const db = await getDb();
  await db.put('conversations', conversation);
}

export async function deleteConversation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('conversations', id);
}

export async function clearConversations(): Promise<void> {
  const db = await getDb();
  await db.clear('conversations');
}

export async function searchConversations(query: string, limit = 20): Promise<Conversation[]> {
  const all = await listConversations();
  const q = query.trim().toLowerCase();
  if (!q) return all.slice(0, limit);
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  const scored = all
    .map((c) => {
      const hay = [c.title, c.pageTitle ?? '', c.pageUrl ?? '', ...c.messages.map((m) => m.content)]
        .join('\n')
        .toLowerCase();
      let score = 0;
      if (hay.includes(q)) score += 100;
      for (const tok of tokens) {
        if (hay.includes(tok)) score += 10;
      }
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.c.updatedAt - a.c.updatedAt);
  return scored.slice(0, limit).map((x) => x.c);
}

export async function getModelMeta(modelId: string) {
  const db = await getDb();
  return db.get('modelMeta', modelId);
}

export async function setModelMeta(
  modelId: string,
  status: ModelStatus,
  error?: string,
): Promise<void> {
  const db = await getDb();
  await db.put('modelMeta', {
    modelId,
    status,
    lastUsedAt: Date.now(),
    error,
  });
}

export async function clearAllLocalData(): Promise<void> {
  const db = await getDb();
  await db.clear('conversations');
  await db.clear('modelMeta');
  await db.put('settings', DEFAULT_SETTINGS, 'app');
}
