/**
 * Gmail REST API via OAuth (chrome.identity.launchWebAuthFlow).
 * Requires a Google Cloud OAuth client ID stored in agent settings.
 * Tokens stay on-device; LocalMind does not proxy mail through a server.
 */
import type { AgentSettings, GmailDraft, GmailMessageSummary } from '@/agent/types';

const TOKEN_KEY = 'gmailOAuthToken';

interface StoredToken {
  accessToken: string;
  expiresAt: number;
  clientId: string;
}

export function gmailApiConfigured(settings: AgentSettings): boolean {
  return Boolean(settings.gmailClientId?.trim());
}

function getRedirectUrl(): string {
  return chrome.identity.getRedirectURL('oauth2');
}

async function getStoredToken(clientId: string): Promise<StoredToken | null> {
  const data = await chrome.storage.local.get(TOKEN_KEY);
  const token = data[TOKEN_KEY] as StoredToken | undefined;
  if (!token || token.clientId !== clientId) return null;
  if (Date.now() > token.expiresAt - 60_000) return null;
  return token;
}

async function storeToken(token: StoredToken): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_KEY]: token });
}

export async function clearGmailToken(): Promise<void> {
  await chrome.storage.local.remove(TOKEN_KEY);
}

async function fetchAccessToken(settings: AgentSettings, interactive: boolean): Promise<string> {
  const clientId = settings.gmailClientId.trim();
  if (!clientId) throw new Error('Set a Google OAuth client ID in Agent settings.');

  const cached = await getStoredToken(clientId);
  if (cached) return cached.accessToken;

  if (!interactive) {
    throw new Error('Gmail OAuth token missing. Connect Gmail from Agent settings.');
  }

  const redirectUri = getRedirectUrl();
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify',
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('prompt', 'consent');

  const responseUrl = await chrome.identity.launchWebAuthFlow({
    url: authUrl.toString(),
    interactive: true,
  });

  if (!responseUrl) throw new Error('Gmail OAuth was cancelled.');

  const hash = new URL(responseUrl).hash.replace(/^#/, '');
  const params = new URLSearchParams(hash);
  const accessToken = params.get('access_token');
  const expiresIn = Number(params.get('expires_in') ?? 3600);
  if (!accessToken) throw new Error('No access token returned from Google.');

  await storeToken({
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
    clientId,
  });
  return accessToken;
}

async function gmailFetch(
  settings: AgentSettings,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await fetchAccessToken(settings, true);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gmail API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}

function header(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  return headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
}

export async function gmailListMessages(
  settings: AgentSettings,
  query: string,
  maxResults = 10,
): Promise<GmailMessageSummary[]> {
  const q = encodeURIComponent(query || 'in:inbox');
  const list = await gmailFetch(
    settings,
    `users/me/messages?maxResults=${Math.min(maxResults, 25)}&q=${q}`,
  );
  const json = (await list.json()) as { messages?: Array<{ id: string }> };
  const ids = json.messages ?? [];
  const out: GmailMessageSummary[] = [];

  for (const m of ids.slice(0, maxResults)) {
    const detail = await gmailFetch(
      settings,
      `users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    );
    const msg = (await detail.json()) as {
      id: string;
      threadId?: string;
      snippet?: string;
      payload?: { headers?: Array<{ name: string; value: string }> };
    };
    out.push({
      id: msg.id,
      threadId: msg.threadId,
      from: header(msg.payload?.headers, 'From'),
      subject: header(msg.payload?.headers, 'Subject'),
      snippet: msg.snippet ?? '',
      date: header(msg.payload?.headers, 'Date'),
    });
  }
  return out;
}

export async function gmailGetMessage(
  settings: AgentSettings,
  id: string,
): Promise<{ id: string; from: string; subject: string; date: string; body: string }> {
  const detail = await gmailFetch(settings, `users/me/messages/${id}?format=full`);
  const msg = (await detail.json()) as {
    id: string;
    snippet?: string;
    payload?: {
      headers?: Array<{ name: string; value: string }>;
      body?: { data?: string };
      parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: unknown[] }>;
    };
  };

  const decode = (data?: string) => {
    if (!data) return '';
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
    try {
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(b64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
    } catch {
      try {
        return atob(b64);
      } catch {
        return '';
      }
    }
  };

  let body = decode(msg.payload?.body?.data);
  if (!body && msg.payload?.parts) {
    const textPart = msg.payload.parts.find((p) => p.mimeType === 'text/plain');
    body = decode(textPart?.body?.data) || msg.snippet || '';
  }

  return {
    id: msg.id,
    from: header(msg.payload?.headers, 'From'),
    subject: header(msg.payload?.headers, 'Subject'),
    date: header(msg.payload?.headers, 'Date'),
    body: body.slice(0, 12000),
  };
}

function toRawEmail(draft: GmailDraft): string {
  const lines = [
    `To: ${draft.to}`,
    `Subject: ${draft.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    draft.body,
  ];
  const raw = lines.join('\r\n');
  // base64url
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function gmailCreateDraft(
  settings: AgentSettings,
  draft: GmailDraft,
): Promise<{ id: string }> {
  const res = await gmailFetch(settings, 'users/me/drafts', {
    method: 'POST',
    body: JSON.stringify({ message: { raw: toRawEmail(draft) } }),
  });
  const json = (await res.json()) as { id?: string };
  return { id: json.id ?? '' };
}

export async function gmailSendMessage(
  settings: AgentSettings,
  draft: GmailDraft,
): Promise<{ id: string }> {
  const res = await gmailFetch(settings, 'users/me/messages/send', {
    method: 'POST',
    body: JSON.stringify({ raw: toRawEmail(draft) }),
  });
  const json = (await res.json()) as { id?: string };
  return { id: json.id ?? '' };
}

export async function gmailModifyMessage(
  settings: AgentSettings,
  id: string,
  body: { addLabelIds?: string[]; removeLabelIds?: string[] },
): Promise<void> {
  await gmailFetch(settings, `users/me/messages/${id}/modify`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function gmailGetThread(
  settings: AgentSettings,
  id: string,
): Promise<{ id: string; subject: string; messages: Array<{ id: string; from: string; body: string }> }> {
  // Try as thread id first; if the caller passed a message id, resolve threadId.
  let threadId = id;
  try {
    const msg = await gmailGetMessage(settings, id);
    // gmailGetMessage doesn't return threadId — fetch metadata
    const detail = await gmailFetch(settings, `users/me/messages/${id}?format=minimal`);
    const json = (await detail.json()) as { threadId?: string };
    if (json.threadId) threadId = json.threadId;
    void msg;
  } catch {
    // assume id is already a thread id
  }

  const res = await gmailFetch(settings, `users/me/threads/${threadId}?format=full`);
  const json = (await res.json()) as {
    id: string;
    messages?: Array<{
      id: string;
      snippet?: string;
      payload?: {
        headers?: Array<{ name: string; value: string }>;
        body?: { data?: string };
        parts?: Array<{ mimeType?: string; body?: { data?: string } }>;
      };
    }>;
  };

  const decode = (data?: string) => {
    if (!data) return '';
    const b64 = data.replace(/-/g, '+').replace(/_/g, '/');
    try {
      return decodeURIComponent(
        Array.prototype.map
          .call(atob(b64), (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
    } catch {
      try {
        return atob(b64);
      } catch {
        return '';
      }
    }
  };

  const messages = (json.messages ?? []).slice(0, 20).map((m) => {
    let body = decode(m.payload?.body?.data);
    if (!body && m.payload?.parts) {
      const textPart = m.payload.parts.find((p) => p.mimeType === 'text/plain');
      body = decode(textPart?.body?.data) || m.snippet || '';
    }
    return {
      id: m.id,
      from: header(m.payload?.headers, 'From'),
      body: body.slice(0, 4000),
    };
  });

  const subject =
    header(json.messages?.[0]?.payload?.headers, 'Subject') ||
    messages[0]?.body.slice(0, 40) ||
    '';

  return { id: json.id, subject, messages };
}

export async function gmailGetAttachments(
  settings: AgentSettings,
  id: string,
): Promise<{ attachments: Array<{ name: string; mimeType?: string; size?: number; attachmentId?: string }> }> {
  const detail = await gmailFetch(settings, `users/me/messages/${id}?format=full`);
  const msg = (await detail.json()) as {
    payload?: {
      filename?: string;
      mimeType?: string;
      body?: { size?: number; attachmentId?: string };
      parts?: Array<{
        filename?: string;
        mimeType?: string;
        body?: { size?: number; attachmentId?: string };
        parts?: unknown[];
      }>;
    };
  };

  const attachments: Array<{
    name: string;
    mimeType?: string;
    size?: number;
    attachmentId?: string;
  }> = [];

  const walk = (
    parts?: Array<{
      filename?: string;
      mimeType?: string;
      body?: { size?: number; attachmentId?: string };
      parts?: unknown[];
    }>,
  ) => {
    if (!parts) return;
    for (const p of parts) {
      if (p.filename && p.body?.attachmentId) {
        attachments.push({
          name: p.filename,
          mimeType: p.mimeType,
          size: p.body.size,
          attachmentId: p.body.attachmentId,
        });
      }
      if (Array.isArray(p.parts)) {
        walk(
          p.parts as Array<{
            filename?: string;
            mimeType?: string;
            body?: { size?: number; attachmentId?: string };
            parts?: unknown[];
          }>,
        );
      }
    }
  };
  walk(msg.payload?.parts);
  if (msg.payload?.filename && msg.payload.body?.attachmentId) {
    attachments.push({
      name: msg.payload.filename,
      mimeType: msg.payload.mimeType,
      size: msg.payload.body.size,
      attachmentId: msg.payload.body.attachmentId,
    });
  }
  return { attachments };
}

export async function connectGmail(settings: AgentSettings): Promise<void> {
  await fetchAccessToken(settings, true);
}
