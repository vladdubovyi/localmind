import {
  AlertTriangle,
  Bot,
  Check,
  Eraser,
  Loader2,
  SendHorizontal,
  Square,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAgent } from '@/hooks/useAgent';
import { useAgentSettings } from '@/hooks/useAgentSettings';
import { getTool } from '@/agent/tools';
import type { AgentSettings, AgentStep } from '@/agent/types';
import { cn } from '@/utils';

export interface AgentSeedGoal {
  goal: string;
  /** When true, submit immediately once Agent is enabled and idle. */
  autoRun?: boolean;
}

interface AgentPanelProps {
  modelReady: boolean;
  /** Selection / page-action handoff from ChatApp. */
  seedGoal?: AgentSeedGoal | null;
  onSeedConsumed?: () => void;
}

function StepBody({ step }: { step: AgentStep }) {
  if (step.kind === 'user') {
    return (
      <p className="max-w-full whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
        {step.content}
      </p>
    );
  }

  if (step.kind === 'tool_call') {
    return (
      <div className="max-w-full whitespace-pre-wrap break-words text-[12px] leading-relaxed text-fg-dim [overflow-wrap:anywhere]">
        {step.content}
      </div>
    );
  }

  if (step.kind === 'error') {
    return (
      <div className="max-w-full space-y-1.5 text-sm [overflow-wrap:anywhere]">
        <p className="whitespace-pre-wrap break-words">
          What went wrong: {step.content.replace(/^Milestone\b.*$/gim, '').trim() || step.content}
        </p>
        <p className="text-[11px] text-danger/80">
          Next: Retry the action, check permissions, or open Privacy to review grants.
        </p>
      </div>
    );
  }

  if (step.kind === 'final' || step.kind === 'thought' || step.kind === 'tool_result') {
    return (
      <div
        className={cn(
          'prose-localmind max-w-full leading-relaxed',
          step.kind === 'tool_result' ? 'text-[12px] text-fg-dim' : 'text-sm',
        )}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{step.content}</ReactMarkdown>
      </div>
    );
  }

  return (
    <pre className="max-w-full whitespace-pre-wrap break-words font-sans [overflow-wrap:anywhere]">
      {step.content}
    </pre>
  );
}

function stepLabel(step: AgentStep): string {
  switch (step.kind) {
    case 'user':
      return 'You';
    case 'thought':
      return 'Thinking';
    case 'tool_call':
      return 'Tool';
    case 'tool_result':
      return step.toolCall?.name?.replace(/_/g, ' ') ?? 'Result';
    case 'confirm':
      return 'Confirm';
    case 'final':
      return 'Phil';
    case 'error':
      return 'Error';
    default:
      return step.kind;
  }
}

export function AgentPanel({ modelReady, seedGoal, onSeedConsumed }: AgentPanelProps) {
  const {
    settings,
    permissions,
    busy,
    message,
    update,
    enableAgent,
    disableAgent,
    connectGmailOAuth,
    disconnectGmail,
  } = useAgentSettings();

  const { steps, running, pendingConfirm, error, run, stop, resolveConfirm, clearHistory } =
    useAgent();
  const [goal, setGoal] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const seedHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const el = transcriptRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [steps, running, pendingConfirm]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [goal]);

  useEffect(() => {
    if (!seedGoal?.goal || !settings?.enabled || running || busy) return;
    if (seedHandledRef.current === seedGoal.goal) return;
    seedHandledRef.current = seedGoal.goal;
    const text = seedGoal.goal.trim();
    if (!text) {
      onSeedConsumed?.();
      return;
    }
    if (seedGoal.autoRun) {
      setGoal('');
      onSeedConsumed?.();
      void run(text);
      return;
    }
    setGoal(text);
    onSeedConsumed?.();
  }, [seedGoal, settings?.enabled, running, busy, run, onSeedConsumed]);

  if (!settings) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">Loading agent…</div>
    );
  }

  const submit = () => {
    const text = goal.trim();
    if (!text || running || busy || !settings.enabled) return;
    setGoal('');
    void run(text);
  };

  const runQuick = (text: string) => {
    if (!text || running || busy || !settings.enabled) return;
    setGoal('');
    void run(text);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b border-border-subtle px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-fg">
          <Bot size={16} className="text-accent" />
          Browser Agent
        </div>
        <div className="flex items-center gap-3">
          {steps.length > 0 && (
            <button
              type="button"
              disabled={running}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-fg disabled:opacity-40"
              onClick={clearHistory}
              title="Clear chat history"
            >
              <Eraser size={12} />
              Clear
            </button>
          )}
          <button
            type="button"
            className="text-[11px] text-muted hover:text-fg"
            onClick={() => setShowSettings((v) => !v)}
          >
            {showSettings ? 'Hide settings' : 'Settings'}
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="max-h-[45%] shrink-0 space-y-3 overflow-y-auto overflow-x-hidden border-b border-border-subtle bg-panel/50 px-3 py-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-fg-dim">Agent mode</span>
            {settings.enabled ? (
              <button
                type="button"
                className="rounded-lg bg-panel-elevated px-2 py-1 text-danger ring-1 ring-border"
                onClick={() => void disableAgent()}
              >
                Disable
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                className="rounded-lg bg-accent px-2 py-1 font-medium text-ink"
                onClick={() => void enableAgent()}
              >
                Enable + grant permissions
              </button>
            )}
          </div>

          <label className="flex items-center justify-between gap-2 text-fg-dim">
            Confirm moderate actions
            <input
              type="checkbox"
              checked={settings.confirmModerate}
              onChange={(e) => void update({ confirmModerate: e.target.checked })}
            />
          </label>

          <label className="block space-y-1 text-fg-dim">
            Max steps
            <input
              type="number"
              min={1}
              max={20}
              value={settings.maxSteps}
              onChange={(e) => void update({ maxSteps: Number(e.target.value) || 8 })}
              className="w-full rounded-lg border border-border bg-ink px-2 py-1 text-fg"
            />
          </label>

          <label className="block space-y-1 text-fg-dim">
            Gmail mode
            <select
              value={settings.gmailMode}
              onChange={(e) =>
                void update({ gmailMode: e.target.value as AgentSettings['gmailMode'] })
              }
              className="w-full rounded-lg border border-border bg-ink px-2 py-1 text-fg"
            >
              <option value="session">Gmail tab (default — no API key)</option>
              <option value="auto">Auto (API if client ID set, else tab)</option>
              <option value="api">API only (requires OAuth client ID)</option>
            </select>
          </label>

          <p className="text-[11px] leading-relaxed text-muted">
            Default: reads your open Gmail tab while you&apos;re signed in. OAuth client ID is
            optional and only needed for API mode.
          </p>

          <label className="block space-y-1 text-fg-dim">
            Google OAuth client ID (optional)
            <input
              type="text"
              value={settings.gmailClientId}
              placeholder="Only for API mode — leave blank for tab mode"
              onChange={(e) => void update({ gmailClientId: e.target.value })}
              className="w-full rounded-lg border border-border bg-ink px-2 py-1 font-mono text-[11px] text-fg"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !settings.gmailClientId.trim()}
              className="rounded-lg bg-panel-elevated px-2 py-1 ring-1 ring-border disabled:opacity-40"
              onClick={() => void connectGmailOAuth()}
            >
              Connect Gmail API
            </button>
            <button
              type="button"
              className="rounded-lg px-2 py-1 text-muted hover:text-fg"
              onClick={() => void disconnectGmail()}
            >
              Disconnect
            </button>
          </div>

          {permissions && (
            <div className="rounded-lg bg-ink/60 px-2 py-1.5 text-[11px] text-muted">
              tabs:{permissions.tabs ? '✓' : '·'} identity:{permissions.identity ? '✓' : '·'}{' '}
              hosts:{permissions.allUrls ? '✓' : '·'}
            </div>
          )}

          {message && <div className="text-accent">{message}</div>}

          <p className="text-[11px] leading-relaxed text-muted">
            Agent never asks for passwords. Gmail send always needs your confirmation. Session mode
            opens a draft in your Gmail tab and will not auto-click Send.
          </p>
        </div>
      )}

      <div
        ref={transcriptRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3 py-3"
      >
        {steps.length === 0 && (
          <div className="rounded-2xl px-1 py-6 text-center text-sm text-muted">
            <p className="text-fg-dim">Ask the agent to do something in your browser.</p>
            <p className="mt-2 text-[12px]">
              e.g. “Which 5 emails did I get last?” or “Research X on Google and summarize.”
            </p>
            <p className="mt-3 text-[11px] leading-relaxed text-muted">
              If something goes wrong, Phil shows what went wrong plus a next step — Retry, check
              permissions, or open Privacy. Web research uses Google by default.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                disabled={running || busy || !settings.enabled}
                className="rounded-xl bg-accent/15 px-2.5 py-1.5 text-xs font-medium text-accent ring-1 ring-accent/30 hover:bg-accent/25 disabled:opacity-40"
                onClick={() => runQuick('Summarize this page')}
              >
                Summarize this page
              </button>
              <button
                type="button"
                disabled={running || busy || !settings.enabled}
                className="rounded-xl bg-panel px-2.5 py-1.5 text-xs font-medium text-fg-dim ring-1 ring-border hover:text-fg disabled:opacity-40"
                onClick={() => runQuick('Explain this page')}
              >
                Explain this page
              </button>
              <button
                type="button"
                disabled={running || busy || !settings.enabled}
                className="rounded-xl bg-panel px-2.5 py-1.5 text-xs font-medium text-fg-dim ring-1 ring-border hover:text-fg disabled:opacity-40"
                onClick={() => runQuick('Ask a question about this page: What is the main topic?')}
              >
                Ask about this page
              </button>
            </div>
          </div>
        )}

        {steps.map((s) => {
          const isUser = s.kind === 'user';
          const isTool = s.kind === 'tool_call' || s.kind === 'tool_result';
          return (
            <div
              key={s.id}
              className={cn(
                'animate-fade-up min-w-0',
                isUser ? 'flex justify-end' : 'flex justify-start',
              )}
            >
              <div
                className={cn(
                  'min-w-0 max-w-[92%] overflow-hidden rounded-2xl px-3.5 py-2.5 text-sm break-words [overflow-wrap:anywhere]',
                  isUser && 'bg-user-bubble text-fg ring-1 ring-accent/20',
                  s.kind === 'final' && 'w-full bg-transparent text-fg',
                  s.kind === 'error' && 'bg-danger/10 text-danger ring-1 ring-danger/30',
                  s.kind === 'confirm' && 'bg-amber-500/10 text-amber-100 ring-1 ring-amber-500/30',
                  s.kind === 'thought' && 'w-full bg-transparent text-fg-dim',
                  isTool && 'w-full bg-panel/70 text-fg-dim ring-1 ring-border-subtle',
                )}
              >
                {!isUser && (
                  <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider opacity-70">
                    {s.kind === 'tool_call' && <Wrench size={11} />}
                    {s.kind === 'confirm' && <AlertTriangle size={11} />}
                    {s.kind === 'final' && <Check size={11} />}
                    {s.kind === 'error' && <AlertTriangle size={11} />}
                    {stepLabel(s)}
                  </div>
                )}
                <StepBody step={s} />
              </div>
            </div>
          );
        })}

        {running && (
          <div className="flex items-center gap-2 px-1 text-xs text-muted">
            <Loader2 size={12} className="animate-spin text-accent" />
            Working…
          </div>
        )}
      </div>

      {pendingConfirm && (
        <div className="shrink-0 border-t border-amber-500/30 bg-amber-500/10 px-3 py-3">
          <div className="text-xs text-amber-100">
            Allow{' '}
            <strong>{getTool(pendingConfirm.name)?.confirmLabel ?? pendingConfirm.name}</strong>?
          </div>
          <pre className="mt-1 max-h-20 max-w-full overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words text-[11px] text-amber-100/80 [overflow-wrap:anywhere]">
            {JSON.stringify(pendingConfirm.arguments, null, 2)}
          </pre>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-ink"
              onClick={() => resolveConfirm(true)}
            >
              <Check size={14} /> Allow
            </button>
            <button
              type="button"
              className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-panel px-3 py-2 text-xs ring-1 ring-border"
              onClick={() => resolveConfirm(false)}
            >
              <X size={14} /> Deny
            </button>
          </div>
        </div>
      )}

{(error || (!modelReady && settings.enabled && !running)) && (
        <div
          className={cn(
            'mx-3 mb-2 shrink-0 space-y-2 break-words rounded-xl px-3 py-2 text-xs [overflow-wrap:anywhere]',
            error
              ? 'border border-danger/30 bg-danger/10 text-danger'
              : 'border border-border-subtle bg-panel/70 text-muted',
          )}
          role={error ? 'alert' : undefined}
        >
          <p>
            {error
              ? `What went wrong: ${error}`
              : 'Model is restoring in the background — you can send now; Phil will think until it is ready.'}
          </p>
          {error && (
            <p className="text-muted">
              Next: Retry your request, check permissions, or open Privacy to review grants.
            </p>
          )}
        </div>
      )}

      <div className="shrink-0 border-t border-border-subtle bg-ink-soft/80 px-3 py-3 backdrop-blur">
        <div
          className={cn(
            'flex items-end gap-2 rounded-2xl border border-border bg-panel px-3 py-2',
            'focus-within:border-accent/50 focus-within:ring-2 focus-within:ring-accent/20',
          )}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={running}
            placeholder="Message the agent…"
            className="max-h-36 min-h-[28px] min-w-0 flex-1 resize-none break-words bg-transparent text-sm text-fg outline-none placeholder:text-muted"
          />
          {running ? (
            <button
              type="button"
              onClick={stop}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-panel-elevated text-fg ring-1 ring-border"
              aria-label="Stop agent"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              type="button"
              disabled={!settings.enabled || !goal.trim() || busy}
              onClick={submit}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-ink transition enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <SendHorizontal size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
