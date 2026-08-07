import type {
  Goal,
  MorningBriefing,
  PhilAssistantSettings,
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

export async function getBriefingByDate(dateKey: string): Promise<MorningBriefing | undefined> {
  const all = await getLocal<MorningBriefing[]>(KEYS.briefings, []);
  return all
    .filter((b) => b.dateKey === dateKey)
    .sort((a, b) => b.createdAt - a.createdAt)[0];
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
