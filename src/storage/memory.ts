/**
 * Persistent memories via chrome.storage.local (MV3 SW-safe).
 * Keyword search only — no embeddings required for ship.
 */

import type { ProjectScopedMemoryRef } from '@/phil/projectTypes';

export type MemoryEntry = ProjectScopedMemoryRef & {
  id: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  source?: 'nl' | 'message' | 'tool' | 'import';
};

const KEY = 'philMemories';

async function readAll(): Promise<MemoryEntry[]> {
  const stored = await chrome.storage.local.get(KEY);
  const value = stored[KEY];
  return Array.isArray(value) ? (value as MemoryEntry[]) : [];
}

async function writeAll(entries: MemoryEntry[]): Promise<void> {
  const trimmed = entries.length > 500 ? entries.slice(entries.length - 500) : entries;
  await chrome.storage.local.set({ [KEY]: trimmed });
}

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function keywordScore(haystack: string, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 0;
  const hay = haystack.toLowerCase();
  if (hay.includes(q)) return 100 + q.length;
  const tokens = tokenize(q);
  if (!tokens.length) return 0;
  let hits = 0;
  for (const t of tokens) {
    if (hay.includes(t)) hits += 1;
  }
  if (hits === 0) return 0;
  return (hits / tokens.length) * 50 + hits;
}

export async function listMemories(): Promise<MemoryEntry[]> {
  const all = await readAll();
  return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getMemory(id: string): Promise<MemoryEntry | undefined> {
  const all = await readAll();
  return all.find((m) => m.id === id);
}

export async function rememberMemory(
  text: string,
  opts: { projectId?: string; source?: MemoryEntry['source'] } = {},
): Promise<MemoryEntry> {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) throw new Error('Memory text is required');
  const now = Date.now();
  const all = await readAll();
  const existing = all.find((m) => m.text.toLowerCase() === cleaned.toLowerCase());
  if (existing) {
    const next = {
      ...existing,
      updatedAt: now,
      projectId: opts.projectId ?? existing.projectId,
      source: opts.source ?? existing.source,
    };
    await writeAll(all.map((m) => (m.id === existing.id ? next : m)));
    return next;
  }
  const entry: MemoryEntry = {
    id: uid('mem'),
    text: cleaned,
    createdAt: now,
    updatedAt: now,
    projectId: opts.projectId,
    source: opts.source ?? 'tool',
  };
  all.push(entry);
  await writeAll(all);
  return entry;
}

export async function forgetMemory(idOrText: string): Promise<MemoryEntry | null> {
  const all = await readAll();
  const needle = idOrText.trim().toLowerCase();
  if (!needle) return null;
  const idx = all.findIndex(
    (m) =>
      m.id === idOrText.trim() ||
      m.text.toLowerCase() === needle ||
      m.text.toLowerCase().includes(needle),
  );
  if (idx < 0) return null;
  const [removed] = all.splice(idx, 1);
  await writeAll(all);
  return removed ?? null;
}

export async function searchMemories(
  query: string,
  limit = 20,
): Promise<Array<MemoryEntry & { score: number }>> {
  const all = await readAll();
  const q = query.trim();
  if (!q) {
    return all
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((m) => ({ ...m, score: 0 }));
  }
  return all
    .map((m) => ({ ...m, score: keywordScore(m.text, q) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt)
    .slice(0, limit);
}

export async function clearMemories(): Promise<number> {
  const all = await readAll();
  await writeAll([]);
  return all.length;
}
