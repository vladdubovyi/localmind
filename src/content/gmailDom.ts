/**
 * Best-effort Gmail DOM helpers for session mode (user already logged in).
 * Fragile by nature — API mode is preferred when OAuth is configured.
 */
import type { GmailDraft, GmailMessageSummary } from '@/agent/types';

export type GmailDomAction =
  | 'list'
  | 'read'
  | 'compose'
  | 'reply'
  | 'reply_all'
  | 'forward'
  | 'thread'
  | 'archive'
  | 'trash'
  | 'spam'
  | 'label'
  | 'star'
  | 'mark_read'
  | 'mark_unread'
  | 'extract_links'
  | 'attachments';

function isGmail(): boolean {
  return location.hostname.includes('mail.google.com');
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Strip Gmail zero-width / tracking junk so snippets are readable. */
function cleanSnippet(text: string, max = 140): string {
  const cleaned = text
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2060]/g, '')
    .replace(/[\u200E\u200F\u202A-\u202E]/g, '')
    .replace(/^[\s\-–—·•]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

function click(el: Element | null | undefined): boolean {
  if (!el) return false;
  (el as HTMLElement).dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, view: window }),
  );
  return true;
}

function findToolbarButton(patterns: RegExp[]): HTMLElement | undefined {
  const buttons = Array.from(
    document.querySelectorAll<HTMLElement>(
      'div[role="button"], button, div[data-tooltip], span[data-tooltip]',
    ),
  );
  for (const pat of patterns) {
    const hit = buttons.find((b) => {
      const label = `${b.getAttribute('aria-label') || ''} ${b.getAttribute('data-tooltip') || ''} ${b.textContent || ''}`;
      return pat.test(label);
    });
    if (hit) return hit;
  }
  return undefined;
}

function rowId(row: Element, index: number, subject: string): string {
  return (
    row.getAttribute('data-legacy-message-id') ||
    row.querySelector('[data-legacy-message-id]')?.getAttribute('data-legacy-message-id') ||
    row.getAttribute('data-message-id') ||
    row.querySelector('[data-message-id]')?.getAttribute('data-message-id') ||
    `dom-${index}-${subject.slice(0, 24)}`
  );
}

function rowThreadId(row: Element): string | undefined {
  return (
    row.getAttribute('data-legacy-thread-id') ||
    row.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id') ||
    row.getAttribute('data-thread-id') ||
    row.querySelector('[data-thread-id]')?.getAttribute('data-thread-id') ||
    undefined
  );
}

function parseRow(row: Element, index: number): GmailMessageSummary {
  const subject =
    row.querySelector('.bog')?.textContent?.trim() ||
    row.querySelector('span[data-thread-id]')?.textContent?.trim() ||
    '';
  const from =
    row.querySelector('.yP, .zF')?.getAttribute('email') ||
    row.querySelector('.yP, .zF')?.textContent?.trim() ||
    '';
  const snippet = cleanSnippet(row.querySelector('.y2')?.textContent || '');
  const unread = row.classList.contains('zE') || row.querySelector('.zE') != null;
  const starred = Boolean(
    row.querySelector('[aria-label*="Starred"], [aria-label*="Starred"]') ||
      row.querySelector('.T-KT.T-KT-Jp'),
  );
  return {
    id: rowId(row, index, subject),
    threadId: rowThreadId(row),
    from,
    subject,
    snippet,
    unread,
    starred,
  };
}

function listRows(): Element[] {
  return Array.from(document.querySelectorAll('tr.zA, div[role="main"] tr.zA'));
}

async function applySearch(query: string): Promise<void> {
  const input =
    document.querySelector<HTMLInputElement>('input[aria-label="Search mail"]') ||
    document.querySelector<HTMLInputElement>('input[name="q"]');
  if (!input) return;

  const before = listRows()
    .slice(0, 3)
    .map((r) => r.getAttribute('data-legacy-message-id') || r.textContent?.slice(0, 40))
    .join('|');

  input.focus();
  input.value = query;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const form = input.closest('form');
  form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  // Enter key as fallback
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

  for (let i = 0; i < 12; i++) {
    await sleep(250);
    const after = listRows()
      .slice(0, 3)
      .map((r) => r.getAttribute('data-legacy-message-id') || r.textContent?.slice(0, 40))
      .join('|');
    if (after && after !== before) return;
    if (location.hash.includes('search') || location.hash.includes('#')) {
      // hash changed; give rows a moment
      if (i > 3) return;
    }
  }
}

function findRowById(id: string): Element | undefined {
  const rows = listRows();
  const needle = id.replace(/^dom-\d+-?/i, '').trim().toLowerCase();
  return (
    rows.find((row) => {
      const rid = rowId(row, 0, '');
      const tid = rowThreadId(row);
      return rid === id || tid === id || (rid && row.textContent?.includes(id));
    }) ||
    (needle
      ? rows.find((row) => {
          const subject =
            row.querySelector('.bog')?.textContent?.trim().toLowerCase() ||
            row.textContent?.trim().toLowerCase() ||
            '';
          return subject.includes(needle) || needle.includes(subject.slice(0, 24));
        })
      : undefined)
  );
}

async function openMessage(id: string): Promise<void> {
  const match = findRowById(id);
  if (match) {
    click(match);
    await sleep(700);
  }
}

function insertText(el: HTMLElement, text: string): void {
  el.focus();
  try {
    document.execCommand('selectAll', false);
  } catch {
    // ignore
  }
  const ok = document.execCommand('insertText', false, text);
  if (!ok) {
    if ('value' in el) {
      (el as HTMLInputElement).value = text;
    } else {
      el.textContent = text;
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function findComposeBody(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('div[aria-label*="Message Body"]') ||
    document.querySelector<HTMLElement>('div[role="textbox"][aria-label*="Body"]') ||
    document.querySelector<HTMLElement>('div[contenteditable="true"][aria-label*="Body"]') ||
    document.querySelector<HTMLElement>('div[g_editable="true"]')
  );
}

export async function gmailDomList(
  query?: string,
  maxResults = 15,
): Promise<GmailMessageSummary[]> {
  if (!isGmail()) throw new Error('Not on Gmail');
  if (query?.trim()) await applySearch(query.trim());
  return listRows()
    .slice(0, Math.min(25, Math.max(1, maxResults)))
    .map((row, i) => parseRow(row, i));
}

export async function gmailDomRead(
  id: string,
): Promise<{ id: string; threadId?: string; body: string; subject: string; from?: string }> {
  if (!isGmail()) throw new Error('Not on Gmail');
  await openMessage(id);

  const subject =
    document.querySelector('h2.hP')?.textContent?.trim() ||
    document.querySelector('[data-thread-perm-id]')?.textContent?.trim() ||
    '';
  const from =
    document.querySelector('.gD')?.getAttribute('email') ||
    document.querySelector('.gD')?.textContent?.trim() ||
    '';
  const threadId =
    document.querySelector('[data-legacy-thread-id]')?.getAttribute('data-legacy-thread-id') ||
    document.querySelector('[data-thread-perm-id]')?.getAttribute('data-thread-perm-id') ||
    undefined;
  const body =
    Array.from(document.querySelectorAll('.a3s.aiL, .a3s'))
      .map((n) => (n as HTMLElement).innerText)
      .join('\n\n')
      .trim() || document.body.innerText.slice(0, 8000);

  return { id, threadId, from, subject, body: body.slice(0, 12000) };
}

export async function gmailDomCompose(
  draft: GmailDraft,
): Promise<{ opened: boolean; filled: { to: boolean; subject: boolean; body: boolean } }> {
  if (!isGmail()) throw new Error('Not on Gmail');
  const filled = { to: false, subject: false, body: false };

  const composeBtn =
    document.querySelector<HTMLElement>('div[gh="cm"]') ||
    document.querySelector<HTMLElement>('div[role="button"][aria-label*="Compose"]') ||
    findToolbarButton([/^compose$/i, /compose/i]);
  if (!composeBtn) throw new Error('Could not find Gmail Compose.');
  click(composeBtn);
  await sleep(900);

  for (let i = 0; i < 8; i++) {
    if (findComposeBody()) break;
    await sleep(200);
  }

  const to =
    document.querySelector<HTMLElement>('textarea[name="to"]') ||
    document.querySelector<HTMLElement>('input[name="to"]') ||
    document.querySelector<HTMLElement>('div[aria-label^="To"][role="textbox"]') ||
    document.querySelector<HTMLElement>('[peoplekit-id]') ||
    document.querySelector<HTMLElement>('div[aria-label*="To"]');
  const subject = document.querySelector<HTMLInputElement>('input[name="subjectbox"]');
  const body = findComposeBody();

  if (to && draft.to) {
    insertText(to, draft.to);
    filled.to = true;
  }
  if (subject && draft.subject) {
    insertText(subject, draft.subject);
    filled.subject = true;
  }
  if (body && draft.body) {
    insertText(body, draft.body);
    filled.body = true;
  }
  if (!filled.body) {
    throw new Error('Opened Compose but could not fill the body.');
  }
  return { opened: true, filled };
}

async function openReplyForward(
  id: string | undefined,
  mode: 'reply' | 'reply_all' | 'forward',
  body?: string,
): Promise<{ opened: boolean; mode: string }> {
  if (!isGmail()) throw new Error('Not on Gmail');
  if (id) await openMessage(id);

  const patterns =
    mode === 'reply'
      ? [/^Reply$/i, /^Reply\b/i]
      : mode === 'reply_all'
        ? [/^Reply all$/i, /Reply to all/i]
        : [/^Forward$/i, /\bForward\b/i];

  const btn = findToolbarButton(patterns);
  if (!btn) throw new Error(`Could not find Gmail ${mode} button. Open the message and retry.`);
  click(btn);
  await sleep(800);

  const bodyEl = findComposeBody();
  if (body && bodyEl) insertText(bodyEl, body);
  if (!bodyEl) throw new Error(`Opened ${mode} but compose body was not found.`);
  return { opened: true, mode };
}

export async function gmailDomThread(id: string): Promise<{
  id: string;
  subject: string;
  messages: Array<{ from: string; body: string }>;
}> {
  if (!isGmail()) throw new Error('Not on Gmail');
  await openMessage(id);
  const subject = document.querySelector('h2.hP')?.textContent?.trim() || '';
  const blocks = Array.from(document.querySelectorAll('.adn, .h7, div[data-message-id]'));
  const messages: Array<{ from: string; body: string }> = [];

  const pushFrom = (root: Element) => {
    const from =
      root.querySelector('.gD')?.getAttribute('email') ||
      root.querySelector('.gD')?.textContent?.trim() ||
      '';
    const body = cleanSnippet(
      (root.querySelector('.a3s') as HTMLElement | null)?.innerText || '',
      2000,
    );
    if (body) messages.push({ from, body });
  };

  if (blocks.length) {
    for (const b of blocks.slice(0, 20)) pushFrom(b);
  } else {
    for (const el of Array.from(document.querySelectorAll('.a3s.aiL, .a3s')).slice(0, 10)) {
      messages.push({
        from: '',
        body: cleanSnippet((el as HTMLElement).innerText || '', 2000),
      });
    }
  }

  return { id, subject, messages };
}

async function selectOrOpen(id?: string): Promise<void> {
  if (!id) return;
  const row = findRowById(id);
  if (row) {
    // Checkbox select when available (keeps list view for archive/trash)
    const checkbox =
      row.querySelector<HTMLElement>('div[role="checkbox"]') ||
      row.querySelector<HTMLElement>('span[aria-label*="Select"]');
    if (checkbox) {
      click(checkbox);
      await sleep(200);
      return;
    }
    await openMessage(id);
  }
}

async function triage(
  action: 'archive' | 'trash' | 'spam' | 'star' | 'mark_read' | 'mark_unread',
  id?: string,
): Promise<{ ok: true; action: string }> {
  if (!isGmail()) throw new Error('Not on Gmail');
  await selectOrOpen(id);

  const map: Record<string, RegExp[]> = {
    archive: [/^Archive$/i, /\bArchive\b/i],
    trash: [/^Delete$/i, /\bDelete\b/i, /\bTrash\b/i],
    spam: [/^Report spam$/i, /\bSpam\b/i],
    star: [/^Star$/i, /^Not starred$/i, /\bStar\b/i],
    mark_read: [/^Mark as read$/i, /\bMark as read\b/i],
    mark_unread: [/^Mark as unread$/i, /\bMark as unread\b/i],
  };

  const btn = findToolbarButton(map[action]);
  if (!btn) {
    // Star often lives on the row
    if (action === 'star' && id) {
      const row = findRowById(id);
      const star = row?.querySelector<HTMLElement>('[aria-label*="Star"]');
      if (star && click(star)) return { ok: true, action };
    }
    throw new Error(`Could not find Gmail control for ${action}.`);
  }
  click(btn);
  await sleep(400);
  return { ok: true, action };
}

async function applyLabel(label: string, id?: string): Promise<{ ok: true; label: string }> {
  if (!isGmail()) throw new Error('Not on Gmail');
  await selectOrOpen(id);
  const labelBtn = findToolbarButton([/^Labels$/i, /\bLabel as\b/i, /^Move to\b/i]);
  if (!labelBtn) throw new Error('Could not find Labels control.');
  click(labelBtn);
  await sleep(400);

  const input =
    document.querySelector<HTMLInputElement>('input[aria-label*="Label"]') ||
    document.querySelector<HTMLInputElement>('input[type="text"]');
  if (input) {
    insertText(input, label);
    await sleep(300);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  } else {
    const option = Array.from(document.querySelectorAll<HTMLElement>('div[role="menuitemcheckbox"], div[role="option"], span')).find(
      (el) => (el.textContent || '').trim().toLowerCase() === label.toLowerCase(),
    );
    if (!option) throw new Error(`Label "${label}" not found in menu.`);
    click(option);
  }
  await sleep(300);
  return { ok: true, label };
}

export function gmailDomExtractLinks(limit = 20): {
  links: Array<{ text: string; href: string }>;
} {
  if (!isGmail()) throw new Error('Not on Gmail');
  const roots = document.querySelectorAll('.a3s a[href], .ii a[href]');
  const links: Array<{ text: string; href: string }> = [];
  const seen = new Set<string>();
  for (const a of Array.from(roots)) {
    const href = (a as HTMLAnchorElement).href || a.getAttribute('href') || '';
    if (!href || href.startsWith('mailto:') || seen.has(href)) continue;
    if (/mail\.google\.com/i.test(href) && /#/.test(href)) continue;
    seen.add(href);
    links.push({
      text: cleanSnippet(a.textContent || href, 80),
      href,
    });
    if (links.length >= limit) break;
  }
  return { links };
}

export function gmailDomAttachments(): {
  attachments: Array<{ name: string; url?: string }>;
} {
  if (!isGmail()) throw new Error('Not on Gmail');
  const nodes = Array.from(
    document.querySelectorAll(
      'span.aV3, div.aQH span, a[download], div[data-tooltip*="Download"], span[data-tooltip]',
    ),
  );
  const attachments: Array<{ name: string; url?: string }> = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    const name =
      n.getAttribute('download') ||
      n.getAttribute('data-tooltip') ||
      n.textContent?.trim() ||
      '';
    if (!name || name.length < 3) continue;
    if (!/\.[a-z0-9]{2,5}\b/i.test(name) && !/download/i.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const url = (n as HTMLAnchorElement).href || n.closest('a')?.href;
    attachments.push({ name: cleanSnippet(name, 120), url });
    if (attachments.length >= 20) break;
  }
  return { attachments };
}

/** Unified dispatcher for content-script / executeScript. */
export async function gmailDomDispatch(
  action: GmailDomAction,
  args: Record<string, unknown> = {},
): Promise<unknown> {
  switch (action) {
    case 'list':
      return gmailDomList(
        args.query != null ? String(args.query) : undefined,
        Number(args.maxResults ?? 15),
      );
    case 'read':
      return gmailDomRead(String(args.id ?? ''));
    case 'compose':
      return gmailDomCompose(args.draft as GmailDraft);
    case 'reply':
      return openReplyForward(
        args.id != null ? String(args.id) : undefined,
        'reply',
        args.body != null ? String(args.body) : undefined,
      );
    case 'reply_all':
      return openReplyForward(
        args.id != null ? String(args.id) : undefined,
        'reply_all',
        args.body != null ? String(args.body) : undefined,
      );
    case 'forward':
      return openReplyForward(
        args.id != null ? String(args.id) : undefined,
        'forward',
        args.body != null ? String(args.body) : undefined,
      );
    case 'thread':
      return gmailDomThread(String(args.id ?? ''));
    case 'archive':
      return triage('archive', args.id != null ? String(args.id) : undefined);
    case 'trash':
      return triage('trash', args.id != null ? String(args.id) : undefined);
    case 'spam':
      return triage('spam', args.id != null ? String(args.id) : undefined);
    case 'star':
      return triage('star', args.id != null ? String(args.id) : undefined);
    case 'mark_read':
      return triage('mark_read', args.id != null ? String(args.id) : undefined);
    case 'mark_unread':
      return triage('mark_unread', args.id != null ? String(args.id) : undefined);
    case 'label':
      return applyLabel(String(args.label ?? ''), args.id != null ? String(args.id) : undefined);
    case 'extract_links': {
      if (args.id) await openMessage(String(args.id));
      return gmailDomExtractLinks(Number(args.limit ?? 20));
    }
    case 'attachments': {
      if (args.id) await openMessage(String(args.id));
      return gmailDomAttachments();
    }
    default:
      throw new Error(`Unknown Gmail DOM action: ${action}`);
  }
}
