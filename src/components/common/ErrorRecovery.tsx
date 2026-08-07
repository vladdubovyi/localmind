import type { ReactNode } from 'react';
import { AlertTriangle, Cpu, RefreshCw, Shield } from 'lucide-react';
import { BrandMark } from '@/components/common/BrandMark';
import { cn } from '@/utils';

export type ErrorRecoveryKind = 'webgpu' | 'model' | 'generic';

interface ErrorRecoveryProps {
  kind: ErrorRecoveryKind;
  title?: string;
  message: string;
  detail?: string;
  primaryLabel?: string;
  onPrimary?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  children?: ReactNode;
  className?: string;
  variant?: 'panel' | 'inline';
}

const DEFAULTS: Record<ErrorRecoveryKind, { title: string; next: string }> = {
  webgpu: {
    title: 'Local AI needs WebGPU',
    next: 'Use Chrome or Edge on a device with GPU hardware, update the browser, and check chrome://gpu if WebGPU is blocked.',
  },
  model: {
    title: 'Model could not load',
    next: 'Try a smaller fallback model, free GPU memory, or retry the download.',
  },
  generic: {
    title: 'Something went wrong',
    next: 'Retry the action, check permissions, or open Privacy to review grants.',
  },
};

/** Shared recovery UI for ERR-01 (WebGPU), ERR-02 (model), ERR-04 (generic). */
export function ErrorRecovery({
  kind,
  title,
  message,
  detail,
  primaryLabel = 'Retry',
  onPrimary,
  secondaryLabel,
  onSecondary,
  children,
  className,
  variant = 'panel',
}: ErrorRecoveryProps) {
  const defaults = DEFAULTS[kind];
  const heading = title ?? defaults.title;
  const Icon = kind === 'webgpu' ? Cpu : kind === 'model' ? AlertTriangle : Shield;

  if (variant === 'inline') {
    return (
      <div
        className={cn(
          'space-y-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger',
          className,
        )}
        role="alert"
      >
        <p className="font-medium text-fg">{heading}</p>
        <p>{message}</p>
        {detail && <p className="text-muted">{detail}</p>}
        <p className="text-muted">{defaults.next}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          {onPrimary && (
            <button
              type="button"
              onClick={onPrimary}
              className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-ink"
            >
              <RefreshCw size={12} />
              {primaryLabel}
            </button>
          )}
          {onSecondary && secondaryLabel && (
            <button
              type="button"
              onClick={onSecondary}
              className="rounded-lg border border-border bg-panel px-2.5 py-1.5 text-[11px] text-fg-dim"
            >
              {secondaryLabel}
            </button>
          )}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex h-full flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center',
        className,
      )}
      role="alert"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(248,113,113,0.12),_transparent_55%)]" />
      <BrandMark size="lg" className="relative animate-fade-up" />
      <div className="relative mt-5 grid h-11 w-11 place-items-center rounded-2xl bg-danger/15 text-danger ring-1 ring-danger/30 animate-fade-up [animation-delay:40ms]">
        <Icon size={22} />
      </div>
      <h1 className="relative mt-4 font-display text-2xl text-fg animate-fade-up [animation-delay:60ms]">
        {heading}
      </h1>
      <p className="relative mt-2 max-w-[36ch] text-sm text-muted animate-fade-up [animation-delay:80ms]">
        {message}
      </p>
      {detail && (
        <p className="relative mt-2 max-w-[36ch] text-xs text-muted animate-fade-up [animation-delay:100ms]">
          {detail}
        </p>
      )}
      <p className="relative mt-3 max-w-[36ch] text-xs leading-relaxed text-fg-dim animate-fade-up [animation-delay:120ms]">
        {defaults.next}
      </p>

      <div className="relative mt-6 w-full max-w-sm space-y-2 animate-fade-up [animation-delay:140ms]">
        {onPrimary && (
          <button
            type="button"
            onClick={onPrimary}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-ink transition hover:brightness-110"
          >
            <RefreshCw size={16} />
            {primaryLabel}
          </button>
        )}
        {onSecondary && secondaryLabel && (
          <button
            type="button"
            onClick={onSecondary}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-panel px-4 py-2.5 text-sm text-fg-dim transition hover:bg-panel-elevated"
          >
            {secondaryLabel}
          </button>
        )}
        {children}
      </div>
    </div>
  );
}
