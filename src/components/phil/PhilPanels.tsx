import { useCallback, useEffect, useState } from 'react';
import { composeBriefingContent } from '@/background/phil/focusTracker';
import type { FocusSnapshot } from '@/background/phil/focusTracker';
import {
  cancelReminderFromUi,
  completeGoalFromUi,
  createGoalFromUi,
  createReminderFromUi,
  requestBriefingReschedule,
} from '@/phil/clientActions';
import type { Goal, MorningBriefing, PhilAssistantSettings, Reminder } from '@/phil/types';
import {
  getBriefingByDate,
  getPhilSettings,
  listGoals,
  listReminders,
  localDateKey,
  putBriefing,
  savePhilSettings,
  uid,
} from '@/storage/phil';
import { cn } from '@/utils';

function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  if (totalSec < 60) return `${totalSec}s`;
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  if (mins < 60) return secs ? `${mins}m ${secs}s` : `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

async function fetchFocusSnapshot(checkpoint = false): Promise<FocusSnapshot | null> {
  try {
    const resp = (await chrome.runtime.sendMessage({
      type: 'PHIL_FOCUS_SNAPSHOT',
      checkpoint,
    })) as { ok?: boolean; snapshot?: FocusSnapshot } | undefined;
    if (resp?.ok && resp.snapshot) return resp.snapshot;
  } catch {
    // SW unavailable — fall through
  }
  return null;
}

function usePhilStorageRefresh(onChange: () => void): void {
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'local') return;
      if (
        changes.philReminders ||
        changes.philGoals ||
        changes.philSettings ||
        changes.philTabActivity ||
        changes.philBriefings
      ) {
        onChange();
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [onChange]);
}

export function TodayPanel() {
  const [content, setContent] = useState<string>('Loading…');
  const [sources, setSources] = useState<MorningBriefing['sources'] | null>(null);

  const refresh = useCallback(async () => {
    const existing = await getBriefingByDate(localDateKey());
    if (existing && Date.now() - existing.createdAt < 30 * 60_000) {
      setContent(existing.content);
      setSources(existing.sources);
      return;
    }
    const composed = await composeBriefingContent();
    const briefing: MorningBriefing = {
      id: uid('brief'),
      dateKey: localDateKey(),
      content: composed.content,
      createdAt: Date.now(),
      sources: composed.sources,
    };
    await putBriefing(briefing);
    setContent(briefing.content);
    setSources(briefing.sources);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  usePhilStorageRefresh(() => {
    void refresh();
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg text-fg">Today</h2>
          <p className="mt-1 text-xs text-muted">Goals, reminders, and focus so far.</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-lg border border-border px-2 py-1 text-xs text-muted hover:border-accent/40 hover:text-fg"
        >
          Refresh
        </button>
      </div>
      <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-fg-dim">
        {content}
      </pre>
      {sources && (
        <p className="mt-4 text-[11px] text-muted">
          {sources.activeGoalCount} active goal(s) · {sources.reminderCount} reminder(s)
        </p>
      )}
    </div>
  );
}

export function FocusPanel() {
  const [summary, setSummary] = useState<FocusSnapshot | null>(null);

  const refresh = useCallback(async (checkpoint = false) => {
    const snapshot = await fetchFocusSnapshot(checkpoint);
    if (snapshot) {
      setSummary(snapshot);
      return;
    }
    // Last-resort: storage only (no live dwell — SW may be asleep).
    const { focusSummaryToday } = await import('@/background/phil/focusTracker');
    const base = await focusSummaryToday();
    setSummary({ ...base, active: null });
  }, []);

  useEffect(() => {
    void refresh(true);
    // Poll live dwell from the service worker so counters move while this tab is open.
    const id = window.setInterval(() => {
      void refresh(false);
    }, 2_000);
    const checkpointId = window.setInterval(() => {
      void refresh(true);
    }, 15_000);
    return () => {
      window.clearInterval(id);
      window.clearInterval(checkpointId);
    };
  }, [refresh]);
  usePhilStorageRefresh(() => {
    void refresh(false);
  });

  if (!summary) {
    return <div className="grid h-full place-items-center text-sm text-muted">Loading focus…</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <h2 className="font-display text-lg text-fg">Focus</h2>
      <p className="mt-1 text-xs text-muted">Tab time today · {formatMs(summary.totalMs)} total</p>
      {summary.active && (
        <p className="mt-1 text-xs text-accent">
          Now: {summary.active.domain} · {formatMs(summary.active.elapsedMs)} ·{' '}
          {summary.active.category}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {(
          [
            ['productive', 'Productive'],
            ['leisure', 'Leisure'],
            ['neutral', 'Neutral'],
            ['blocked', 'Blocked'],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="rounded-xl border border-border-subtle bg-panel/60 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
            <div className="mt-1 text-sm font-medium text-fg">
              {formatMs(summary.byCategory[key])}
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Top sites</h3>
      <ul className="mt-2 space-y-1.5">
        {summary.byDomain.length === 0 && (
          <li className="text-sm text-muted">No tracked time yet — browse normally.</li>
        )}
        {summary.byDomain.map((row) => (
          <li
            key={row.domain}
            className="flex items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm"
          >
            <span className="truncate text-fg-dim">{row.domain}</span>
            <span className="shrink-0 text-xs text-muted">
              {formatMs(row.ms)} · {row.category}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setGoals(await listGoals());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  usePhilStorageRefresh(refresh);

  const addGoal = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const goal = await createGoalFromUi(t);
      setGoals((prev) => [goal, ...prev.filter((g) => g.id !== goal.id)]);
      setTitle('');
    } finally {
      setBusy(false);
    }
  };

  const complete = async (id: string) => {
    const next = await completeGoalFromUi(id);
    if (!next) return;
    setGoals((prev) => prev.map((g) => (g.id === id ? next : g)));
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <h2 className="font-display text-lg text-fg">Goals</h2>
      <p className="mt-1 text-xs text-muted">Phil nudges you when leisure sites steal the day.</p>

      <div className="mt-4 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Finish the proposal…"
          disabled={busy}
          className="min-w-0 flex-1 rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addGoal();
          }}
        />
        <button
          type="button"
          onClick={() => void addGoal()}
          disabled={busy || !title.trim()}
          className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {goals.length === 0 && <li className="text-sm text-muted">No goals yet.</li>}
        {goals.map((g) => (
          <li
            key={g.id}
            className="flex items-start justify-between gap-2 rounded-xl border border-border-subtle bg-panel/50 px-3 py-2"
          >
            <div>
              <div className={cn('text-sm', g.status === 'completed' && 'text-muted line-through')}>
                {g.title}
              </div>
              <div className="mt-0.5 text-[11px] text-muted">{g.status}</div>
            </div>
            {g.status === 'active' && (
              <button
                type="button"
                onClick={() => void complete(g.id)}
                className="shrink-0 text-xs text-accent hover:underline"
              >
                Done
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RemindersPanel() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [text, setText] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setReminders(await listReminders());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  usePhilStorageRefresh(refresh);

  const add = async () => {
    const t = text.trim();
    const mins = Number(minutes);
    if (!t || !Number.isFinite(mins) || mins < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const reminder = await createReminderFromUi({
        text: t,
        when: Date.now() + mins * 60_000,
        repeat: 'none',
      });
      setReminders((prev) => [...prev.filter((r) => r.id !== reminder.id), reminder]);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (id: string) => {
    const next = await cancelReminderFromUi(id);
    if (!next) return;
    setReminders((prev) => prev.map((r) => (r.id === id ? next : r)));
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <h2 className="font-display text-lg text-fg">Reminders</h2>
      <p className="mt-1 text-xs text-muted">Chrome notifications when it’s time.</p>

      <div className="mt-4 space-y-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Stand up / call mom / ship PR…"
          disabled={busy}
          className="w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
        />
        <div className="flex gap-2">
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            inputMode="numeric"
            aria-label="Minutes from now"
            disabled={busy}
            className="w-20 rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
          <span className="self-center text-xs text-muted">minutes from now</span>
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || !text.trim()}
            className="ml-auto rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Remind'}
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      <ul className="mt-4 space-y-2">
        {reminders.filter((r) => r.status === 'scheduled' || r.status === 'fired').length === 0 && (
          <li className="text-sm text-muted">No reminders yet.</li>
        )}
        {reminders
          .filter((r) => r.status === 'scheduled' || r.status === 'fired')
          .map((r) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-2 rounded-xl border border-border-subtle bg-panel/50 px-3 py-2"
            >
              <div>
                <div className="text-sm text-fg">{r.text}</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {new Date(r.when).toLocaleString()} · {r.status}
                </div>
              </div>
              {r.status === 'scheduled' && (
                <button
                  type="button"
                  onClick={() => void cancel(r.id)}
                  className="shrink-0 text-xs text-danger hover:underline"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
      </ul>
    </div>
  );
}

export function PhilSettingsPanel() {
  const [settings, setSettings] = useState<PhilAssistantSettings | null>(null);

  const refresh = useCallback(async () => {
    setSettings(await getPhilSettings());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  usePhilStorageRefresh(refresh);

  if (!settings) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">Loading settings…</div>
    );
  }

  const update = async (partial: Partial<PhilAssistantSettings>) => {
    const next = await savePhilSettings(partial);
    setSettings(next);
    if (
      partial.briefingEnabled !== undefined ||
      partial.briefingHour !== undefined ||
      partial.briefingMinute !== undefined
    ) {
      requestBriefingReschedule();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <h2 className="font-display text-lg text-fg">Phil settings</h2>
      <p className="mt-1 text-xs text-muted">FAB, focus tracking, nudges, and morning briefing.</p>

      <div className="mt-4 space-y-3">
        {(
          [
            ['fabEnabled', 'Always-on page button'],
            ['trackingEnabled', 'Track tab focus time'],
            ['nudgesEnabled', 'Off-task nudges'],
            ['briefingEnabled', 'Morning briefing'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-fg-dim">{label}</span>
            <input
              type="checkbox"
              checked={Boolean(settings[key])}
              onChange={(e) => void update({ [key]: e.target.checked })}
            />
          </label>
        ))}

        <label className="block text-sm">
          <span className="text-muted">Briefing time (local hour)</span>
          <input
            type="number"
            min={0}
            max={23}
            value={settings.briefingHour}
            onChange={(e) => void update({ briefingHour: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
        </label>

        <label className="block text-sm">
          <span className="text-muted">Locality for web research</span>
          <input
            value={settings.locality}
            onChange={(e) => void update({ locality: e.target.value })}
            placeholder="e.g. Austin TX"
            className="mt-1 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
        </label>
      </div>
    </div>
  );
}
