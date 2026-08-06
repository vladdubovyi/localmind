/**
 * Content script — page DOM extraction + selection floating menu.
 */
import { extractPageContextInPage } from '@/content/extract';
import {
  mountSelectionMenu,
  replaceSavedSelection,
} from '@/content/selectionMenu';
import type { PageContext, RuntimeMessage } from '@/types';

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

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
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
    const result = replaceSavedSelection(message.text);
    sendResponse(result);
    return false;
  }

  if (message?.type === 'GET_SELECTION') {
    const sel = window.getSelection()?.toString().replace(/\s+/g, ' ').trim() ?? '';
    sendResponse({ text: sel });
    return false;
  }

  return false;
});

export {};
