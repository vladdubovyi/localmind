import { cleanDisplayText } from '@/agent/formatStep';
import type {
  AgentSettings,
  GmailDraft,
  GmailMessageSummary,
  ToolCall,
  ToolResult,
} from '@/agent/types';
import {
  gmailApiConfigured,
  gmailCreateDraft,
  gmailGetAttachments,
  gmailGetMessage,
  gmailGetThread,
  gmailListMessages,
  gmailModifyMessage,
  gmailSendMessage,
} from '@/agent/gmail/api';
import { gmailDomDispatch, type GmailDomAction } from '@/content/gmailDom';

function sanitizeGmailList(data: unknown): GmailMessageSummary[] {
  if (!Array.isArray(data)) return [];
  return data.map((item, i) => {
    const row = item as Partial<GmailMessageSummary>;
    return {
      id: String(row.id ?? `msg-${i}`),
      threadId: row.threadId,
      from: cleanDisplayText(String(row.from ?? ''), 80),
      subject: cleanDisplayText(String(row.subject ?? '(no subject)'), 120),
      snippet: cleanDisplayText(String(row.snippet ?? ''), 140),
      date: row.date,
      unread: row.unread,
      starred: row.starred,
    };
  });
}

async function findGmailTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({
    url: ['https://mail.google.com/*', 'https://gmail.com/*'],
  });
  return tabs.find((t) => t.id != null) ?? tabs[0];
}

function waitForTabComplete(tabId: number, timeoutMs = 20000): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(onUpdated);
      resolve();
    };
    const onUpdated = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === 'complete') finish();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    void chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === 'complete') finish();
      })
      .catch(() => finish());
    setTimeout(finish, timeoutMs);
  });
}

async function ensureGmailTab(): Promise<chrome.tabs.Tab> {
  let tab = await findGmailTab();
  if (!tab?.id) {
    tab = await chrome.tabs.create({
      url: 'https://mail.google.com/',
      active: true,
    });
    if (tab.id != null) await waitForTabComplete(tab.id);
    await new Promise((r) => setTimeout(r, 1200));
  } else {
    await chrome.tabs.update(tab.id!, { active: true });
  }
  if (!tab.id) throw new Error('Could not open a Gmail tab');
  return tab;
}

async function sessionCall(
  action: GmailDomAction,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tab = await ensureGmailTab();
  const tabId = tab.id!;

  try {
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'GMAIL_SESSION',
      action,
      query: args.query,
      id: args.id,
      draft: args.draft,
      body: args.body,
      label: args.label,
      maxResults: args.maxResults,
      limit: args.limit,
    });
    if (result) {
      return {
        ok: Boolean(result.ok),
        data: result.data,
        error: result.error,
      };
    }
  } catch {
    // fall through to executeScript
  }

  try {
    const injected = await chrome.scripting.executeScript({
      target: { tabId },
      func: gmailDomDispatch,
      args: [action, args],
    });
    const data = await injected[0]?.result;
    return { ok: true, data };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : 'Could not access Gmail. Open mail.google.com, sign in, and retry.',
    };
  }
}

function draftFromArgs(call: ToolCall): GmailDraft {
  return {
    to: String(call.arguments.to ?? ''),
    subject: String(call.arguments.subject ?? ''),
    body: String(call.arguments.body ?? ''),
  };
}

async function sessionList(call: ToolCall): Promise<ToolResult> {
  const max = Number(call.arguments.maxResults ?? 10);
  const limit = Number.isFinite(max) && max > 0 ? Math.min(25, Math.floor(max)) : 10;
  const result = await sessionCall('list', {
    query: call.arguments.query,
    maxResults: limit,
  });
  return {
    ok: result.ok,
    data: sanitizeGmailList(result.data).slice(0, limit),
    error: result.error,
    toolCall: call,
  };
}

export async function executeGmailTools(
  call: ToolCall,
  settings: AgentSettings,
): Promise<ToolResult> {
  const preferApi =
    (settings.gmailMode === 'api' || settings.gmailMode === 'auto') &&
    gmailApiConfigured(settings);

  if (preferApi) {
    try {
      switch (call.name) {
        case 'gmail_list':
        case 'gmail_search': {
          const data = await gmailListMessages(
            settings,
            String(call.arguments.query ?? ''),
            Number(call.arguments.maxResults ?? 10),
          );
          return { ok: true, data: sanitizeGmailList(data), toolCall: call };
        }
        case 'gmail_read': {
          const data = await gmailGetMessage(settings, String(call.arguments.id ?? ''));
          return { ok: true, data, toolCall: call };
        }
        case 'gmail_thread': {
          const data = await gmailGetThread(settings, String(call.arguments.id ?? ''));
          return { ok: true, data, toolCall: call };
        }
        case 'gmail_get_attachments': {
          const data = await gmailGetAttachments(settings, String(call.arguments.id ?? ''));
          return { ok: true, data, toolCall: call };
        }
        case 'gmail_draft': {
          const draft = draftFromArgs(call);
          const data = await gmailCreateDraft(settings, draft);
          return { ok: true, data: { ...data, ...draft }, toolCall: call };
        }
        case 'gmail_send': {
          const draft = draftFromArgs(call);
          const data = await gmailSendMessage(settings, draft);
          return { ok: true, data, toolCall: call };
        }
        case 'gmail_archive': {
          await gmailModifyMessage(settings, String(call.arguments.id ?? ''), {
            removeLabelIds: ['INBOX'],
          });
          return { ok: true, data: { action: 'archive' }, toolCall: call };
        }
        case 'gmail_trash': {
          await gmailModifyMessage(settings, String(call.arguments.id ?? ''), {
            addLabelIds: ['TRASH'],
            removeLabelIds: ['INBOX'],
          });
          return { ok: true, data: { action: 'trash' }, toolCall: call };
        }
        case 'gmail_spam': {
          await gmailModifyMessage(settings, String(call.arguments.id ?? ''), {
            addLabelIds: ['SPAM'],
            removeLabelIds: ['INBOX'],
          });
          return { ok: true, data: { action: 'spam' }, toolCall: call };
        }
        case 'gmail_star': {
          await gmailModifyMessage(settings, String(call.arguments.id ?? ''), {
            addLabelIds: ['STARRED'],
          });
          return { ok: true, data: { action: 'star' }, toolCall: call };
        }
        case 'gmail_mark_read': {
          await gmailModifyMessage(settings, String(call.arguments.id ?? ''), {
            removeLabelIds: ['UNREAD'],
          });
          return { ok: true, data: { action: 'mark_read' }, toolCall: call };
        }
        case 'gmail_mark_unread': {
          await gmailModifyMessage(settings, String(call.arguments.id ?? ''), {
            addLabelIds: ['UNREAD'],
          });
          return { ok: true, data: { action: 'mark_unread' }, toolCall: call };
        }
        case 'gmail_label': {
          // Custom labels need label id lookup — fall through to session for named labels
          break;
        }
        case 'gmail_reply':
        case 'gmail_reply_all':
        case 'gmail_forward':
        case 'gmail_extract_links':
          // Prefer session UI for these
          break;
        default:
          break;
      }
    } catch (e) {
      if (settings.gmailMode === 'api') {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          toolCall: call,
        };
      }
      // auto → fall through to session
    }
  }

  switch (call.name) {
    case 'gmail_list':
    case 'gmail_search':
      return sessionList(call);
    case 'gmail_read':
      return { ...(await sessionCall('read', { id: call.arguments.id })), toolCall: call };
    case 'gmail_thread':
      return { ...(await sessionCall('thread', { id: call.arguments.id })), toolCall: call };
    case 'gmail_extract_links':
      return {
        ...(await sessionCall('extract_links', {
          id: call.arguments.id,
          limit: call.arguments.limit,
        })),
        toolCall: call,
      };
    case 'gmail_get_attachments':
      return {
        ...(await sessionCall('attachments', { id: call.arguments.id })),
        toolCall: call,
      };
    case 'gmail_reply':
      return {
        ...(await sessionCall('reply', { id: call.arguments.id, body: call.arguments.body })),
        toolCall: call,
      };
    case 'gmail_reply_all':
      return {
        ...(await sessionCall('reply_all', {
          id: call.arguments.id,
          body: call.arguments.body,
        })),
        toolCall: call,
      };
    case 'gmail_forward':
      return {
        ...(await sessionCall('forward', { id: call.arguments.id, body: call.arguments.body })),
        toolCall: call,
      };
    case 'gmail_archive':
      return {
        ...(await sessionCall('archive', { id: call.arguments.id })),
        toolCall: call,
      };
    case 'gmail_trash':
      return { ...(await sessionCall('trash', { id: call.arguments.id })), toolCall: call };
    case 'gmail_spam':
      return { ...(await sessionCall('spam', { id: call.arguments.id })), toolCall: call };
    case 'gmail_label':
      return {
        ...(await sessionCall('label', {
          id: call.arguments.id,
          label: call.arguments.label,
        })),
        toolCall: call,
      };
    case 'gmail_star':
      return { ...(await sessionCall('star', { id: call.arguments.id })), toolCall: call };
    case 'gmail_mark_read':
      return {
        ...(await sessionCall('mark_read', { id: call.arguments.id })),
        toolCall: call,
      };
    case 'gmail_mark_unread':
      return {
        ...(await sessionCall('mark_unread', { id: call.arguments.id })),
        toolCall: call,
      };
    case 'gmail_draft':
    case 'gmail_send': {
      const draft = draftFromArgs(call);
      if (!draft.body.trim()) {
        return {
          ok: false,
          error: 'Draft body is empty. Provide the reply text in the body argument.',
          toolCall: call,
        };
      }
      const result = await sessionCall('compose', { draft });
      return {
        ok: result.ok,
        data: {
          ...(typeof result.data === 'object' && result.data ? result.data : {}),
          to: draft.to,
          subject: draft.subject,
          bodyPreview: draft.body.slice(0, 240),
          note:
            call.name === 'gmail_send'
              ? 'Draft opened in Gmail. Click Send yourself — LocalMind will not auto-send in session mode.'
              : 'Compose draft opened in your Gmail tab. Review and click Send yourself if you want to send it.',
        },
        error: result.error,
        toolCall: call,
      };
    }
    default:
      return { ok: false, error: `Unknown gmail tool ${call.name}`, toolCall: call };
  }
}
