/**
 * UI-safe Phil mutations. Storage writes happen immediately; alarm scheduling
 * is best-effort via the service worker so the sidebar never blocks on
 * chrome.alarms (which can hang the page context).
 */
import type { Goal, Reminder } from '@/phil/types';
import {
  getGoal,
  getReminder,
  putGoal,
  putReminder,
  uid,
} from '@/storage/phil';

function notifySw(message: Record<string, unknown>): void {
  try {
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    // SW may be asleep / unavailable — data is already persisted
  }
}

export async function createReminderFromUi(input: {
  text: string;
  when: number;
  repeat?: Reminder['repeat'];
}): Promise<Reminder> {
  const now = Date.now();
  const reminder: Reminder = {
    id: uid('rem'),
    text: input.text.trim(),
    when: input.when,
    repeat: input.repeat ?? 'none',
    status: 'scheduled',
    createdAt: now,
    updatedAt: now,
  };
  await putReminder(reminder);
  notifySw({ type: 'PHIL_SCHEDULE_REMINDER', id: reminder.id });
  return reminder;
}

export async function cancelReminderFromUi(id: string): Promise<Reminder | undefined> {
  const existing = await getReminder(id);
  if (!existing) return undefined;
  const next: Reminder = {
    ...existing,
    status: 'cancelled',
    updatedAt: Date.now(),
  };
  await putReminder(next);
  notifySw({ type: 'PHIL_CANCEL_REMINDER', id });
  return next;
}

export async function createGoalFromUi(title: string): Promise<Goal> {
  const now = Date.now();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const goal: Goal = {
    id: uid('goal'),
    title: title.trim(),
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
  };
  await putGoal(goal);
  return goal;
}

export async function completeGoalFromUi(id: string): Promise<Goal | undefined> {
  const goal = await getGoal(id);
  if (!goal) return undefined;
  const next: Goal = { ...goal, status: 'completed', updatedAt: Date.now() };
  await putGoal(next);
  return next;
}

export function requestBriefingReschedule(): void {
  notifySw({ type: 'PHIL_RESCHEDULE_BRIEFING' });
}
