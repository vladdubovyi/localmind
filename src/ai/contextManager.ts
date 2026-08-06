/**
 * Page context pipeline:
 * DOM → clean → extract → chunk → (keyword) retrieve → LLM
 *
 * Milestone 2 uses lightweight keyword retrieval.
 * Milestone 4 will swap in local embeddings.
 */
import type { PageContext } from '@/types';

export interface TextChunk {
  id: string;
  text: string;
  source: 'heading' | 'paragraph' | 'list' | 'table' | 'body';
}

const MAX_CONTEXT_CHARS = 12_000;

export function chunkPageContext(page: PageContext): TextChunk[] {
  const chunks: TextChunk[] = [];
  let i = 0;

  const push = (text: string, source: TextChunk['source']) => {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (cleaned.length < 20) return;
    // Split long blocks
    if (cleaned.length <= 900) {
      chunks.push({ id: `c${i++}`, text: cleaned, source });
      return;
    }
    for (let start = 0; start < cleaned.length; start += 800) {
      chunks.push({
        id: `c${i++}`,
        text: cleaned.slice(start, start + 900),
        source,
      });
    }
  };

  for (const h of page.headings) push(h, 'heading');
  for (const p of page.paragraphs) push(p, 'paragraph');
  for (const l of page.lists) push(l, 'list');
  for (const t of page.tables) push(t, 'table');

  if (chunks.length === 0 && page.text) {
    push(page.text, 'body');
  }

  return chunks;
}

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

/** Score chunks by token overlap with the query. */
export function retrieveRelevantChunks(
  chunks: TextChunk[],
  query: string,
  limit = 8,
): TextChunk[] {
  if (!chunks.length) return [];
  if (!query.trim()) {
    return chunks.slice(0, limit);
  }

  const q = tokenize(query);
  const scored = chunks.map((chunk) => {
    const tokens = tokenize(chunk.text);
    let overlap = 0;
    for (const t of q) {
      if (tokens.has(t)) overlap += 1;
    }
    // Prefer paragraphs slightly for answerability
    const sourceBoost =
      chunk.source === 'paragraph' ? 0.15 : chunk.source === 'heading' ? 0.1 : 0;
    const score = overlap / Math.max(1, q.size) + sourceBoost;
    return { chunk, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // If nothing overlaps, fall back to leading chunks (page intro)
  if (scored[0]?.score === 0) {
    return chunks.slice(0, limit);
  }

  return scored.slice(0, limit).map((s) => s.chunk);
}

/** Build a budgeted context string for the LLM. */
export function buildPageContextBlock(
  page: PageContext,
  query?: string,
): { context: string; usedChunks: number; totalChunks: number } {
  const chunks = chunkPageContext(page);
  const selected = retrieveRelevantChunks(chunks, query ?? '', 10);

  const header = [
    `Page title: ${page.title}`,
    `URL: ${page.url}`,
    '',
  ].join('\n');

  let body = '';
  let used = 0;
  for (const chunk of selected) {
    const next = `[${chunk.source}] ${chunk.text}\n\n`;
    if (header.length + body.length + next.length > MAX_CONTEXT_CHARS) break;
    body += next;
    used += 1;
  }

  // Absolute fallback
  if (!body) {
    body = page.text.slice(0, MAX_CONTEXT_CHARS - header.length);
    used = 1;
  }

  return {
    context: header + body.trim(),
    usedChunks: used,
    totalChunks: chunks.length,
  };
}

export function formatPageStats(page: PageContext): string {
  const chars = page.text.length;
  const kb = (chars / 1000).toFixed(chars >= 1000 ? 1 : 0);
  return `${page.headings.length} headings · ${page.paragraphs.length} paragraphs · ~${kb}k chars`;
}
