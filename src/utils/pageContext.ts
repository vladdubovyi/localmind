/**
 * Request page context from the active tab's content script.
 * Used by Milestone 2 features (Ask this page / Summarize).
 */
import type { PageContext } from '@/types';

export async function fetchActivePageContext(): Promise<PageContext | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return null;

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
    if (response?.type === 'PAGE_CONTEXT_RESULT') {
      return response.payload as PageContext;
    }
  } catch {
    return null;
  }
  return null;
}
