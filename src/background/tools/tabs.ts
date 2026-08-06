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
      return { ok: true, data: { id: tab.id, url: tab.pendingUrl ?? url }, toolCall: call };
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
      return { ok: true, data: { id: tab?.id, url }, toolCall: call };
    }
    default:
      return { ok: false, error: `Unknown tab tool ${call.name}`, toolCall: call };
  }
}
