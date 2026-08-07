import { useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';

const ROWS: Array<{ action: string; keys: string }> = [
  { action: 'Open Phil', keys: 'Alt+Shift+P' },
  { action: 'Focus Agent', keys: 'Alt+Shift+A' },
  { action: 'Summarize page', keys: 'Alt+Shift+S' },
  { action: 'Shortcuts cheatsheet', keys: '?' },
];

export function ShortcutsCheatsheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col bg-ink/95 backdrop-blur-md animate-fade-up">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium text-fg">
          <Keyboard size={16} className="text-accent" />
          Keyboard shortcuts
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted hover:bg-panel hover:text-fg"
          aria-label="Close shortcuts"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
        <p className="text-xs text-muted">
          Commands also appear under chrome://extensions/shortcuts. OS key delivery can vary —
          Phil still runs the same actions when the command fires.
        </p>
        <ul className="mt-4 space-y-2">
          {ROWS.map((row) => (
            <li
              key={row.action}
              className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border-subtle bg-panel/50 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-fg-dim">{row.action}</span>
              <kbd className="shrink-0 rounded-md border border-border bg-ink px-2 py-0.5 font-mono text-[11px] text-muted">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
