import { useCallback, useEffect, useRef, useState } from 'react';
import {
  focusSnapshotFromStorage,
  type FocusSnapshot,
} from '@/background/phil/focusTracker';
import {
  buildEveningBriefingRecord,
  buildMorningBriefingRecord,
  goalRelativeFocus,
} from '@/background/phil/dailyReview';
import { EmptyState, EmptyStateCenter } from '@/components/common/EmptyState';
import {
  acceptSuggestionFromUi,
  cancelReminderFromUi,
  completeGoalFromUi,
  createGoalFromUi,
  createReminderFromUi,
  dismissSuggestionFromUi,
  requestBriefingReschedule,
  requestEveningRecap,
  requestProactiveTick,
  snoozeSuggestionFromUi,
} from '@/phil/clientActions';
import {
  SENSITIVITY_PRESETS,
  sensitivityFromThresholdMs,
  type SensitivityPreset,
} from '@/phil/notificationPolicy';
import type {
  Goal,
  MorningBriefing,
  NotificationFrequency,
  PhilAssistantSettings,
  ProactiveSuggestion,
  Reminder,
} from '@/phil/types';
import {
  getBriefingByDate,
  getPhilSettings,
  listGoals,
  listReminders,
  listVisibleSuggestions,
  localDateKey,
  putBriefing,
  savePhilSettings,
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

function withLiveElapsed(snapshot: FocusSnapshot, now = Date.now()): FocusSnapshot {
  if (!snapshot.active) return snapshot;
  const elapsedMs = Math.max(0, now - snapshot.active.startedAt);
  const delta = elapsedMs - snapshot.active.elapsedMs;
  if (delta === 0) return snapshot;
  const byCategory = { ...snapshot.byCategory };
  byCategory[snapshot.active.category] += delta;
  const domainMap = new Map(snapshot.byDomain.map((d) => [d.domain, { ...d }]));
  const prev = domainMap.get(snapshot.active.domain);
  if (prev) prev.ms += delta;
  else {
    domainMap.set(snapshot.active.domain, {
      domain: snapshot.active.domain,
      ms: elapsedMs,
      category: snapshot.active.category,
    });
  }
  return {
    byCategory,
    totalMs: snapshot.totalMs + delta,
    byDomain: [...domainMap.values()].sort((a, b) => b.ms - a.ms).slice(0, 25),
    active: { ...snapshot.active, elapsedMs },
  };
}

function usePhilStorageRefresh(onChange: () => void): void {
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'local' && area !== 'session') return;
      if (
        changes.philReminders ||
        changes.philGoals ||
        changes.philSettings ||
        changes.philTabActivity ||
        changes.philBriefings ||
        changes.philFocusLive ||
        changes.philProjects ||
        changes.philActiveProject ||
        changes.philSuggestions
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
  const [evening, setEvening] = useState<string | null>(null);
  const [sources, setSources] = useState<MorningBriefing['sources'] | null>(null);
  const [suggestions, setSuggestions] = useState<ProactiveSuggestion[]>([]);
  const [eveningNote, setEveningNote] = useState<string | null>(null);

  const refresh = useCallback(async (force = false) => {
    if (!force) {
      const existing = await getBriefingByDate(localDateKey(), 'morning');
      if (existing && Date.now() - existing.createdAt < 30 * 60_000) {
        setContent(existing.content);
        setSources(existing.sources);
      } else {
        const briefing = await buildMorningBriefingRecord();
        await putBriefing(briefing);
        setContent(briefing.content);
        setSources(briefing.sources);
      }
    } else {
      const briefing = await buildMorningBriefingRecord();
      await putBriefing(briefing);
      setContent(briefing.content);
      setSources(briefing.sources);
    }

    const eveningExisting = await getBriefingByDate(localDateKey(), 'evening');
    setEvening(eveningExisting?.content ?? null);
    setSuggestions(await listVisibleSuggestions());

    try {
      const session = await chrome.storage.session.get([
        'philEveningNotification',
        'philProactiveHarness',
      ]);
      const note = session.philEveningNotification as { message?: string } | undefined;
      if (note?.message) setEveningNote(note.message);
      if (session.philProactiveHarness) requestProactiveTick(true);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void refresh();
    requestProactiveTick(false);
  }, [refresh]);
  usePhilStorageRefresh(() => {
    void refresh();
  });

  const onDismiss = (id: string) => {
    dismissSuggestionFromUi(id);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };
  const onSnooze = (id: string) => {
    snoozeSuggestionFromUi(id, 60_000);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };
  const onAccept = (id: string) => {
    acceptSuggestionFromUi(id);
    setSuggestions((prev) => prev.filter((s) => s.id !== id));
  };

  const composeEvening = async () => {
    const recap = await buildEveningBriefingRecord();
    await putBriefing(recap);
    setEvening(recap.content);
    requestEveningRecap(true);
    setEveningNote('evening notification / evening briefing ready');
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-display text-lg text-fg">Today</h2>
          <p className="mt-1 text-xs text-muted">
            Morning briefing, priorities, proactive inbox, and evening recap.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh(true)}
          className="shrink-0 rounded-lg border border-border px-2 py-1 text-xs text-muted hover:border-accent/40 hover:text-fg"
        >
          Refresh
        </button>
      </div>

      {suggestions.length > 0 && (
        <section className="mt-4 min-w-0" aria-label="Proactive suggestions">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Phil noticed</h3>
          <ul className="mt-2 space-y-2">
            {suggestions.map((s) => (
              <li
                key={s.id}
                className="min-w-0 rounded-xl border border-border-subtle bg-panel/50 px-3 py-2"
              >
                <div className="text-sm font-medium text-fg">{s.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-fg-dim">{s.body}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" className="text-xs text-accent hover:underline" onClick={() => onAccept(s.id)}>
                    Accept
                  </button>
                  <button type="button" className="text-xs text-muted hover:underline" onClick={() => onSnooze(s.id)}>
                    Snooze
                  </button>
                  <button type="button" className="text-xs text-danger hover:underline" onClick={() => onDismiss(s.id)}>
                    Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <pre className="mt-4 max-w-full whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-fg-dim [overflow-wrap:anywhere]">
        {content}
      </pre>
      {sources && (
        <p className="mt-4 text-[11px] text-muted">
          {sources.activeGoalCount} active goal(s) · {sources.reminderCount} reminder(s)
          {sources.completedGoalCount != null ? ` · ${sources.completedGoalCount} completed` : ''}
        </p>
      )}

      <section className="mt-6 min-w-0" aria-label="Evening recap">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Evening recap</h3>
          <button
            type="button"
            onClick={() => void composeEvening()}
            className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] text-muted hover:border-accent/40 hover:text-fg"
          >
            Compose evening summary
          </button>
        </div>
        {eveningNote && (
          <p className="mt-2 text-[11px] text-accent">Evening notification path ready — {eveningNote}</p>
        )}
        {evening ? (
          <pre className="mt-2 max-w-full whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-fg-dim [overflow-wrap:anywhere]">
            {evening}
          </pre>
        ) : (
          <p className="mt-2 text-xs text-muted">
            Evening summary appears here after the evening briefing alarm or when you compose it.
          </p>
        )}
      </section>
    </div>
  );
}

export function FocusPanel() {
  const [summary, setSummary] = useState<FocusSnapshot | null>(null);
  const [relative, setRelative] = useState<Awaited<ReturnType<typeof goalRelativeFocus>> | null>(
    null,
  );

  const refresh = useCallback(async () => {
    const snapshot = await focusSnapshotFromStorage();
    setSummary(withLiveElapsed(snapshot));
    setRelative(await goalRelativeFocus(snapshot));
  }, []);

  useEffect(() => {
    void refresh();
    const askCheckpoint = () => {
      try {
        void chrome.runtime.sendMessage({ type: 'PHIL_FOCUS_CHECKPOINT' }).catch(() => undefined);
      } catch {
        // ignore
      }
    };
    askCheckpoint();
    const tickId = window.setInterval(() => {
      setSummary((prev) => (prev ? withLiveElapsed(prev) : prev));
    }, 1_000);
    const refreshId = window.setInterval(() => {
      askCheckpoint();
      void refresh();
    }, 5_000);
    return () => {
      window.clearInterval(tickId);
      window.clearInterval(refreshId);
    };
  }, [refresh]);
  usePhilStorageRefresh(refresh);

  if (!summary) {
    return <div className="grid h-full place-items-center text-sm text-muted">Loading focus…</div>;
  }

  const isEmpty = summary.totalMs === 0 && summary.byDomain.length === 0 && !summary.active;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
      <h2 className="font-display text-lg text-fg">Focus</h2>
      <p className="mt-1 text-xs text-muted">Tab time today · {formatMs(summary.totalMs)} total</p>
      {summary.active && (
        <p className="mt-1 truncate text-xs text-accent">
          Now: {summary.active.domain} · {formatMs(summary.active.elapsedMs)} · {summary.active.category}
        </p>
      )}

      {relative && (
        <div className="mt-3 rounded-xl border border-border-subtle bg-panel/40 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-muted">How productive was I today?</div>
          <p className="mt-1 text-sm text-fg-dim">
            Toward goals: {formatMs(relative.towardGoalsMs)} · Leisure / entertainment:{' '}
            {formatMs(relative.leisureMs)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Productive {formatMs(relative.productiveMs)} · Neutral {formatMs(relative.neutralMs)} ·
            Leisure {formatMs(relative.leisureMs)}
          </p>
          <p className="mt-2 text-xs leading-relaxed text-fg-dim">
            Actionable insight — {relative.insight}
          </p>
        </div>
      )}

      {isEmpty ? (
        <EmptyStateCenter>
          <EmptyState
            title="I haven’t tracked anything yet"
            body="Browse normally — I’ll log productive vs leisure time once you visit sites. Tracking stays on this device."
            ctaLabel="Refresh focus"
            onCta={() => void refresh()}
          />
        </EmptyStateCenter>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {(
              [
                ['productive', 'Productive'],
                ['leisure', 'Leisure'],
                ['neutral', 'Neutral'],
                ['blocked', 'Blocked'],
              ] as const
            ).map(([key, label]) => (
              <div
                key={key}
                className="min-w-0 rounded-xl border border-border-subtle bg-panel/60 px-3 py-2"
              >
                <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
                <div className="mt-1 text-sm font-medium text-fg">{formatMs(summary.byCategory[key])}</div>
              </div>
            ))}
          </div>

          <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Top sites</h3>
          <ul className="mt-2 space-y-1.5">
            {summary.byDomain.map((row) => (
              <li
                key={row.domain}
                className="flex min-w-0 items-center justify-between gap-2 rounded-lg px-1 py-1 text-sm"
              >
                <span className="truncate text-fg-dim">{row.domain}</span>
                <span className="shrink-0 text-xs text-muted">
                  {formatMs(row.ms)} · {row.category}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function GoalsPanel() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
    <div className="flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
      <h2 className="font-display text-lg text-fg">Goals</h2>
      <p className="mt-1 text-xs text-muted">I’ll nudge you when leisure sites steal the day.</p>

      <div className="mt-4 flex min-w-0 gap-2">
        <input
          ref={inputRef}
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
          className="shrink-0 rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
        >
          Add
        </button>
      </div>

      <ul className="mt-4 space-y-2">
        {goals.length === 0 && (
          <li>
            <EmptyState
              title="What are you working toward?"
              body="Add a goal and I’ll help you stay on it — gentle nudges when leisure sites pull you away."
              ctaLabel="Add a goal"
              onCta={() => inputRef.current?.focus()}
            />
          </li>
        )}
        {goals.map((g) => (
          <li
            key={g.id}
            className="flex min-w-0 items-start justify-between gap-2 rounded-xl border border-border-subtle bg-panel/50 px-3 py-2"
          >
            <div className="min-w-0">
              <div
                className={cn(
                  'break-words text-sm [overflow-wrap:anywhere]',
                  g.status === 'completed' && 'text-muted line-through',
                )}
              >
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
  const [settings, setSettings] = useState<PhilAssistantSettings | null>(null);
  const [text, setText] = useState('');
  const [minutes, setMinutes] = useState('30');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const [list, phil] = await Promise.all([listReminders(), getPhilSettings()]);
    setReminders(list);
    setSettings(phil);
    setMinutes(String(phil.reminderDefaultLeadMinutes));
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

  const scheduled = reminders.filter((r) => r.status === 'scheduled' || r.status === 'fired');

  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
      <h2 className="font-display text-lg text-fg">Reminders</h2>
      <p className="mt-1 text-xs text-muted">
        Chrome notifications when it’s time
        {settings
          ? ` · default ${settings.reminderDefaultLeadMinutes}m / ${settings.reminderDefaultRepeat}`
          : ''}
        .
      </p>

      <div className="mt-4 min-w-0 space-y-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Stand up / call mom / ship PR…"
          disabled={busy}
          className="w-full min-w-0 rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void add();
          }}
        />
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            inputMode="numeric"
            aria-label="Minutes from now"
            disabled={busy}
            className="w-20 shrink-0 rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
          <span className="text-xs text-muted">minutes from now</span>
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
        {scheduled.length === 0 && (
          <li>
            <EmptyState
              title="Nothing on the clock yet"
              body="Tell me what to ping you about — I’ll use your reminder defaults and fire a Chrome notification when it’s due."
              ctaLabel="Add a reminder"
              onCta={() => inputRef.current?.focus()}
            />
          </li>
        )}
        {scheduled.map((r) => (
          <li
            key={r.id}
            className="flex min-w-0 items-start justify-between gap-2 rounded-xl border border-border-subtle bg-panel/50 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="break-words text-sm text-fg [overflow-wrap:anywhere]">{r.text}</div>
              <div className="mt-0.5 text-[11px] text-muted">
                {new Date(r.when).toLocaleString()} · {r.status}
                {r.repeat !== 'none' ? ` · recurring ${r.repeat}` : ''}
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

const FREQUENCY_OPTIONS: Array<{ value: NotificationFrequency; label: string }> = [
  { value: 'off', label: 'Off — no proactive nudges' },
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
];

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
      partial.briefingMinute !== undefined ||
      partial.eveningRecapEnabled !== undefined ||
      partial.eveningRecapHour !== undefined ||
      partial.eveningRecapMinute !== undefined
    ) {
      requestBriefingReschedule();
    }
  };

  const sensitivity = sensitivityFromThresholdMs(settings.nudgeThresholdMs);

  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
      <h2 className="font-display text-lg text-fg">Phil settings</h2>
      <p className="mt-1 text-xs text-muted">
        FAB, focus, nudges, notification frequency, and reminder defaults.
      </p>

      <div className="mt-4 min-w-0 space-y-3">
        {(
          [
            ['fabEnabled', 'Always-on page button'],
            ['trackingEnabled', 'Track tab focus time'],
            ['nudgesEnabled', 'Off-task nudges'],
            ['briefingEnabled', 'Morning briefing'],
            ['eveningRecapEnabled', 'Evening recap'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex min-w-0 items-center justify-between gap-3 text-sm">
            <span className="min-w-0 text-fg-dim">{label}</span>
            <input
              type="checkbox"
              checked={Boolean(settings[key])}
              onChange={(e) => void update({ [key]: e.target.checked })}
            />
          </label>
        ))}

        <label className="block min-w-0 text-sm">
          <span className="text-muted">Notification frequency</span>
          <select
            value={settings.notificationFrequency}
            onChange={(e) =>
              void update({ notificationFrequency: e.target.value as NotificationFrequency })
            }
            className="mt-1 w-full min-w-0 rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] text-muted">
            Off blocks proactive creation. Low vs high changes the hourly cap.
          </span>
        </label>

        <label className="block min-w-0 text-sm">
          <span className="text-muted">Productivity sensitivity</span>
          <select
            value={sensitivity}
            onChange={(e) => {
              const preset = e.target.value as SensitivityPreset;
              void update({ nudgeThresholdMs: SENSITIVITY_PRESETS[preset] });
            }}
            className="mt-1 w-full min-w-0 rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          >
            <option value="strict">Strict — nudge sooner</option>
            <option value="balanced">Balanced</option>
            <option value="chill">Chill — more patience</option>
          </select>
          <span className="mt-1 block text-[11px] text-muted">
            Nudge threshold: {Math.round(settings.nudgeThresholdMs / 1000)}s leisure
          </span>
        </label>

        <fieldset className="min-w-0 space-y-2 rounded-xl border border-border-subtle px-3 py-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">
            Reminder defaults
          </legend>
          <label className="block text-sm">
            <span className="text-muted">Default lead (minutes)</span>
            <input
              type="number"
              min={1}
              max={24 * 60}
              value={settings.reminderDefaultLeadMinutes}
              onChange={(e) =>
                void update({
                  reminderDefaultLeadMinutes: Math.max(1, Number(e.target.value) || 30),
                })
              }
              className="mt-1 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Default repeat</span>
            <select
              value={settings.reminderDefaultRepeat}
              onChange={(e) =>
                void update({
                  reminderDefaultRepeat: e.target.value as Reminder['repeat'],
                })
              }
              className="mt-1 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
            >
              <option value="none">None</option>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
            </select>
          </label>
        </fieldset>

        <fieldset className="min-w-0 space-y-2 rounded-xl border border-border-subtle px-3 py-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-muted">
            Quiet hours
          </legend>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="text-fg-dim">Suppress notifications</span>
            <input
              type="checkbox"
              checked={settings.quietHoursEnabled}
              onChange={(e) => void update({ quietHoursEnabled: e.target.checked })}
            />
          </label>
          <div className="flex min-w-0 gap-2">
            <label className="min-w-0 flex-1 text-sm">
              <span className="text-muted">Start hour</span>
              <input
                type="number"
                min={0}
                max={23}
                value={settings.quietHoursStartHour}
                onChange={(e) =>
                  void update({
                    quietHoursStartHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="mt-1 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
            </label>
            <label className="min-w-0 flex-1 text-sm">
              <span className="text-muted">End hour</span>
              <input
                type="number"
                min={0}
                max={23}
                value={settings.quietHoursEndHour}
                onChange={(e) =>
                  void update({
                    quietHoursEndHour: Math.min(23, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                className="mt-1 w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
              />
            </label>
          </div>
          <p className="text-[11px] text-muted">
            Uses your device clock. Reminders stay stored; delivery waits until quiet hours end.
          </p>
        </fieldset>

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
          <span className="text-muted">Evening recap hour (local)</span>
          <input
            type="number"
            min={0}
            max={23}
            value={settings.eveningRecapHour}
            onChange={(e) => void update({ eveningRecapHour: Number(e.target.value) })}
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

        <p className="text-[11px] leading-relaxed text-muted">
          Example: “Remind me tomorrow at 3 PM” schedules against your device clock — there is no
          separate picker here.
        </p>
      </div>
    </div>
  );
}
