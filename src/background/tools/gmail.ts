import type { AgentSettings, GmailDraft, ToolCall, ToolResult } from '@/agent/types';
import {
  gmailApiConfigured,
  gmailCreateDraft,
  gmailGetMessage,
  gmailListMessages,
  gmailSendMessage,
} from '@/agent/gmail/api';
import { gmailDomCompose, gmailDomList, gmailDomRead } from '@/content/gmailDom';

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
    // Give the inbox DOM a moment after "complete"
    await new Promise((r) => setTimeout(r, 1200));
  } else {
    await chrome.tabs.update(tab.id!, { active: true });
  }
  if (!tab.id) throw new Error('Could not open a Gmail tab');
  return tab;
}

async function sessionCall(
  action: 'list' | 'read' | 'compose',
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tab = await ensureGmailTab();
  const tabId = tab.id!;

  // Prefer content-script message bus
  try {
    const result = await chrome.tabs.sendMessage(tabId, {
      type: 'GMAIL_SESSION',
      action,
      query: args.query,
      id: args.id,
      draft: args.draft,
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

  // Fallback: inject DOM helpers directly (no OAuth / no content-script required)
  try {
    if (action === 'list') {
      const injected = await chrome.scripting.executeScript({
        target: { tabId },
        func: gmailDomList,
        args: [args.query != null ? String(args.query) : ''],
      });
      return { ok: true, data: injected[0]?.result ?? [] };
    }
    if (action === 'read') {
      const injected = await chrome.scripting.executeScript({
        target: { tabId },
        func: gmailDomRead,
        args: [String(args.id ?? '')],
      });
      return { ok: true, data: injected[0]?.result };
    }
    if (action === 'compose') {
      const draft = args.draft as GmailDraft;
      const injected = await chrome.scripting.executeScript({
        target: { tabId },
        func: gmailDomCompose,
        args: [draft],
      });
      const data = await injected[0]?.result;
      return { ok: true, data };
    }
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof Error
          ? e.message
          : 'Could not read Gmail. Open mail.google.com, sign in, and retry.',
    };
  }

  return { ok: false, error: 'Unknown Gmail session action' };
}

export async function executeGmailTools(
  call: ToolCall,
  settings: AgentSettings,
): Promise<ToolResult> {
  // OAuth API only when explicitly configured — otherwise always use the Gmail tab.
  const preferApi =
    (settings.gmailMode === 'api' || settings.gmailMode === 'auto') &&
    gmailApiConfigured(settings);

  if (preferApi) {
    try {
      switch (call.name) {
        case 'gmail_list': {
          const data = await gmailListMessages(
            settings,
            String(call.arguments.query ?? ''),
            Number(call.arguments.maxResults ?? 10),
          );
          return { ok: true, data, toolCall: call };
        }
        case 'gmail_read': {
          const id = String(call.arguments.id ?? '');
          const data = await gmailGetMessage(settings, id);
          return { ok: true, data, toolCall: call };
        }
        case 'gmail_draft': {
          const draft: GmailDraft = {
            to: String(call.arguments.to ?? ''),
            subject: String(call.arguments.subject ?? ''),
            body: String(call.arguments.body ?? ''),
          };
          const data = await gmailCreateDraft(settings, draft);
          return { ok: true, data, toolCall: call };
        }
        case 'gmail_send': {
          const draft: GmailDraft = {
            to: String(call.arguments.to ?? ''),
            subject: String(call.arguments.subject ?? ''),
            body: String(call.arguments.body ?? ''),
          };
          const data = await gmailSendMessage(settings, draft);
          return { ok: true, data, toolCall: call };
        }
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
    case 'gmail_list': {
      const result = await sessionCall('list', { query: call.arguments.query });
      const list = Array.isArray(result.data) ? result.data : [];
      const max = Number(call.arguments.maxResults ?? 10);
      return {
        ok: result.ok,
        data: list.slice(0, Number.isFinite(max) ? max : 10),
        error: result.error,
        toolCall: call,
      };
    }
    case 'gmail_read':
      return {
        ...(await sessionCall('read', { id: call.arguments.id })),
        toolCall: call,
      };
    case 'gmail_draft':
    case 'gmail_send': {
      const draft: GmailDraft = {
        to: String(call.arguments.to ?? ''),
        subject: String(call.arguments.subject ?? ''),
        body: String(call.arguments.body ?? ''),
      };
      const result = await sessionCall('compose', { draft });
      if (call.name === 'gmail_send') {
        return {
          ok: result.ok,
          data: {
            ...(typeof result.data === 'object' && result.data ? result.data : {}),
            note: 'Draft opened in Gmail. Click Send yourself — LocalMind will not auto-send in session mode.',
          },
          error: result.error,
          toolCall: call,
        };
      }
      return { ...result, toolCall: call };
    }
    default:
      return { ok: false, error: `Unknown gmail tool ${call.name}`, toolCall: call };
  }
}
