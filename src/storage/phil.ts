import type {
  Goal,
  MorningBriefing,
  PhilAssistantSettings,
  ProactiveSuggestion,
  Reminder,
  TabActivitySession,
} from '@/phil/types';
import { DEFAULT_PHIL_SETTINGS } from '@/phil/types';

/**
 * Phil PA persistence via chrome.storage.local.
 * Prefer storage.local over IndexedDB so the MV3 service worker can read/write
 * reliably (IDB open can hang or race during SW wake).
 */

const KEYS = {
  settings: 'philSettings',
  reminders: 'philReminders',
  goals: 'philGoals',
  activity: 'philTabActivity',
  briefings: 'philBriefings',
  suggestions: 'philSuggestions',
  deliveryLog: 'philNotificationDeliveries',
} as const;

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const stored = await chrome.storage.local.get(key);
  const value = stored[key];
  return (value as T | undefined) ?? fallback;
}

async function setLocal(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export async function getPhilSettings(): Promise<PhilAssistantSettings> {
  const stored = await getLocal<Partial<PhilAssistantSettings> | undefined>(
    KEYS.settings,
    undefined,
  );
  return { ...DEFAULT_PHIL_SETTINGS, ...stored };
}

export async function savePhilSettings(
  partial: Partial<PhilAssistantSettings>,
): Promise<PhilAssistantSettings> {
  const current = await getPhilSettings();
  const next = {
    ...current,
    ...partial,
    categoryOverrides: {
      ...current.categoryOverrides,
      ...partial.categoryOverrides,
    },
  };
  await setLocal(KEYS.settings, next);
  return next;
}

export async function listReminders(): Promise<Reminder[]> {
  const all = await getLocal<Reminder[]>(KEYS.reminders, []);
  return [...all].sort((a, b) => a.when - b.when);
}

export async function putReminder(reminder: Reminder): Promise<void> {
  const all = await listReminders();
  const idx = all.findIndex((r) => r.id === reminder.id);
  if (idx >= 0) all[idx] = reminder;
  else all.push(reminder);
  await setLocal(KEYS.reminders, all);
}

export async function getReminder(id: string): Promise<Reminder | undefined> {
  const all = await listReminders();
  return all.find((r) => r.id === id);
}

export async function deleteReminder(id: string): Promise<void> {
  const all = await listReminders();
  await setLocal(
    KEYS.reminders,
    all.filter((r) => r.id !== id),
  );
}

export async function listGoals(): Promise<Goal[]> {
  const all = await getLocal<Goal[]>(KEYS.goals, []);
  return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putGoal(goal: Goal): Promise<void> {
  const all = await listGoals();
  const idx = all.findIndex((g) => g.id === goal.id);
  if (idx >= 0) all[idx] = goal;
  else all.push(goal);
  await setLocal(KEYS.goals, all);
}

export async function getGoal(id: string): Promise<Goal | undefined> {
  const all = await listGoals();
  return all.find((g) => g.id === id);
}

export async function putTabActivity(session: TabActivitySession): Promise<void> {
  const all = await getLocal<TabActivitySession[]>(KEYS.activity, []);
  all.push(session);
  // Cap history so storage stays bounded (~2 weeks of coarse sessions).
  const trimmed = all.length > 2000 ? all.slice(all.length - 2000) : all;
  await setLocal(KEYS.activity, trimmed);
}

export async function listTabActivitySince(sinceMs: number): Promise<TabActivitySession[]> {
  const all = await getLocal<TabActivitySession[]>(KEYS.activity, []);
  return all.filter((s) => s.startedAt >= sinceMs);
}

export async function putBriefing(briefing: MorningBriefing): Promise<void> {
  const all = await getLocal<MorningBriefing[]>(KEYS.briefings, []);
  all.push(briefing);
  const trimmed = all.length > 60 ? all.slice(all.length - 60) : all;
  await setLocal(KEYS.briefings, trimmed);
}

export async function getBriefingByDate(
  dateKey: string,
  kind?: MorningBriefing['kind'],
): Promise<MorningBriefing | undefined> {
  const all = await getLocal<MorningBriefing[]>(KEYS.briefings, []);
  return all
    .filter((b) => b.dateKey === dateKey && (kind ? (b.kind ?? 'morning') === kind : true))
    .sort((a, b) => b.createdAt - a.createdAt)[0];
}

export async function listSuggestions(): Promise<ProactiveSuggestion[]> {
  const all = await getLocal<ProactiveSuggestion[]>(KEYS.suggestions, []);
  return [...all].sort((a, b) => b.createdAt - a.createdAt);
}

export async function putSuggestion(suggestion: ProactiveSuggestion): Promise<void> {
  const all = await listSuggestions();
  const idx = all.findIndex((s) => s.id === suggestion.id);
  if (idx >= 0) all[idx] = suggestion;
  else all.push(suggestion);
  const trimmed = all.length > 80 ? all.slice(0, 80) : all;
  await setLocal(KEYS.suggestions, trimmed);
}

export async function getSuggestion(id: string): Promise<ProactiveSuggestion | undefined> {
  return (await listSuggestions()).find((s) => s.id === id);
}

export async function listVisibleSuggestions(now = Date.now()): Promise<ProactiveSuggestion[]> {
  const all = await listSuggestions();
  const visible: ProactiveSuggestion[] = [];
  for (const s of all) {
    if (s.status === 'dismissed' || s.status === 'accepted') continue;
    if (s.status === 'snoozed') {
      if (s.snoozeUntil != null && s.snoozeUntil <= now) {
        const reactivated: ProactiveSuggestion = {
          ...s,
          status: 'active',
          snoozeUntil: undefined,
          updatedAt: now,
        };
        await putSuggestion(reactivated);
        visible.push(reactivated);
      }
      continue;
    }
    if (s.status === 'active') visible.push(s);
  }
  return visible;
}

export async function recordNotificationDelivery(atMs = Date.now()): Promise<void> {
  const all = await getLocal<number[]>(KEYS.deliveryLog, []);
  all.push(atMs);
  const cutoff = atMs - 60 * 60_000;
  await setLocal(KEYS.deliveryLog, all.filter((t) => t >= cutoff));
}

export async function countDeliveriesInWindow(windowMs = 60 * 60_000, now = Date.now()): Promise<number> {
  const all = await getLocal<number[]>(KEYS.deliveryLog, []);
  return all.filter((t) => t >= now - windowMs).length;
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfLocalDay(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
