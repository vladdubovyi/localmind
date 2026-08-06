import type { ToolCall, ToolResult } from '@/agent/types';
import { extractPageContextInPage } from '@/content/extract';

async function resolveTabId(tabIdArg: unknown): Promise<number> {
  if (tabIdArg != null && Number.isFinite(Number(tabIdArg))) {
    const requested = Number(tabIdArg);
    try {
      const tab = await chrome.tabs.get(requested);
      if (tab?.id != null) return tab.id;
    } catch {
      // Model-invented IDs are common; fall back to the active tab.
    }
  }
  const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (active?.id != null) return active.id;
  const [anyActive] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!anyActive?.id) throw new Error('No active tab');
  return anyActive.id;
}

async function ensureContentScript(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch {
    // Fallback: inject extraction/actions via executeScript when CS isn't ready
  }
}

export async function executePageTools(call: ToolCall): Promise<ToolResult> {
  const tabId = await resolveTabId(call.arguments.tabId);

  switch (call.name) {
    case 'page_read': {
      await ensureContentScript(tabId);
      try {
        const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_PAGE_CONTEXT' });
        if (response?.type === 'PAGE_CONTEXT_RESULT') {
          const page = response.payload;
          return {
            ok: true,
            data: {
              url: page.url,
              title: page.title,
              text: String(page.text ?? '').slice(0, 12000),
              headings: page.headings?.slice(0, 20),
            },
            toolCall: call,
          };
        }
      } catch {
        // fall through to executeScript
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: extractPageContextInPage,
      });
      const page = results[0]?.result;
      if (!page) throw new Error('Could not read page');
      return {
        ok: true,
        data: {
          url: page.url,
          title: page.title,
          text: String(page.text ?? '').slice(0, 12000),
          headings: page.headings?.slice(0, 20),
        },
        toolCall: call,
      };
    }

    case 'page_query':
    case 'page_click':
    case 'page_type':
    case 'page_fill': {
      await ensureContentScript(tabId);
      // Show agent banner while acting
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'PAGE_ACTION',
          action: 'banner',
          showBanner: true,
          message: `LocalMind Agent: ${call.name}`,
        });
      } catch {
        // ignore
      }

      const action =
        call.name === 'page_query'
          ? 'query'
          : call.name === 'page_click'
            ? 'click'
            : call.name === 'page_type'
              ? 'type'
              : 'fill';

      try {
        const result = await chrome.tabs.sendMessage(tabId, {
          type: 'PAGE_ACTION',
          action,
          selector: call.arguments.selector as string | undefined,
          text: call.arguments.text as string | undefined,
          fields: call.arguments.fields as Record<string, string> | undefined,
          clear: call.arguments.clear as boolean | undefined,
          limit: call.arguments.limit as number | undefined,
        });
        return {
          ok: Boolean(result?.ok),
          data: result?.data,
          error: result?.error,
          toolCall: call,
        };
      } catch (e) {
        // Inject page actions module functions inline as fallback
        if (call.name === 'page_click') {
          const selector = String(call.arguments.selector ?? '');
          const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: (sel: string) => {
              const el = document.querySelector(sel) as HTMLElement | null;
              if (!el) return { ok: false, error: `No element for ${sel}` };
              el.click();
              return { ok: true, data: { selector: sel } };
            },
            args: [selector],
          });
          return { ...(result as ToolResult), toolCall: call };
        }
        throw e;
      }
    }

    default:
      return { ok: false, error: `Unknown page tool ${call.name}`, toolCall: call };
  }
}
