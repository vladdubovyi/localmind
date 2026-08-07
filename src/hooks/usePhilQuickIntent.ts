import { useCallback, useEffect } from 'react';
import type { PhilQuickIntent } from '@/phil/types';

/**
 * Consume one-shot Phil FAB / notification intents from chrome.storage.session.
 */
export function usePhilQuickIntent(
  enabled: boolean,
  onIntent: (intent: PhilQuickIntent) => void,
): void {
  const handler = useCallback(
    (intent: PhilQuickIntent) => {
      onIntent(intent);
    },
    [onIntent],
  );

  useEffect(() => {
    if (!enabled) return;

    const consume = async () => {
      const stored = await chrome.storage.session.get('philQuickIntent');
      const intent = stored.philQuickIntent as PhilQuickIntent | undefined;
      if (!intent?.kind) return;
      if (Date.now() - intent.createdAt > 5 * 60_000) {
        await chrome.storage.session.remove('philQuickIntent');
        return;
      }
      await chrome.storage.session.remove('philQuickIntent');
      handler(intent);
    };

    void consume();

    const onChanged = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== 'session' || !changes.philQuickIntent?.newValue) return;
      void consume();
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => chrome.storage.onChanged.removeListener(onChanged);
  }, [enabled, handler]);
}
