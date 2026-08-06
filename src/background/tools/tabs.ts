import type { ToolCall, ToolResult } from '@/agent/types';

function assertHttpUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed.');
  }
  return parsed.toString();
}

function waitForTabComplete(tabId: number, timeoutMs = 15000): Promise<void> {
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
    // Already complete?
    void chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === 'complete') finish();
    }).catch(() => finish());
    setTimeout(finish, timeoutMs);
  });
}

export async function executeTabTools(call: ToolCall): Promise<ToolResult> {
  switch (call.name) {
    case 'tabs_list': {
      const tabs = await chrome.tabs.query({});
      return {
        ok: true,
        data: tabs.map((t) => ({
          id: t.id,
          title: t.title,
          url: t.url,
          active: t.active,
          windowId: t.windowId,
        })),
        toolCall: call,
      };
    }
    case 'tabs_create': {
      const url = assertHttpUrl(String(call.arguments.url ?? ''));
      const active = call.arguments.active !== false;
      const tab = await chrome.tabs.create({ url, active });
      if (tab.id != null) {
        await waitForTabComplete(tab.id);
      }
      const refreshed = tab.id != null ? await chrome.tabs.get(tab.id) : tab;
      return {
        ok: true,
        data: {
          id: refreshed.id,
          url: refreshed.url ?? url,
          title: refreshed.title,
          hint: 'Next: page_read with this tab id, e.g. {"name":"page_read","arguments":{"tabId":ID}}',
        },
        toolCall: call,
      };
    }
    case 'tabs_activate': {
      const tabId = Number(call.arguments.tabId);
      if (!Number.isFinite(tabId)) throw new Error('tabId is required');
      const tab = await chrome.tabs.get(tabId);
      await chrome.tabs.update(tabId, { active: true });
      if (tab.windowId != null) {
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return { ok: true, data: { id: tabId }, toolCall: call };
    }
    case 'tabs_navigate': {
      const url = assertHttpUrl(String(call.arguments.url ?? ''));
      let tabId = call.arguments.tabId != null ? Number(call.arguments.tabId) : undefined;
      if (tabId == null) {
        const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = active?.id;
      }
      if (tabId == null) throw new Error('No tab to navigate');
      const tab = await chrome.tabs.update(tabId, { url });
      if (tab?.id != null) await waitForTabComplete(tab.id);
      return { ok: true, data: { id: tab?.id, url }, toolCall: call };
    }
    default:
      return { ok: false, error: `Unknown tab tool ${call.name}`, toolCall: call };
  }
}
