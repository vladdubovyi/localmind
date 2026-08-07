/**
 * Content script — page extraction, selection menu, agent page/gmail actions.
 */
import { extractPageContextInPage } from '@/content/extract';
import {
  hideAgentBanner,
  pageClick,
  pageFill,
  pageQuery,
  pageType,
  showAgentBanner,
} from '@/content/pageActions';
import { gmailDomDispatch } from '@/content/gmailDom';
import {
  mountSelectionMenu,
  replaceSavedSelection,
} from '@/content/selectionMenu';
import { mountPhilFab } from '@/content/philFab';
import { mountFocusHeartbeat } from '@/content/focusHeartbeat';
import type { AgentRuntimeMessage } from '@/agent/types';
import type { PageContext, RuntimeMessage } from '@/types';

mountPhilFab();
mountFocusHeartbeat();

mountSelectionMenu((action, text) => {
  void chrome.runtime.sendMessage({
    type: 'SELECTION_ACTION',
    action,
    text,
    url: location.href,
    title: document.title,
    canReplace: true,
  } satisfies RuntimeMessage);
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage | AgentRuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'GET_PAGE_CONTEXT') {
    try {
      sendResponse({
        type: 'PAGE_CONTEXT_RESULT',
        payload: extractPageContextInPage(),
      });
    } catch {
      sendResponse({
        type: 'PAGE_CONTEXT_RESULT',
        payload: {
          url: location.href,
          title: document.title,
          headings: [],
          paragraphs: [],
          lists: [],
          tables: [],
          text: '',
        } satisfies PageContext,
      });
    }
    return false;
  }

  if (message?.type === 'PING') {
    sendResponse({ ok: true });
    return false;
  }

  if (message?.type === 'REPLACE_SELECTION') {
    sendResponse(replaceSavedSelection(message.text));
    return false;
  }

  if (message?.type === 'GET_SELECTION') {
    const sel = window.getSelection()?.toString().replace(/\s+/g, ' ').trim() ?? '';
    sendResponse({ text: sel });
    return false;
  }

  if (message?.type === 'PAGE_ACTION') {
    try {
      if (message.action === 'banner') {
        if (message.showBanner === false) hideAgentBanner();
        else showAgentBanner(message.message ?? 'Phil Agent is controlling this tab');
        sendResponse({ ok: true });
        return false;
      }
      if (message.action === 'query') {
        const data = pageQuery(String(message.selector ?? ''), Number((message as { limit?: number }).limit ?? 10));
        sendResponse({ ok: true, data });
        return false;
      }
      if (message.action === 'click') {
        sendResponse({ ok: true, data: pageClick(String(message.selector ?? '')) });
        return false;
      }
      if (message.action === 'type') {
        sendResponse({
          ok: true,
          data: pageType(
            String(message.selector ?? ''),
            String(message.text ?? ''),
            (message as { clear?: boolean }).clear !== false,
          ),
        });
        return false;
      }
      if (message.action === 'fill') {
        const fields = (message as { fields?: Record<string, string> }).fields ?? {};
        sendResponse({ ok: true, data: pageFill(fields) });
        return false;
      }
      sendResponse({ ok: false, error: `Unknown page action ${message.action}` });
    } catch (e) {
      sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
    return false;
  }

  if (message?.type === 'GMAIL_SESSION') {
    (async () => {
      try {
        const data = await gmailDomDispatch(message.action as import('@/content/gmailDom').GmailDomAction, {
          query: message.query,
          id: message.id,
          draft: message.draft,
          body: message.body,
          label: message.label,
          maxResults: message.maxResults,
          limit: message.limit,
        });
        sendResponse({ ok: true, data });
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return true;
  }

  return false;
});

export {};
