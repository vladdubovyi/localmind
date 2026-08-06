import { useCallback, useEffect, useState } from 'react';
import { formatPageStats } from '@/ai/contextManager';
import {
  fetchActivePageContext,
  PageContextError,
} from '@/utils/pageContext';
import type { PageContext } from '@/types';

export type PageContextStatus = 'idle' | 'loading' | 'ready' | 'error';

export function usePageContext(enabled: boolean) {
  const [status, setStatus] = useState<PageContextStatus>('idle');
  const [page, setPage] = useState<PageContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const ctx = await fetchActivePageContext();
      setPage(ctx);
      setStats(formatPageStats(ctx));
      setStatus('ready');
      return ctx;
    } catch (e) {
      const message =
        e instanceof PageContextError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to read page';
      setPage(null);
      setStats(null);
      setError(message);
      setStatus('error');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setStatus('idle');
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const clear = useCallback(() => {
    setPage(null);
    setStats(null);
    setError(null);
    setStatus('idle');
  }, []);

  return { status, page, error, stats, refresh, clear };
}
