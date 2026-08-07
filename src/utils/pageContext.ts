/**
 * Request page context from the active tab.
 * Tries the content script first, then injects a one-shot extractor.
 */
import { extractPageContextInPage } from '@/content/extract';
import type { PageContext } from '@/types';

export class PageContextError extends Error {
  code: 'NO_TAB' | 'RESTRICTED' | 'FAILED' | 'EMPTY';

  constructor(
    message: string,
    code: 'NO_TAB' | 'RESTRICTED' | 'FAILED' | 'EMPTY',
  ) {
    super(message);
    this.name = 'PageContextError';
    this.code = code;
  }
}

function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('edge://') ||
    url.startsWith('about:') ||
    url.startsWith('https://chrome.google.com/webstore') ||
    url.startsWith('https://chromewebstore.google.com')
  );
}

export async function fetchActivePageContext(): Promise<PageContext> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new PageContextError('No active tab found.', 'NO_TAB');
  }

  if (isRestrictedUrl(tab.url)) {
    throw new PageContextError(
      'Phil cannot read this page (browser or store page). Open a normal website.',
      'RESTRICTED',
    );
  }

  // 1) Content script message
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
    if (response?.type === 'PAGE_CONTEXT_RESULT' && response.payload) {
      return assertNonEmpty(response.payload as PageContext);
    }
  } catch {
    // Content script may not be injected yet — fall through
  }

  // 2) One-shot injection via scripting API (activeTab / host access)
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractPageContextInPage,
    });
    const payload = results[0]?.result as PageContext | undefined;
    if (payload) return assertNonEmpty(payload);
  } catch (e) {
    throw new PageContextError(
      e instanceof Error
        ? `Could not read this page: ${e.message}`
        : 'Could not read this page.',
      'FAILED',
    );
  }

  throw new PageContextError('Could not extract page content.', 'FAILED');
}

function assertNonEmpty(page: PageContext): PageContext {
  if (!page.text || page.text.trim().length < 20) {
    throw new PageContextError(
      'This page has almost no readable text to analyze.',
      'EMPTY',
    );
  }
  return page;
}
