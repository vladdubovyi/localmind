import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, RefreshCw, Replace } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { cn } from '@/utils';

interface MessageBubbleProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  showRegenerate?: boolean;
  onReplaceSelection?: (message: ChatMessage) => void | Promise<void>;
}

export function MessageBubble({
  message,
  onRegenerate,
  showRegenerate,
  onReplaceSelection,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [replaced, setReplaced] = useState(false);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const isUser = message.role === 'user';
  const canReplace =
    !isUser &&
    message.status === 'complete' &&
    Boolean(message.selection?.canReplace && message.content);

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const replace = async () => {
    if (!onReplaceSelection) return;
    setReplaceError(null);
    try {
      await onReplaceSelection(message);
      setReplaced(true);
      window.setTimeout(() => setReplaced(false), 2000);
    } catch (e) {
      setReplaceError(e instanceof Error ? e.message : 'Replace failed');
    }
  };

  return (
    <div
      className={cn(
        'group animate-fade-up px-4 py-3',
        isUser ? 'flex justify-end' : 'flex justify-start',
      )}
    >
      <div className={cn('max-w-[92%]', isUser ? 'w-auto' : 'w-full')}>
        {!isUser && (
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-accent">
            Phil
          </div>
        )}
        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-user-bubble text-fg ring-1 ring-accent/20'
              : 'bg-transparent text-fg-dim',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : message.content ? (
            <div className="prose-localmind">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ className, children, ...props }) {
                    const isBlock = Boolean(className?.includes('language-'));
                    if (!isBlock) {
                      return (
                        <code
                          className="rounded bg-panel-elevated px-1 py-0.5 font-mono text-[0.85em] text-accent"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <pre className="my-2 overflow-x-auto rounded-xl bg-ink p-3 font-mono text-xs ring-1 ring-border">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    );
                  },
                  a({ children, href }) {
                    return (
                      <a
                        href={href}
                        className="text-accent underline-offset-2 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {children}
                      </a>
                    );
                  },
                  ul({ children }) {
                    return <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>;
                  },
                  ol({ children }) {
                    return <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>;
                  },
                  p({ children }) {
                    return <p className="mb-2 last:mb-0">{children}</p>;
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          ) : (
            <span className="animate-pulse-soft text-muted">Thinking…</span>
          )}
        </div>

        {!isUser && message.status === 'complete' && message.content && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={() => void copy()}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted hover:bg-panel hover:text-fg"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            {canReplace && onReplaceSelection && (
              <button
                type="button"
                onClick={() => void replace()}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-accent hover:bg-accent/10"
              >
                {replaced ? <Check size={12} /> : <Replace size={12} />}
                {replaced ? 'Replaced' : 'Replace on page'}
              </button>
            )}
            {showRegenerate && onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted hover:bg-panel hover:text-fg"
              >
                <RefreshCw size={12} />
                Regenerate
              </button>
            )}
          </div>
        )}
        {replaceError && (
          <div className="mt-1 text-[11px] text-danger">{replaceError}</div>
        )}
      </div>
    </div>
  );
}
