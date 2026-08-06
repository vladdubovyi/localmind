import type { AgentSettings, GmailDraft, ToolCall, ToolResult } from '@/agent/types';
import {
  gmailApiConfigured,
  gmailCreateDraft,
  gmailGetMessage,
  gmailListMessages,
  gmailSendMessage,
} from '@/agent/gmail/api';

async function findGmailTab(): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({
    url: ['https://mail.google.com/*', 'https://gmail.com/*'],
  });
  return tabs[0];
}

async function sessionCall(
  action: 'list' | 'read' | 'compose',
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const tab = await findGmailTab();
  if (!tab?.id) {
    // Open Gmail for the user
    const created = await chrome.tabs.create({
      url: 'https://mail.google.com/',
      active: true,
    });
    return {
      ok: false,
      error:
        'Opened Gmail. Sign in if needed, then retry the tool once the inbox is visible.',
      data: { tabId: created.id },
    };
  }

  await chrome.tabs.update(tab.id, { active: true });

  try {
    const result = await chrome.tabs.sendMessage(tab.id, {
      type: 'GMAIL_SESSION',
      action,
      query: args.query,
      id: args.id,
      draft: args.draft,
    });
    return {
      ok: Boolean(result?.ok),
      data: result?.data,
      error: result?.error,
    };
  } catch {
    return {
      ok: false,
      error:
        'Could not reach the Gmail tab content script. Refresh mail.google.com and retry.',
    };
  }
}

export async function executeGmailTools(
  call: ToolCall,
  settings: AgentSettings,
): Promise<ToolResult> {
  const preferApi =
    settings.gmailMode === 'api' ||
    (settings.gmailMode === 'auto' && gmailApiConfigured(settings));

  if (preferApi && gmailApiConfigured(settings)) {
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
      // Fall back to session mode on API failure when auto
      if (settings.gmailMode !== 'auto') {
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          toolCall: call,
        };
      }
    }
  }

  // Session / DOM mode
  switch (call.name) {
    case 'gmail_list':
      return {
        ...(await sessionCall('list', {
          query: call.arguments.query,
        })),
        toolCall: call,
      };
    case 'gmail_read':
      return {
        ...(await sessionCall('read', { id: call.arguments.id })),
        toolCall: call,
      };
    case 'gmail_draft':
    case 'gmail_send': {
      // DOM compose opens a draft; send still requires user to hit Send in Gmail
      // for safety in session mode (we never auto-click Send).
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
