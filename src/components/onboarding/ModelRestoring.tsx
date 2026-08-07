import { BrandMark } from '@/components/common/BrandMark';
import { ErrorRecovery } from '@/components/common/ErrorRecovery';
import {
  getModelById,
  modelsByTier,
  recommendModelForDevice,
} from '@/models/catalog';
import type { DownloadProgress } from '@/types';
import { getDeviceMemoryGb } from '@/utils';

interface ModelRestoringProps {
  progress: DownloadProgress | null;
  error: string | null;
  selectedModelId?: string;
  onRetry: () => void;
  onTrySmaller?: (modelId: string) => void;
}

/**
 * Compact UI shown when the model is already cached / warm in the service
 * worker. Avoids the full "Download AI" onboarding on every panel open.
 */
export function ModelRestoring({
  progress,
  error,
  selectedModelId,
  onRetry,
  onTrySmaller,
}: ModelRestoringProps) {
  const pct = Math.round((progress?.progress ?? 0) * 100);
  const isWebgpu = error != null && /webgpu|adapter|gpu/i.test(error);
  const light = modelsByTier('light')[0];
  const fallback =
    light && light.id !== selectedModelId
      ? light
      : recommendModelForDevice(getDeviceMemoryGb());

  if (error && isWebgpu) {
    return (
      <ErrorRecovery
        kind="webgpu"
        message={error}
        detail="Goals and Reminders still work from the tabs above while you fix WebGPU."
        primaryLabel="Try again"
        onPrimary={onRetry}
      />
    );
  }

  if (error) {
    return (
      <ErrorRecovery
        kind="model"
        message={error}
        detail={`Try a smaller fallback model (${fallback.label}) if load keeps failing.`}
        primaryLabel="Retry"
        onPrimary={onRetry}
        secondaryLabel={onTrySmaller ? `Try ${fallback.label}` : undefined}
        onSecondary={onTrySmaller ? () => onTrySmaller(fallback.id) : undefined}
      />
    );
  }

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.14),_transparent_55%)]" />
      <BrandMark size="lg" className="relative animate-fade-up" />
      <h1 className="relative mt-5 font-display text-2xl text-fg animate-fade-up [animation-delay:40ms]">
        Restoring Phil
      </h1>
      <p className="relative mt-2 max-w-[32ch] text-sm text-muted animate-fade-up [animation-delay:80ms]">
        Your model is already saved in this browser. Reconnecting the on-device
        engine...
      </p>

      <div className="relative mt-8 w-full max-w-sm space-y-3 animate-fade-up [animation-delay:120ms]">
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
        {selectedModelId && getModelById(selectedModelId) && (
          <p className="text-[11px] text-muted">
            Restoring {getModelById(selectedModelId)!.label}
          </p>
        )}
      </div>
    </div>
  );
}
