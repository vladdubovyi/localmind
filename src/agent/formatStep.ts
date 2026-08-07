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
      const row = item as {
        id?: string;
        threadId?: string;
        from?: string;
        subject?: string;
        snippet?: string;
        unread?: boolean;
        starred?: boolean;
      };
      const id = String(row.id ?? '');
      const from = cleanDisplayText(String(row.from ?? 'Unknown'), 60);
      const subject = cleanDisplayText(String(row.subject ?? '(no subject)'), 100);
      const snippet = cleanDisplayText(String(row.snippet ?? ''), 100);
      const flags = [
        row.unread ? 'unread' : null,
        row.starred ? 'starred' : null,
      ]
        .filter(Boolean)
        .join(', ');
      const showSnippet = snippet.length > 2;
      return `${i + 1}. **${subject}**${flags ? ` (${flags})` : ''}\n   From: ${from}${
        id ? `\n   id: ${id}` : ''
      }${row.threadId ? `\n   thread: ${row.threadId}` : ''}${
        showSnippet ? `\n   ${snippet}` : ''
      }`;
    })
    .join('\n\n');
}

function formatGmailRead(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Email read.';
  const msg = data as { id?: string; subject?: string; body?: string; from?: string };
  const subject = cleanDisplayText(String(msg.subject ?? '(no subject)'), 120);
  const body = cleanDisplayText(String(msg.body ?? ''), 1200);
  return `**${subject}**${msg.from ? `\nFrom: ${cleanDisplayText(String(msg.from), 80)}` : ''}${
    body ? `\n\n${body}` : '\n\n(No body text found — open the message in Gmail and retry.)'
  }`;
}

function formatGmailThread(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Thread read.';
  const thread = data as {
    subject?: string;
    messages?: Array<{ from?: string; body?: string }>;
  };
  const subject = cleanDisplayText(String(thread.subject ?? 'Thread'), 120);
  const msgs = (thread.messages ?? []).slice(0, 8);
  if (!msgs.length) return `**${subject}**\n(No messages found in thread.)`;
  return [
    `**${subject}** (${msgs.length} messages)`,
    ...msgs.map((m, i) => {
      const from = cleanDisplayText(String(m.from ?? ''), 60);
      const body = cleanDisplayText(String(m.body ?? ''), 400);
      return `${i + 1}. ${from || 'Unknown'}\n${body}`;
    }),
  ].join('\n\n');
}

function formatLinks(data: unknown): string {
  const links = (data as { links?: Array<{ text?: string; href?: string }> })?.links ?? [];
  if (!links.length) return 'No links found in this message.';
  return links
    .slice(0, 15)
    .map((l, i) => `${i + 1}. ${cleanDisplayText(String(l.text || l.href || ''), 60)}\n   ${l.href}`)
    .join('\n');
}

function formatAttachments(data: unknown): string {
  const items =
    (data as { attachments?: Array<{ name?: string; url?: string; mimeType?: string }> })
      ?.attachments ?? [];
  if (!items.length) return 'No attachments found.';
  return items
    .map((a, i) => `${i + 1}. ${cleanDisplayText(String(a.name ?? 'file'), 80)}${a.mimeType ? ` (${a.mimeType})` : ''}`)
    .join('\n');
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
  if (name === 'gmail_list' || name === 'gmail_search') return formatGmailList(result.data);
  if (name === 'gmail_read') return formatGmailRead(result.data);
  if (name === 'gmail_thread') return formatGmailThread(result.data);
  if (name === 'gmail_extract_links') return formatLinks(result.data);
  if (name === 'gmail_get_attachments') return formatAttachments(result.data);
  if (
    name === 'gmail_draft' ||
    name === 'gmail_send' ||
    name === 'gmail_reply' ||
    name === 'gmail_reply_all' ||
    name === 'gmail_forward'
  ) {
    const d = result.data as
      | { to?: string; subject?: string; bodyPreview?: string; note?: string; mode?: string; opened?: boolean }
      | undefined;
    const title =
      name === 'gmail_reply' || name === 'gmail_reply_all'
        ? 'Reply draft opened in Gmail.'
        : name === 'gmail_forward'
          ? 'Forward draft opened in Gmail.'
          : name === 'gmail_send'
            ? 'Send draft opened in Gmail.'
            : 'Compose draft opened in Gmail.';
    return [
      title,
      d?.mode ? `Mode: ${d.mode}` : null,
      d?.to ? `To: ${cleanDisplayText(String(d.to), 80)}` : null,
      d?.subject ? `Subject: ${cleanDisplayText(String(d.subject), 100)}` : null,
      d?.bodyPreview ? `\n${cleanDisplayText(String(d.bodyPreview), 280)}` : null,
      d?.note ? `\n${d.note}` : '\nReview in Gmail and click Send yourself if needed.',
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (
    name === 'gmail_archive' ||
    name === 'gmail_trash' ||
    name === 'gmail_spam' ||
    name === 'gmail_star' ||
    name === 'gmail_mark_read' ||
    name === 'gmail_mark_unread' ||
    name === 'gmail_label'
  ) {
    const d = result.data as { action?: string; label?: string } | undefined;
    if (name === 'gmail_label') return `Applied label “${d?.label ?? 'label'}”.`;
    return `Done: ${(d?.action || name.replace('gmail_', '')).replace(/_/g, ' ')}.`;
  }
  if (name === 'page_read') return formatPageRead(result.data);
  if (name === 'focus_summary' || name === 'focus_get_today') {
    const d = result.data as
      | {
          totalMs?: number;
          byCategory?: Record<string, number>;
          byDomain?: Array<{ domain: string; ms: number; category: string }>;
        }
      | undefined;
    if (!d) return 'Focus summary ready.';
    const mins = (ms: number) => Math.round((ms ?? 0) / 60_000);
    const top = d.byDomain?.[0];
    return [
      `Today’s focus: ${mins(d.totalMs ?? 0)}m tracked`,
      `Productive ${mins(d.byCategory?.productive ?? 0)}m · Leisure ${mins(d.byCategory?.leisure ?? 0)}m`,
      top ? `Top site: ${top.domain} (${mins(top.ms)}m, ${top.category})` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (name === 'reminder_create') {
    const d = result.data as { text?: string; when?: number; id?: string } | undefined;
    return `Reminder set${d?.text ? `: ${d.text}` : ''}${
      d?.when ? ` at ${new Date(d.when).toLocaleString()}` : ''
    }${d?.id ? ` (${d.id})` : ''}`;
  }
  if (name === 'reminder_list') {
    const list = Array.isArray(result.data) ? result.data : [];
    if (!list.length) return 'No reminders.';
    return list
      .slice(0, 8)
      .map((r) => {
        const row = r as { text?: string; when?: number; status?: string };
        return `• ${row.text ?? 'Reminder'} — ${
          row.when ? new Date(row.when).toLocaleString() : '?'
        } (${row.status ?? ''})`;
      })
      .join('\n');
  }
  if (name === 'goal_create' || name === 'goal_complete' || name === 'goal_update') {
    const d = result.data as { title?: string; status?: string; id?: string } | undefined;
    return `Goal ${d?.status ?? 'updated'}: ${d?.title ?? d?.id ?? 'ok'}`;
  }
  if (name === 'goal_list') {
    const list = Array.isArray(result.data) ? result.data : [];
    if (!list.length) return 'No goals yet.';
    return list
      .slice(0, 10)
      .map((g) => {
        const row = g as { title?: string; status?: string };
        return `• ${row.title ?? 'Goal'} (${row.status ?? ''})`;
      })
      .join('\n');
  }
  if (name === 'briefing_today') {
    const d = result.data as { content?: string } | undefined;
    return d?.content ?? 'Briefing ready.';
  }
  if (name === 'web_research') {
    const d = result.data as
      | {
          query?: string;
          note?: string;
          answer?: string;
          findings?: Array<{ url?: string; tabId?: number; domain?: string }>;
        }
      | undefined;
    const findings = d?.findings ?? [];
    if (d?.answer?.trim()) {
      return d.answer.trim();
    }
    return [
      `Research: ${d?.query ?? ''}`,
      d?.note,
      ...findings
        .slice(0, 5)
        .map((f, i) => `${i + 1}. ${f.domain ?? f.url ?? ''}${f.tabId != null ? ` (tab #${f.tabId})` : ''}`),
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (name === 'phil_settings_get' || name === 'phil_settings_update') {
    return 'Phil settings updated.';
  }
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
  try {
    return JSON.stringify(result.data ?? { ok: true }, null, 2).slice(0, 1200);
  } catch {
    return 'Done.';
  }
}

export function toolCallLabel(name: string, args: Record<string, unknown>): string {
  const def = name.replace(/_/g, ' ');
  const labels: Record<string, string> = {
    gmail_list: 'Checking Gmail…',
    gmail_search: 'Searching Gmail…',
    gmail_read: 'Reading email…',
    gmail_thread: 'Reading thread…',
    gmail_draft: 'Opening Gmail draft…',
    gmail_send: 'Opening Gmail send draft…',
    gmail_reply: 'Opening reply…',
    gmail_reply_all: 'Opening reply all…',
    gmail_forward: 'Opening forward…',
    gmail_archive: 'Archiving…',
    gmail_trash: 'Moving to Trash…',
    gmail_spam: 'Reporting spam…',
    gmail_label: 'Applying label…',
    gmail_star: 'Starring…',
    gmail_mark_read: 'Marking read…',
    gmail_mark_unread: 'Marking unread…',
    gmail_extract_links: 'Extracting links…',
    gmail_get_attachments: 'Listing attachments…',
    page_read: 'Reading page…',
    focus_summary: 'Checking focus…',
    focus_get_today: 'Checking focus…',
    reminder_create: 'Setting reminder…',
    reminder_list: 'Listing reminders…',
    reminder_cancel: 'Cancelling reminder…',
    goal_create: 'Creating goal…',
    goal_list: 'Listing goals…',
    goal_complete: 'Completing goal…',
    briefing_today: 'Composing briefing…',
    web_research: 'Researching the web…',
    phil_settings_get: 'Reading Phil settings…',
    phil_settings_update: 'Updating Phil settings…',
  };
  if (labels[name]) return labels[name];
  if (name === 'tabs_create') {
    const url = typeof args.url === 'string' ? args.url : '';
    return url ? `Opening ${url}…` : 'Opening tab…';
  }
  if (name === 'tabs_navigate') {
    const url = typeof args.url === 'string' ? args.url : '';
    return url ? `Navigating to ${url}…` : 'Navigating…';
  }
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
