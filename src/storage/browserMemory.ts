/**
 * Browser memory (browse index): history + tab activity, keyword search, retention window.
 * SW-safe via chrome.storage.local (keyword scoring — no MiniSearch dependency).
 */

import { keywordScore } from '@/storage/memory';
import { listTabActivitySince } from '@/storage/phil';
import { getSettings } from '@/storage/db';
import {
  BROWSE_RETENTION_MS,
  extractBrowseSearchQuery,
  parseRelativeWindow,
  pruneExpired,
  type BrowseVisit,
  type BrowseVisitSource,
} from '@/storage/browserMemoryQuery';

export {
  BROWSE_RETENTION_MS,
  extractBrowseSearchQuery,
  pruneExpired,
  type BrowseVisit,
  type BrowseVisitSource,
};

export const BROWSE_INDEX_KEY = 'philBrowseIndex';
/** E2E harness: treat history as granted without Chrome permission prompt. */
export const HISTORY_PERMISSION_SEED_KEY = 'philHistoryPermissionSeed';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return u.toString();
  } catch {
    return url.trim();
  }
}

async function readAll(): Promise<BrowseVisit[]> {
  const stored = await chrome.storage.local.get(BROWSE_INDEX_KEY);
  const value = stored[BROWSE_INDEX_KEY];
  return Array.isArray(value) ? (value as BrowseVisit[]) : [];
}

async function writeAll(entries: BrowseVisit[]): Promise<void> {
  const pruned = pruneExpired(entries);
  const trimmed = pruned.length > 2000 ? pruned.slice(pruned.length - 2000) : pruned;
  await chrome.storage.local.set({ [BROWSE_INDEX_KEY]: trimmed });
}

export async function hasHistoryPermission(): Promise<boolean> {
  try {
    if (await chrome.permissions.contains({ permissions: ['history'] })) return true;
  } catch {
    /* ignore */
  }
  try {
    const stored = await chrome.storage.local.get(HISTORY_PERMISSION_SEED_KEY);
    return Boolean(stored[HISTORY_PERMISSION_SEED_KEY]);
  } catch {
    return false;
  }
}

export async function requestHistoryPermission(): Promise<boolean> {
  try {
    const ok = await chrome.permissions.request({ permissions: ['history'] });
    if (ok) return true;
  } catch {
    /* ignore */
  }
  return hasHistoryPermission();
}

export async function revokeHistoryPermission(): Promise<boolean> {
  try {
    await chrome.storage.local.remove(HISTORY_PERMISSION_SEED_KEY);
  } catch {
    /* ignore */
  }
  try {
    return await chrome.permissions.remove({ permissions: ['history'] });
  } catch {
    return false;
  }
}

export async function listBrowseIndex(): Promise<BrowseVisit[]> {
  const all = pruneExpired(await readAll());
  return [...all].sort((a, b) => b.visitedAt - a.visitedAt);
}

export async function clearBrowseIndex(): Promise<number> {
  const all = await readAll();
  await chrome.storage.local.set({ [BROWSE_INDEX_KEY]: [] });
  return all.length;
}

export async function upsertBrowseVisits(visits: Omit<BrowseVisit, 'id'>[]): Promise<number> {
  if (!visits.length) return 0;
  const all = await readAll();
  const byUrl = new Map<string, BrowseVisit>();
  for (const v of all) byUrl.set(normalizeUrl(v.url), v);

  let added = 0;
  for (const raw of visits) {
    const url = normalizeUrl(raw.url);
    if (!url || !/^https?:/i.test(url)) continue;
    const title = (raw.title || url).trim() || url;
    const existing = byUrl.get(url);
    if (existing) {
      byUrl.set(url, {
        ...existing,
        title: title || existing.title,
        visitedAt: Math.max(existing.visitedAt, raw.visitedAt),
        source: raw.source === 'history' ? 'history' : existing.source,
      });
    } else {
      byUrl.set(url, {
        id: uid('browse'),
        url,
        title,
        visitedAt: raw.visitedAt,
        source: raw.source,
      });
      added += 1;
    }
  }
  await writeAll(Array.from(byUrl.values()));
  return added;
}

export async function ingestTabActivityIntoBrowseIndex(sinceMs?: number): Promise<number> {
  const since = sinceMs ?? Date.now() - BROWSE_RETENTION_MS;
  const sessions = await listTabActivitySince(since);
  return upsertBrowseVisits(
    sessions.map((s) => ({
      url: s.url,
      title: s.title || s.domain,
      visitedAt: s.startedAt,
      source: 'tab' as const,
    })),
  );
}

export async function syncHistoryIntoBrowseIndex(
  opts: { maxResults?: number; startTime?: number } = {},
): Promise<{ synced: number; permitted: boolean }> {
  const permitted = await hasHistoryPermission();
  if (!permitted) return { synced: 0, permitted: false };
  const startTime = opts.startTime ?? Date.now() - BROWSE_RETENTION_MS;
  const maxResults = opts.maxResults ?? 500;
  try {
    if (!chrome.history?.search) {
      return { synced: 0, permitted: true };
    }
    const items = await chrome.history.search({
      text: '',
      startTime,
      maxResults,
    });
    const synced = await upsertBrowseVisits(
      (items ?? [])
        .filter((h) => h.url && /^https?:/i.test(h.url))
        .map((h) => ({
          url: h.url!,
          title: h.title || h.url!,
          visitedAt: h.lastVisitTime ?? Date.now(),
          source: 'history' as const,
        })),
    );
    return { synced, permitted: true };
  } catch {
    return { synced: 0, permitted: true };
  }
}

export async function refreshBrowseIndex(): Promise<{
  fromTabs: number;
  fromHistory: number;
  permitted: boolean;
}> {
  const fromTabs = await ingestTabActivityIntoBrowseIndex();
  const hist = await syncHistoryIntoBrowseIndex();
  return { fromTabs, fromHistory: hist.synced, permitted: hist.permitted };
}

export type BrowseSearchHit = BrowseVisit & { score: number };

export async function searchBrowseIndex(
  query: string,
  opts: { limit?: number; nowMs?: number } = {},
): Promise<BrowseSearchHit[]> {
  const limit = opts.limit ?? 8;
  const now = opts.nowMs ?? Date.now();
  await refreshBrowseIndex();
  const all = pruneExpired(await readAll(), now);
  const window = parseRelativeWindow(query, now);
  const candidates = window
    ? all.filter((v) => v.visitedAt >= window.start && v.visitedAt <= window.end)
    : all;
  const topic = extractBrowseSearchQuery(query) || query.trim();
  if (!topic) {
    return candidates
      .slice()
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .slice(0, limit)
      .map((v) => ({ ...v, score: 0 }));
  }
  return candidates
    .map((v) => {
      const hay = `${v.title} ${v.url}`;
      let score = keywordScore(hay, topic);
      if (v.title.toLowerCase().includes(topic.toLowerCase())) score += 40;
      return { ...v, score };
    })
    .filter((v) => v.score > 0)
    .sort((a, b) => b.score - a.score || b.visitedAt - a.visitedAt)
    .slice(0, limit);
}

export async function isBrowserMemoryAllowed(): Promise<boolean> {
  const settings = await getSettings();
  return Boolean(settings.memoryEnabled);
}

export function formatBrowseHit(hit: BrowseSearchHit, index: number): string {
  const when = new Date(hit.visitedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${index}. **${hit.title}**\n${hit.url}\n_Visited ${when}_`;
}
