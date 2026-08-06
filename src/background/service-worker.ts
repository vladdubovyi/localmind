/**
 * Background service worker (Manifest V3).
 * Coordinates side panel, context menus, selection handoff, and agent tools.
 * Inference runs in extension pages (popup/side panel) via WebGPU — not here.
 */
import type { AgentRuntimeMessage } from '@/agent/types';
import {
  getAgentPermissionState,
  requestAgentPermissions,
} from '@/agent/permissions';
import { routeAgentTool } from '@/background/tools/router';
import { getAgentSettings } from '@/storage/agentSettings';
import type { PendingSelectionAction, SelectionAction } from '@/types';

const SELECTION_MENU_ACTIONS = [
  { id: 'explain', title: 'Explain selection' },
  { id: 'summarize', title: 'Summarize selection' },
  { id: 'rewrite', title: 'Rewrite selection' },
  { id: 'translate', title: 'Translate selection' },
  { id: 'eli5', title: "Explain like I'm 5" },
  { id: 'improve', title: 'Improve writing' },
] as const satisfies ReadonlyArray<{ id: SelectionAction; title: string }>;

async function openSidePanelForSender(
  sender: chrome.runtime.MessageSender,
): Promise<void> {
  const windowId = sender.tab?.windowId;
  if (windowId != null) {
    await chrome.sidePanel.open({ windowId });
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.windowId != null) {
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
}

async function setPendingAction(action: PendingSelectionAction): Promise<void> {
  await chrome.storage.session.set({ pendingSelectionAction: action });
}

chrome.runtime.onInstalled.addListener(() => {
  // Primary UI is the side panel — keep setup, model, chat, and agent in one place.
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    // older Chrome builds may not support setPanelBehavior
  });

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'localmind-open',
      title: 'Ask LocalMind',
      contexts: ['page', 'selection'],
    });

    for (const action of SELECTION_MENU_ACTIONS) {
      chrome.contextMenus.create({
        id: `localmind-${action.id}`,
        parentId: 'localmind-open',
        title: action.title,
        contexts: ['selection'],
      });
    }
  });
});

chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

// Also apply on SW wake so upgrades pick up the behavior without reinstall.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.windowId) return;

  await chrome.sidePanel.open({ windowId: tab.windowId });

  if (info.menuItemId === 'localmind-open') {
    if (info.selectionText?.trim()) {
      await setPendingAction({
        action: 'explain',
        text: info.selectionText.trim(),
        url: tab.url,
        title: tab.title,
        tabId: tab.id,
        canReplace: false,
        createdAt: Date.now(),
      });
    }
    return;
  }

  const action = String(info.menuItemId).replace(
    'localmind-',
    '',
  ) as SelectionAction;
  const text = (info.selectionText ?? '').trim();
  if (!text) return;

  const canReplace = action === 'rewrite' || action === 'translate' || action === 'improve';

  await setPendingAction({
    action,
    text,
    url: tab.url,
    title: tab.title,
    tabId: tab.id,
    canReplace,
    createdAt: Date.now(),
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_SIDE_PANEL') {
    openSidePanelForSender(sender)
      .then(() => sendResponse({ ok: true }))
      .catch((err: unknown) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }

  if (message?.type === 'SELECTION_ACTION') {
    (async () => {
      await openSidePanelForSender(sender);
      const action = message.action as SelectionAction;
      const text = String(message.text ?? '').trim();
      if (!text) {
        sendResponse({ ok: false, error: 'Empty selection' });
        return;
      }
      await setPendingAction({
        action,
        text,
        url: message.url ?? sender.tab?.url,
        title: message.title ?? sender.tab?.title,
        tabId: sender.tab?.id,
        canReplace: Boolean(message.canReplace),
        createdAt: Date.now(),
      });
      sendResponse({ ok: true });
    })().catch((err: unknown) => {
      sendResponse({ ok: false, error: String(err) });
    });
    return true;
  }

  if (message?.type === 'REPLACE_SELECTION_IN_TAB') {
    (async () => {
      const tabId = message.tabId as number | undefined;
      const text = String(message.text ?? '');
      if (tabId == null) {
        sendResponse({ ok: false, error: 'No tab id' });
        return;
      }
      try {
        const result = await chrome.tabs.sendMessage(tabId, {
          type: 'REPLACE_SELECTION',
          text,
        });
        sendResponse(result ?? { ok: false, error: 'No response from page' });
      } catch (e) {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : 'Could not reach the page',
        });
      }
    })().catch((err: unknown) => {
      sendResponse({ ok: false, error: String(err) });
    });
    return true;
  }

  // —— Agent ——
  if (message?.type === 'AGENT_EXECUTE_TOOL') {
    const msg = message as AgentRuntimeMessage & { type: 'AGENT_EXECUTE_TOOL' };
    routeAgentTool(msg.call, Boolean(msg.confirmed))
      .then((result) => sendResponse(result))
      .catch((err: unknown) =>
        sendResponse({
          ok: false,
          error: String(err),
          toolCall: msg.call,
        }),
      );
    return true;
  }

  if (message?.type === 'AGENT_REQUEST_PERMISSIONS') {
    const includeDebugger = Boolean(
      (message as { scopes?: string[] }).scopes?.includes('debugger'),
    );
    requestAgentPermissions(includeDebugger)
      .then((granted) => sendResponse({ type: 'AGENT_PERMISSIONS_RESULT', granted }))
      .catch(() => sendResponse({ type: 'AGENT_PERMISSIONS_RESULT', granted: false }));
    return true;
  }

  if (message?.type === 'AGENT_GET_STATUS') {
    (async () => {
      const [settings, permissions] = await Promise.all([
        getAgentSettings(),
        getAgentPermissionState(),
      ]);
      sendResponse({
        type: 'AGENT_STATUS',
        agentEnabled: settings.enabled,
        permissions,
      });
    })().catch((err: unknown) => {
      sendResponse({ ok: false, error: String(err) });
    });
    return true;
  }

  if (message?.type === 'PING') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return false;
  }

  return false;
});

export {};
