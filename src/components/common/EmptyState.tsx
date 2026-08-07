import type { ReactNode } from 'react';
import { cn } from '@/utils';

/** Shared empty-state shell — assistant voice + one primary CTA. */
export function EmptyState({
  title,
  body,
  ctaLabel,
  onCta,
  className,
}: {
  title: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-start gap-3 rounded-2xl border border-border-subtle bg-panel/40 px-4 py-5 text-left',
        className,
      )}
    >
      <div>
        <p className="text-sm font-medium text-fg">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
      </div>
      <button
        type="button"
        onClick={onCta}
        className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-ink hover:brightness-110"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

export function EmptyStateCenter({ children }: { children: ReactNode }) {
  return <div className="px-1 py-4">{children}</div>;
}
