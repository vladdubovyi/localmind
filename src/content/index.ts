/**
 * Content script — page DOM extraction for Milestone 2+.
 * Milestone 1 ships a minimal extractor + message bridge.
 */
import type { PageContext, RuntimeMessage } from '@/types';

function cleanText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

function extractPageContext(): PageContext {
  const clone = document.body.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll(
      'script, style, noscript, svg, iframe, nav, footer, header, aside, [role="navigation"], [role="banner"], [aria-hidden="true"]',
    )
    .forEach((el) => el.remove());

  const headings = Array.from(clone.querySelectorAll('h1, h2, h3'))
    .map((el) => cleanText(el.textContent))
    .filter(Boolean)
    .slice(0, 40);

  const paragraphs = Array.from(clone.querySelectorAll('p'))
    .map((el) => cleanText(el.textContent))
    .filter((t) => t.length > 40)
    .slice(0, 60);

  const lists = Array.from(clone.querySelectorAll('ul, ol'))
    .map((el) => cleanText(el.textContent))
    .filter((t) => t.length > 20)
    .slice(0, 30);

  const tables = Array.from(clone.querySelectorAll('table'))
    .map((el) => cleanText(el.textContent))
    .filter(Boolean)
    .slice(0, 10);

  const text = [headings.join('\n'), paragraphs.join('\n\n'), lists.join('\n')]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 20000);

  return {
    url: location.href,
    title: document.title,
    headings,
    paragraphs,
    lists,
    tables,
    text,
  };
}

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  if (message?.type === 'GET_PAGE_CONTEXT') {
    try {
      sendResponse({ type: 'PAGE_CONTEXT_RESULT', payload: extractPageContext() });
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
  return false;
});

export {};
