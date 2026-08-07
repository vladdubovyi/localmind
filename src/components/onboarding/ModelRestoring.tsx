import { BrandMark } from '@/components/common/BrandMark';
import type { DownloadProgress } from '@/types';

interface ModelRestoringProps {
  progress: DownloadProgress | null;
  error: string | null;
  onRetry: () => void;
}

/**
 * Compact UI shown when the model is already cached / warm in the service
 * worker. Avoids the full "Download AI" onboarding on every panel open.
 */
export function ModelRestoring({
  progress,
  error,
  onRetry,
}: ModelRestoringProps) {
  const pct = Math.round((progress?.progress ?? 0) * 100);

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.14),_transparent_55%)]" />
      <BrandMark size="lg" className="relative animate-fade-up" />
      <h1 className="relative mt-5 font-display text-2xl text-fg animate-fade-up [animation-delay:40ms]">
        Restoring Phil
      </h1>
      <p className="relative mt-2 max-w-[32ch] text-sm text-muted animate-fade-up [animation-delay:80ms]">
        Your model is already saved in this browser. Reconnecting the on-device
        engine…
      </p>

      <div className="relative mt-8 w-full max-w-sm space-y-3 animate-fade-up [animation-delay:120ms]">
        {!error && (
          <div className="space-y-2 rounded-2xl border border-border bg-panel/80 px-4 py-3 text-left">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>Loading from local cache</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink">
              <div
                className="relative h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${Math.max(4, pct)}%` }}
              >
                <div className="progress-shimmer absolute inset-0" />
              </div>
            </div>
            {progress?.text && (
              <p className="truncate text-[11px] text-muted">{progress.text}</p>
            )}
          </div>
        )}

        {error && (
          <div className="space-y-3">
            <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
              {error}
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-ink transition hover:brightness-110"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
