import type { AgentStep, ToolResult } from '@/agent/types';

/** Strip Gmail/HTML zero-width and tracking junk from snippets. */
export function cleanDisplayText(text: string, max = 160): string {
  const cleaned = text
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2060]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function formatGmailList(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) {
    return 'No emails found in the inbox view.';
  }
  return data
    .slice(0, 10)
    .map((item, i) => {
      const row = item as { from?: string; subject?: string; snippet?: string };
      const from = cleanDisplayText(String(row.from ?? 'Unknown'), 60);
      const subject = cleanDisplayText(String(row.subject ?? '(no subject)'), 100);
      const snippet = cleanDisplayText(String(row.snippet ?? ''), 100);
      // Skip snippets that are empty after stripping Gmail tracking junk
      const showSnippet = snippet.length > 2;
      return `${i + 1}. **${subject}**\n   From: ${from}${showSnippet ? `\n   ${snippet}` : ''}`;
    })
    .join('\n\n');
}

function formatPageRead(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Page read.';
  const page = data as { title?: string; url?: string; text?: string };
  const title = cleanDisplayText(String(page.title ?? 'Page'), 80);
  const url = String(page.url ?? '');
  const text = cleanDisplayText(String(page.text ?? ''), 280);
  return `Read **${title}**${url ? `\n${url}` : ''}${text ? `\n\n${text}` : ''}`;
}

/** Human-readable tool result for the chat transcript. */
export function formatToolResultContent(name: string, result: ToolResult): string {
  if (!result.ok) return result.error || 'Tool failed';
  if (name === 'gmail_list') return formatGmailList(result.data);
  if (name === 'page_read') return formatPageRead(result.data);
  if (name === 'tabs_create') {
    const d = result.data as { id?: number; url?: string; title?: string } | undefined;
    return `Opened tab${d?.id != null ? ` #${d.id}` : ''}${d?.title ? `: ${d.title}` : ''}${
      d?.url ? `\n${d.url}` : ''
    }`;
  }
  if (name === 'tabs_list') {
    const tabs = Array.isArray(result.data) ? result.data : [];
    return tabs
      .slice(0, 8)
      .map((t) => {
        const tab = t as { id?: number; title?: string; url?: string };
        return `• #${tab.id ?? '?'} ${cleanDisplayText(String(tab.title ?? tab.url ?? ''), 70)}`;
      })
      .join('\n');
  }
  // Compact JSON fallback
  try {
    return JSON.stringify(result.data ?? { ok: true }, null, 2).slice(0, 1200);
  } catch {
    return 'Done.';
  }
}

export function toolCallLabel(name: string, args: Record<string, unknown>): string {
  const def = name.replace(/_/g, ' ');
  if (name === 'gmail_list') return 'Checking Gmail…';
  if (name === 'page_read') return 'Reading page…';
  if (name === 'tabs_create') {
    const url = typeof args.url === 'string' ? args.url : '';
    return url ? `Opening ${url}…` : 'Opening tab…';
  }
  if (name === 'tabs_navigate') return 'Navigating…';
  return `Running ${def}…`;
}

export function isJsonLookingFinal(content: string): boolean {
  const t = content.trim();
  return (t.startsWith('{') || t.startsWith('[')) && t.includes('"');
}

export function stepTone(kind: AgentStep['kind']): string {
  switch (kind) {
    case 'user':
      return 'user';
    case 'final':
      return 'final';
    case 'error':
      return 'error';
    case 'confirm':
      return 'confirm';
    case 'tool_call':
    case 'tool_result':
      return 'tool';
    default:
      return 'thought';
  }
}
