import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, RefreshCw } from 'lucide-react';
import type { ChatMessage } from '@/types';
import { cn } from '@/utils';

interface MessageBubbleProps {
  message: ChatMessage;
  onRegenerate?: () => void;
  showRegenerate?: boolean;
}

export function MessageBubble({
  message,
  onRegenerate,
  showRegenerate,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
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
            LocalMind
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
          <div className="mt-1.5 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-muted hover:bg-panel hover:text-fg"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
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
      </div>
    </div>
  );
}
