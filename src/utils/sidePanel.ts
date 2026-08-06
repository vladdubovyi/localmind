/**
 * Open the LocalMind side panel from an extension page (popup / sidebar).
 * Must run in the same turn as a user gesture — routing through the service
 * worker often breaks Chrome's gesture requirement for sidePanel.open().
 */
export async function openSidePanelFromPage(): Promise<boolean> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId != null) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
      return true;
    }
  } catch {
    // fall through to SW bridge
  }

  try {
    await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    return true;
  } catch {
    return false;
  }
}
