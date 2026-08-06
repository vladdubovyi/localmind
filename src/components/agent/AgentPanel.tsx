import {
  AlertTriangle,
  Bot,
  Check,
  Loader2,
  Play,
  Square,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAgent } from '@/hooks/useAgent';
import { useAgentSettings } from '@/hooks/useAgentSettings';
import { getTool } from '@/agent/tools';
import { cn } from '@/utils';

interface AgentPanelProps {
  modelReady: boolean;
}

export function AgentPanel({ modelReady }: AgentPanelProps) {
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

  const { steps, running, pendingConfirm, error, run, stop, resolveConfirm } = useAgent();
  const [goal, setGoal] = useState(
    'Open Wikipedia WebGPU, read the page, and summarize what WebGPU is in 3 bullets.',
  );
  const [showSettings, setShowSettings] = useState(false);

  if (!settings) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">Loading agent…</div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border-subtle px-3 py-2">
        <div className="flex items-center gap-2 text-sm font-medium text-fg">
          <Bot size={16} className="text-accent" />
          Browser Agent
        </div>
        <button
          type="button"
          className="text-[11px] text-muted hover:text-fg"
          onClick={() => setShowSettings((v) => !v)}
        >
          {showSettings ? 'Hide settings' : 'Settings'}
        </button>
      </div>

      {showSettings && (
        <div className="space-y-3 border-b border-border-subtle bg-panel/50 px-3 py-3 text-xs">
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

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {steps.length === 0 && (
          <div className="rounded-2xl border border-border bg-panel/60 px-3 py-3 text-sm text-muted">
            Describe a goal. The local model will call browser tools (tabs, page actions, Gmail)
            with confirmation for risky steps.
          </div>
        )}
        {steps.map((s) => (
          <div
            key={s.id}
            className={cn(
              'rounded-xl px-3 py-2 text-xs ring-1',
              s.kind === 'error'
                ? 'bg-danger/10 text-danger ring-danger/30'
                : s.kind === 'confirm'
                  ? 'bg-amber-500/10 text-amber-200 ring-amber-500/30'
                  : s.kind === 'final'
                    ? 'bg-accent/10 text-fg ring-accent/30'
                    : 'bg-panel text-fg-dim ring-border',
            )}
          >
            <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-70">
              {s.kind === 'tool_call' && <Wrench size={11} />}
              {s.kind === 'confirm' && <AlertTriangle size={11} />}
              {s.kind === 'final' && <Check size={11} />}
              {s.kind}
              {s.toolCall ? ` · ${s.toolCall.name}` : ''}
            </div>
            <pre className="whitespace-pre-wrap break-words font-sans">{s.content}</pre>
          </div>
        ))}
      </div>

      {pendingConfirm && (
        <div className="border-t border-amber-500/30 bg-amber-500/10 px-3 py-3">
          <div className="text-xs text-amber-100">
            Allow{' '}
            <strong>{getTool(pendingConfirm.name)?.confirmLabel ?? pendingConfirm.name}</strong>?
          </div>
          <pre className="mt-1 max-h-20 overflow-auto text-[11px] text-amber-100/80">
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

      {(error || (!modelReady && settings.enabled)) && (
        <div className="mx-3 mb-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error || 'Load the local model before running the agent.'}
        </div>
      )}

      <div className="border-t border-border-subtle px-3 py-3">
        <textarea
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          rows={3}
          disabled={running}
          className="w-full resize-none rounded-2xl border border-border bg-panel px-3 py-2 text-sm text-fg outline-none focus:border-accent/50"
          placeholder="Agent goal…"
        />
        <div className="mt-2 flex gap-2">
          {running ? (
            <button
              type="button"
              onClick={stop}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-panel-elevated py-2.5 text-sm ring-1 ring-border"
            >
              <Square size={14} fill="currentColor" /> Stop
            </button>
          ) : (
            <button
              type="button"
              disabled={!settings.enabled || !modelReady || !goal.trim() || busy}
              onClick={() => void run(goal.trim())}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-accent py-2.5 text-sm font-semibold text-ink disabled:opacity-40"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run agent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// local type re-export for select onChange
type AgentSettings = import('@/agent/types').AgentSettings;
