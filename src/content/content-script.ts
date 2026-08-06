/**
 * Content script — page DOM extraction for Ask this page / Summarize.
 */
import { extractPageContextInPage } from '@/content/extract';
import type { PageContext, RuntimeMessage } from '@/types';

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

  return false;
});

export {};
