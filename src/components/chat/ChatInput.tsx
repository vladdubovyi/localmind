import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowUp, Square } from 'lucide-react';
import { cn } from '@/utils';

interface ChatInputProps {
  disabled?: boolean;
  isGenerating?: boolean;
  onSend: (value: string) => void;
  onStop?: () => void;
  placeholder?: string;
}

export function ChatInput({
  disabled,
  isGenerating,
  onSend,
  onStop,
  placeholder = 'Message Phil…',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const submit = () => {
    if (!value.trim() || disabled || isGenerating) return;
    onSend(value);
    setValue('');
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-border-subtle bg-ink-soft/80 px-3 py-3 backdrop-blur">
      <div
        className={cn(
          'flex items-end gap-2 rounded-2xl border border-border bg-panel px-3 py-2',
          'focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20',
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          className="max-h-40 min-h-[28px] flex-1 resize-none bg-transparent text-sm text-fg outline-none placeholder:text-muted"
        />
        {isGenerating ? (
          <button
            type="button"
            onClick={onStop}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-panel-elevated text-fg ring-1 ring-border transition hover:bg-border"
            aria-label="Stop generation"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-ink transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <ArrowUp size={16} strokeWidth={2.5} />
          </button>
        )}
      </div>
      <p className="mt-2 text-center text-[11px] text-muted">
        Runs locally · Enter to send · Shift+Enter for newline
      </p>
    </div>
  );
}
