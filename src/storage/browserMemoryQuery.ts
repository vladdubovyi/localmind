/**
 * Pure helpers for browser memory search (no chrome / IDB deps — unit-testable).
 */

export const BROWSE_RETENTION_MS = 14 * 24 * 60 * 60 * 1000;

export type BrowseVisitSource = 'history' | 'tab' | 'seed';

export type BrowseVisit = {
  id: string;
  url: string;
  title: string;
  visitedAt: number;
  source: BrowseVisitSource;
};

export function pruneExpired(entries: BrowseVisit[], now = Date.now()): BrowseVisit[] {
  const cutoff = now - BROWSE_RETENTION_MS;
  return entries.filter((e) => e.visitedAt >= cutoff);
}

/** Strip temporal / filler phrases so keyword scoring focuses on the topic. */
export function extractBrowseSearchQuery(utterance: string): string {
  return utterance
    .replace(/\b(find|show|open|search|look up|locate|get)\b/gi, ' ')
    .replace(
      /\b(that|the|an?|my|article|page|post|link|site|tab|thing|i (read|saw|visited|opened)|from|about)\b/gi,
      ' ',
    )
    .replace(
      /\b(last week|past week|a week ago|yesterday|today|last few days|past few days)\b/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseRelativeWindow(
  query: string,
  now = Date.now(),
): { start: number; end: number } | null {
  const q = query.toLowerCase();
  const day = 24 * 60 * 60 * 1000;
  if (/\blast week\b|\bpast week\b|\ba week ago\b/.test(q)) {
    return { start: now - 10 * day, end: now - 5 * day };
  }
  if (/\byesterday\b/.test(q)) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 1);
    return { start: start.getTime(), end: start.getTime() + day };
  }
  if (/\btoday\b/.test(q)) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start: start.getTime(), end: now };
  }
  if (/\blast few days\b|\bpast few days\b/.test(q)) {
    return { start: now - 4 * day, end: now };
  }
  return null;
}
