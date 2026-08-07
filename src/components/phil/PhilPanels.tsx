import { useCallback, useEffect, useState } from 'react';
import {
  composeBriefingContent,
  focusSummaryToday,
} from '@/background/phil/focusTracker';
import {
  cancelReminder,
  createReminder,
} from '@/background/phil/reminders';
import type { Goal, MorningBriefing, PhilAssistantSettings, Reminder } from '@/phil/types';
import {
  getBriefingByDate,
  getPhilSettings,
  listGoals,
  listReminders,
  localDateKey,
  putBriefing,
  putGoal,
  savePhilSettings,
  uid,
} from '@/storage/phil';
import { cn } from '@/utils';

function formatMs(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
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
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof focusSummaryToday>> | null>(
    null,
  );

  useEffect(() => {
    void focusSummaryToday().then(setSummary);
    const id = window.setInterval(() => {
      void focusSummaryToday().then(setSummary);
    }, 15_000);
    return () => window.clearInterval(id);
  }, []);

  if (!summary) {
    return <div className="grid h-full place-items-center text-sm text-muted">Loading focus…</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <h2 className="font-display text-lg text-fg">Focus</h2>
      <p className="mt-1 text-xs text-muted">Tab time today · {formatMs(summary.totalMs)} total</p>

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

  const refresh = useCallback(async () => {
    setGoals(await listGoals());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addGoal = async () => {
    const t = title.trim();
    if (!t) return;
    const now = Date.now();
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    await putGoal({
      id: uid('goal'),
      title: t,
      deadline: end.getTime(),
      status: 'active',
      allowedDomains: [],
      blockedDomains: [
        'instagram.com',
        'facebook.com',
        'reddit.com',
        'youtube.com',
        'tiktok.com',
      ],
      createdAt: now,
      updatedAt: now,
    });
    setTitle('');
    await refresh();
  };

  const complete = async (id: string) => {
    const g = goals.find((x) => x.id === id);
    if (!g) return;
    await putGoal({ ...g, status: 'completed', updatedAt: Date.now() });
    await refresh();
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
          className="min-w-0 flex-1 rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addGoal();
          }}
        />
        <button
          type="button"
          onClick={() => void addGoal()}
          className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-ink"
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

  const refresh = useCallback(async () => {
    setReminders(await listReminders());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async () => {
    const t = text.trim();
    const mins = Number(minutes);
    if (!t || !Number.isFinite(mins) || mins < 1) return;
    await createReminder({
      text: t,
      when: Date.now() + mins * 60_000,
      repeat: 'none',
    });
    setText('');
    await refresh();
  };

  const cancel = async (id: string) => {
    await cancelReminder(id);
    await refresh();
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
          className="w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
        />
        <div className="flex gap-2">
          <input
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            inputMode="numeric"
            aria-label="Minutes from now"
            className="w-20 rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
          <span className="self-center text-xs text-muted">minutes from now</span>
          <button
            type="button"
            onClick={() => void add()}
            className="ml-auto rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-ink"
          >
            Remind
          </button>
        </div>
      </div>

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

  useEffect(() => {
    void getPhilSettings().then(setSettings);
  }, []);

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
      const { scheduleMorningBriefingAlarm } = await import('@/background/phil/reminders');
      await scheduleMorningBriefingAlarm();
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
