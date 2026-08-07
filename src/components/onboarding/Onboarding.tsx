import { useEffect, useState, type ReactNode } from 'react';
import { Download, Shield, WifiOff, Cpu } from 'lucide-react';
import { BrandMark } from '@/components/common/BrandMark';
import { ErrorRecovery } from '@/components/common/ErrorRecovery';
import {
  MODEL_TIER_LABEL,
  MODEL_TIER_ORDER,
  estimateDownloadMinutes,
  getModelById,
  modelsByTier,
  recommendModelForDevice,
} from '@/models/catalog';
import type { DownloadProgress, ModelInfo } from '@/types';
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities';
import { cn, formatBytes } from '@/utils';

interface OnboardingProps {
  selectedModelId: string;
  progress: DownloadProgress | null;
  error: string | null;
  isDownloading: boolean;
  alreadyCached?: boolean;
  onSelectModel: (id: string) => void;
  onDownload: (id: string) => void;
  onContinueWithoutModel?: () => void;
}

function pickSmallerFallback(currentId: string, memoryGb?: number): ModelInfo {
  const light = modelsByTier('light')[0];
  const recommended = recommendModelForDevice(memoryGb);
  const current = getModelById(currentId);
  if (light && current && light.id !== current.id) return light;
  if (recommended.id !== currentId) return recommended;
  return light ?? recommended;
}

export function Onboarding({
  selectedModelId,
  progress,
  error,
  isDownloading,
  alreadyCached = false,
  onSelectModel,
  onDownload,
  onContinueWithoutModel,
}: OnboardingProps) {
  const { webgpu, webgpuReady, memoryGb, recommended } = useDeviceCapabilities();
  const [picked, setPicked] = useState(selectedModelId || recommended.id);
  const model = getModelById(picked) ?? recommended;
  const minutes = estimateDownloadMinutes(model.estimatedBytes);
  const fallback = pickSmallerFallback(picked, memoryGb);
  const isWebgpuError =
    webgpu === false ||
    (error != null && /webgpu|adapter|gpu/i.test(error));
  const isModelLoadError = Boolean(error) && !isWebgpuError;

  useEffect(() => {
    if (!selectedModelId && recommended.id) {
      setPicked(recommended.id);
      onSelectModel(recommended.id);
    }
  }, [recommended.id, selectedModelId, onSelectModel]);

  if (webgpuReady && webgpu === false) {
    return (
      <ErrorRecovery
        kind="webgpu"
        message="Phil's local AI needs WebGPU. Without it, chat and Agent can't load a model on this device."
        detail="Goals and Reminders still work — use the tabs above to plan while you fix hardware or browser support."
        primaryLabel="Check again"
        onPrimary={() => window.location.reload()}
        secondaryLabel={onContinueWithoutModel ? 'Continue to Goals' : undefined}
        onSecondary={onContinueWithoutModel}
      />
    );
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="relative overflow-hidden px-5 pb-4 pt-6">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.18),_transparent_60%)]" />
        <BrandMark size="lg" className="relative animate-fade-up" />
        <h1 className="relative mt-5 font-display text-[1.65rem] leading-tight text-fg animate-fade-up [animation-delay:60ms]">
          Private AI that lives inside your browser.
        </h1>
        <p className="relative mt-2 max-w-[34ch] text-sm text-muted animate-fade-up [animation-delay:120ms]">
          Download a model once. Chat stays on-device. Optional Google research, Gmail, and Calendar
          use the internet only when you enable them.
        </p>
      </div>

      <div className="space-y-3 px-5 animate-fade-up [animation-delay:160ms]">
        <Feature
          icon={<Shield size={16} />}
          title="No cloud inference"
          body="No OpenAI, no API keys, no telemetry by default."
        />
        <Feature
          icon={<WifiOff size={16} />}
          title="Offline after download"
          body="Models download once into this browser's cache, then load offline."
        />
        <Feature
          icon={<Cpu size={16} />}
          title="WebGPU accelerated"
          body={
            !webgpuReady
              ? 'Checking WebGPU...'
              : webgpu
                ? `WebGPU detected${memoryGb ? ` · ~${memoryGb} GB device RAM` : ''}.`
                : 'WebGPU not detected — enable it in Chrome flags or update Chrome.'
          }
        />
      </div>

      <div className="mt-5 space-y-4 px-5 animate-fade-up [animation-delay:180ms]">
        {MODEL_TIER_ORDER.map((tier) => {
          const tierModels = modelsByTier(tier);
          if (tierModels.length === 0) return null;
          return (
            <div key={tier} className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wider text-muted">
                {MODEL_TIER_LABEL[tier]}
              </div>
              <div className="space-y-2">
                {tierModels.map((m) => (
                  <ModelOption
                    key={m.id}
                    model={m}
                    active={m.id === picked}
                    recommended={m.id === recommended.id}
                    disabled={isDownloading}
                    onSelect={() => {
                      setPicked(m.id);
                      onSelectModel(m.id);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-auto space-y-3 p-5">
        {isDownloading && progress && (
          <div className="space-y-2 rounded-2xl border border-border bg-panel p-3">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>
                {alreadyCached ? 'Loading' : 'Downloading'} {model.label}
              </span>
              <span>{Math.round(progress.progress * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink">
              <div
                className="relative h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${Math.max(2, progress.progress * 100)}%` }}
              >
                <div className="progress-shimmer absolute inset-0" />
              </div>
            </div>
            <p className="truncate text-[11px] text-muted">{progress.text}</p>
          </div>
        )}

        {isWebgpuError && error && (
          <ErrorRecovery
            variant="inline"
            kind="webgpu"
            message={error}
            primaryLabel="Retry"
            onPrimary={() => onDownload(picked)}
          />
        )}

        {isModelLoadError && error && (
          <ErrorRecovery
            variant="inline"
            kind="model"
            message={error}
            detail={`Try a smaller fallback model (${fallback.label}) if this device is low on memory.`}
            primaryLabel="Retry"
            onPrimary={() => onDownload(picked)}
            secondaryLabel={`Try ${fallback.label}`}
            onSecondary={() => {
              setPicked(fallback.id);
              onSelectModel(fallback.id);
              onDownload(fallback.id);
            }}
          />
        )}

        <button
          type="button"
          disabled={isDownloading || webgpu === false || !webgpuReady}
          onClick={() => onDownload(picked)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-ink transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={16} />
          {isDownloading
            ? alreadyCached
              ? 'Loading from cache...'
              : 'Downloading...'
            : alreadyCached
              ? 'Load Phil'
              : `Download AI · ${formatBytes(model.estimatedBytes)} · ~${minutes} min`}
        </button>
        {error && !isDownloading && (
          <button
            type="button"
            onClick={() => onDownload(picked)}
            className="w-full rounded-2xl border border-border bg-panel px-4 py-2.5 text-sm font-medium text-fg-dim transition hover:bg-panel-elevated"
          >
            Resume / Retry download
          </button>
        )}
        <p className="text-center text-[11px] text-muted">
          {alreadyCached
            ? 'Model found in local cache. Loading uses WebGPU on this device.'
            : model.tier === 'high'
              ? 'High-end models need a stronger GPU. If load fails, try a Balanced or Light option.'
              : 'Downloads are saved in this browser and resume if interrupted.'}
        </p>
        <p className="text-center text-[11px] text-muted">
          If something fails: Retry, check permissions, or open Privacy. Optional Google research,
          Gmail, and Calendar only leave the device when enabled.
        </p>
      </div>
    </div>
  );
}

function ModelOption({
  model,
  active,
  recommended,
  disabled,
  onSelect,
}: {
  model: ModelInfo;
  active: boolean;
  recommended: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        'w-full rounded-2xl border px-3 py-3 text-left transition',
        active
          ? 'border-accent/50 bg-accent/10 ring-1 ring-accent/30'
          : 'border-border bg-panel hover:border-border hover:bg-panel-elevated',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-medium text-fg">{model.label}</div>
        <div className="shrink-0 text-xs text-muted">{model.sizeLabel}</div>
      </div>
      <p className="mt-1 text-xs text-muted">{model.description}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {model.badge && (
          <span className="text-[11px] font-medium text-accent">{model.badge}</span>
        )}
        {recommended && (
          <span className="text-[11px] font-medium text-accent">
            Recommended for this device
          </span>
        )}
        {model.tier === 'high' && (
          <span className="text-[11px] text-muted">
            ~{model.recommendedRamGb}+ GB RAM
          </span>
        )}
      </div>
    </button>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3 rounded-2xl border border-border-subtle bg-panel/60 px-3 py-2.5">
      <div className="mt-0.5 text-accent">{icon}</div>
      <div>
        <div className="text-sm font-medium text-fg">{title}</div>
        <div className="text-xs text-muted">{body}</div>
      </div>
    </div>
  );
}
