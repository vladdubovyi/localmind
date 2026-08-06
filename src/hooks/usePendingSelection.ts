import { useCallback, useEffect, useRef } from 'react';
import type { PendingSelectionAction } from '@/types';

const STORAGE_KEY = 'pendingSelectionAction';

/**
 * Watches chrome.storage.session for selection actions queued by the
 * content script / context menu, then hands them to the side panel.
 */
export function usePendingSelection(
  enabled: boolean,
  onAction: (pending: PendingSelectionAction) => void | Promise<void>,
) {
  const onActionRef = useRef(onAction);
  onActionRef.current = onAction;
  const handlingRef = useRef(false);

  const consume = useCallback(async () => {
    if (!enabled || handlingRef.current) return;
    try {
      const stored = await chrome.storage.session.get(STORAGE_KEY);
      const pending = stored[STORAGE_KEY] as PendingSelectionAction | undefined;
      if (!pending?.text || !pending.action) return;

      // Ignore stale actions older than 2 minutes
      if (Date.now() - pending.createdAt > 120_000) {
        await chrome.storage.session.remove(STORAGE_KEY);
        return;
      }

      handlingRef.current = true;
      await chrome.storage.session.remove(STORAGE_KEY);
      await onActionRef.current(pending);
    } catch {
      // Not in extension context
    } finally {
      handlingRef.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    void consume();

    const onChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
      area,
    ) => {
      if (area !== 'session' || !changes[STORAGE_KEY]?.newValue) return;
      void consume();
    };

    chrome.storage.onChanged.addListener(onChange);
    return () => {
      chrome.storage.onChanged.removeListener(onChange);
    };
  }, [enabled, consume]);
}
