import { FileText, Globe, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ChatMode } from '@/hooks/useChat';
import type { PageContextStatus } from '@/hooks/usePageContext';
import type { PageContext } from '@/types';
import { cn, truncate } from '@/utils';

interface PageActionsProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  page: PageContext | null;
  status: PageContextStatus;
  stats: string | null;
  error: string | null;
  disabled?: boolean;
  onRefresh: () => void;
  onSummarize: () => void;
}

export function PageActions({
  mode,
  onModeChange,
  page,
  status,
  stats,
  error,
  disabled,
  onRefresh,
  onSummarize,
}: PageActionsProps) {
  const pageReady = status === 'ready' && page;
  const showContext =
    mode === 'page' ||
    status === 'ready' ||
    status === 'error' ||
    status === 'loading';

  return (
    <div className="space-y-2 border-b border-border-subtle px-3 py-2">
      <div className="flex items-center gap-1.5">
        <ModeChip
          active={mode === 'chat'}
          disabled={disabled}
          onClick={() => onModeChange('chat')}
          icon={<Sparkles size={13} />}
          label="Chat"
        />
        <ModeChip
          active={mode === 'page'}
          disabled={disabled}
          onClick={() => onModeChange('page')}
          icon={<Globe size={13} />}
          label="Ask this page"
        />
        <button
          type="button"
          disabled={disabled || status === 'loading'}
          onClick={onSummarize}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium transition',
            'bg-accent/15 text-accent ring-1 ring-accent/30 hover:bg-accent/25',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
          title="Summarize the current page"
        >
          {status === 'loading' ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <FileText size={13} />
          )}
          Summarize
        </button>
      </div>

      {showContext && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-xl px-2.5 py-2 text-[11px] ring-1',
            status === 'error'
              ? 'bg-danger/10 text-danger ring-danger/30'
              : 'bg-panel/80 text-muted ring-border',
          )}
        >
          <div className="min-w-0 flex-1">
            {status === 'loading' && <span>Reading page…</span>}
            {status === 'error' && <span>{error}</span>}
            {pageReady && (
              <>
                <div className="truncate font-medium text-fg-dim">
                  {truncate(page.title, 56)}
                </div>
                <div className="truncate opacity-80">{stats}</div>
              </>
            )}
            {mode === 'page' && status === 'idle' && (
              <span>Reading the open tab to ground answers…</span>
            )}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={disabled || status === 'loading'}
            className="shrink-0 rounded-lg p-1 text-muted hover:bg-panel-elevated hover:text-fg disabled:opacity-40"
            aria-label="Refresh page context"
            title="Refresh page context"
          >
            <RefreshCw
              size={12}
              className={status === 'loading' ? 'animate-spin' : undefined}
            />
          </button>
        </div>
      )}
    </div>
  );
}

function ModeChip({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition',
        active
          ? 'bg-accent text-ink'
          : 'bg-panel text-muted ring-1 ring-border hover:text-fg',
        'disabled:cursor-not-allowed disabled:opacity-40',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
