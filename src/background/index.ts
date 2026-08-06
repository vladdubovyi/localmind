/**
 * Background service worker (Manifest V3).
 * Coordinates side panel, context menus, and messaging.
 * Inference runs in extension pages (popup/side panel) via WebGPU — not here.
 */

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {
    // older Chrome builds may not support setPanelBehavior
  });

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'localmind-open',
      title: 'Ask LocalMind',
      contexts: ['page', 'selection'],
    });

    // Milestone 3 will wire these to selection actions
    const actions = [
      { id: 'explain', title: 'Explain selection' },
      { id: 'summarize', title: 'Summarize selection' },
      { id: 'rewrite', title: 'Rewrite selection' },
      { id: 'translate', title: 'Translate selection' },
      { id: 'eli5', title: 'Explain like I\'m 5' },
      { id: 'improve', title: 'Improve writing' },
    ] as const;

    for (const action of actions) {
      chrome.contextMenus.create({
        id: `localmind-${action.id}`,
        parentId: 'localmind-open',
        title: action.title,
        contexts: ['selection'],
      });
    }
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.windowId) return;

  await chrome.sidePanel.open({ windowId: tab.windowId });

  if (info.menuItemId === 'localmind-open') return;

  const action = String(info.menuItemId).replace('localmind-', '');
  const text = info.selectionText ?? '';

  // Persist pending action for the side panel to pick up (Milestone 3 UX polish)
  await chrome.storage.session.set({
    pendingSelectionAction: {
      action,
      text,
      url: tab.url,
      title: tab.title,
      createdAt: Date.now(),
    },
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_SIDE_PANEL') {
    const windowId = sender.tab?.windowId;
    (async () => {
      if (windowId != null) {
        await chrome.sidePanel.open({ windowId });
      } else {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab?.windowId != null) {
          await chrome.sidePanel.open({ windowId: tab.windowId });
        }
      }
      sendResponse({ ok: true });
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
