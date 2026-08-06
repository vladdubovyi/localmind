/**
 * Best-effort Gmail DOM helpers for session mode (user already logged in).
 * Fragile by nature — API mode is preferred when OAuth is configured.
 */
import type { GmailDraft, GmailMessageSummary } from '@/agent/types';

function isGmail(): boolean {
  return location.hostname.includes('mail.google.com');
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

export function gmailDomList(query?: string): GmailMessageSummary[] {
  if (!isGmail()) throw new Error('Not on Gmail');

  // Optional: apply search
  if (query) {
    const input =
      document.querySelector<HTMLInputElement>('input[aria-label="Search mail"]') ||
      document.querySelector<HTMLInputElement>('input[name="q"]');
    if (input) {
      input.focus();
      input.value = query;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const form = input.closest('form');
      form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  }

  const rows = Array.from(
    document.querySelectorAll('tr.zA, div[role="main"] tr.zA'),
  ).slice(0, 15);

  return rows.map((row, i) => {
    const subject =
      row.querySelector('.bog')?.textContent?.trim() ||
      row.querySelector('span[data-thread-id]')?.textContent?.trim() ||
      '';
    const from =
      row.querySelector('.yP, .zF')?.getAttribute('email') ||
      row.querySelector('.yP, .zF')?.textContent?.trim() ||
      '';
    const snippet = cleanSnippet(row.querySelector('.y2')?.textContent || '');
    const id =
      row.getAttribute('data-legacy-message-id') ||
      row.querySelector('[data-legacy-message-id]')?.getAttribute('data-legacy-message-id') ||
      `dom-${i}-${subject.slice(0, 24)}`;

    return { id, from, subject, snippet };
  });
}

export function gmailDomRead(id: string): { id: string; body: string; subject: string } {
  if (!isGmail()) throw new Error('Not on Gmail');

  // Try open by clicking matching row (id, or subject fragment from dom-* ids)
  const rows = Array.from(document.querySelectorAll('tr.zA'));
  const needle = id.replace(/^dom-\d+-?/i, '').trim().toLowerCase();
  const match =
    rows.find((row) => {
      const rid =
        row.getAttribute('data-legacy-message-id') ||
        row.querySelector('[data-legacy-message-id]')?.getAttribute('data-legacy-message-id');
      return rid === id || (rid != null && row.textContent?.includes(id));
    }) ||
    (needle
      ? rows.find((row) => {
          const subject =
            row.querySelector('.bog')?.textContent?.trim().toLowerCase() ||
            row.textContent?.trim().toLowerCase() ||
            '';
          return subject.includes(needle) || needle.includes(subject.slice(0, 24));
        })
      : undefined);
  match?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

  const subject =
    document.querySelector('h2.hP')?.textContent?.trim() ||
    document.querySelector('[data-thread-perm-id]')?.textContent?.trim() ||
    '';
  const body =
    Array.from(document.querySelectorAll('.a3s.aiL, .a3s'))
      .map((n) => (n as HTMLElement).innerText)
      .join('\n\n')
      .trim() || document.body.innerText.slice(0, 8000);

  return { id, subject, body: body.slice(0, 12000) };
}

export async function gmailDomCompose(
  draft: GmailDraft,
): Promise<{ opened: boolean; filled: { to: boolean; subject: boolean; body: boolean } }> {
  if (!isGmail()) throw new Error('Not on Gmail');

  const filled = { to: false, subject: false, body: false };

  // Prefer Reply if a message is open (better To/Subject), else Compose
  const replyBtn =
    document.querySelector<HTMLElement>('div[role="button"][aria-label^="Reply"]') ||
    document.querySelector<HTMLElement>('div[data-tooltip="Reply"]') ||
    Array.from(document.querySelectorAll<HTMLElement>('div[role="button"]')).find((b) =>
      /^reply$/i.test((b.getAttribute('aria-label') || b.textContent || '').trim()),
    );

  const composeBtn =
    document.querySelector<HTMLElement>('div[gh="cm"]') ||
    document.querySelector<HTMLElement>('div[role="button"][aria-label*="Compose"]') ||
    Array.from(document.querySelectorAll<HTMLElement>('div[role="button"]')).find((b) =>
      /compose/i.test(b.getAttribute('aria-label') || b.textContent || ''),
    );

  const useReply = Boolean(replyBtn && document.querySelector('h2.hP, .a3s'));
  const opener = useReply ? replyBtn : composeBtn;
  if (!opener) {
    throw new Error('Could not find Gmail Compose/Reply. Open mail.google.com and try again.');
  }

  opener.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
  await new Promise((r) => setTimeout(r, 900));

  const findTo = () =>
    document.querySelector<HTMLElement>('textarea[name="to"]') ||
    document.querySelector<HTMLElement>('input[name="to"]') ||
    document.querySelector<HTMLElement>('div[aria-label="To recipients"]') ||
    document.querySelector<HTMLElement>('div[aria-label^="To"][role="textbox"]') ||
    document.querySelector<HTMLElement>('[peoplekit-id]') ||
    document.querySelector<HTMLElement>('div[aria-label*="To"]');

  const findSubject = () =>
    document.querySelector<HTMLInputElement>('input[name="subjectbox"]') ||
    document.querySelector<HTMLInputElement>('input[aria-label*="Subject"]');

  const findBody = () =>
    document.querySelector<HTMLElement>('div[aria-label*="Message Body"]') ||
    document.querySelector<HTMLElement>('div[role="textbox"][aria-label*="Body"]') ||
    document.querySelector<HTMLElement>('div[contenteditable="true"][aria-label*="Body"]') ||
    document.querySelector<HTMLElement>('div[g_editable="true"]');

  // Wait briefly for the compose window
  for (let i = 0; i < 8; i++) {
    if (findBody() || findSubject() || findTo()) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  const insertText = (el: HTMLElement, text: string) => {
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
  };

  const toEl = findTo();
  if (toEl && draft.to && !useReply) {
    insertText(toEl, draft.to);
    toEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    filled.to = true;
  } else if (useReply) {
    filled.to = true;
  }

  const subjectEl = findSubject();
  if (subjectEl && draft.subject && !useReply) {
    insertText(subjectEl, draft.subject);
    filled.subject = true;
  } else if (useReply || (subjectEl && subjectEl.value)) {
    filled.subject = true;
  }

  const bodyEl = findBody();
  if (bodyEl && draft.body) {
    insertText(bodyEl, draft.body);
    filled.body = true;
  }

  if (!filled.body) {
    throw new Error(
      'Opened Gmail compose but could not fill the message body. Click Compose manually and retry.',
    );
  }

  return { opened: true, filled };
}
