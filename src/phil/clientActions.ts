/**
 * UI-safe Phil mutations. Storage writes happen immediately; alarm scheduling
 * is best-effort via the service worker so the sidebar never blocks on
 * chrome.alarms (which can hang the page context).
 */
import type { PersistentProject, ProjectTemplate } from '@/phil/projectTypes';
import type { Goal, Reminder } from '@/phil/types';
import {
  getGoal,
  getPhilSettings,
  getReminder,
  putGoal,
  putReminder,
  uid,
} from '@/storage/phil';
import {
  createProject,
  getActiveProjectId,
  inferProjectTemplate,
  linkGoalToProject,
  linkReminderToProject,
} from '@/storage/projects';

function notifySw(message: Record<string, unknown>): void {
  try {
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    // SW may be asleep / unavailable — data is already persisted
  }
}

export async function createReminderFromUi(input: {
  text: string;
  when?: number;
  repeat?: Reminder['repeat'];
  projectId?: string;
  /** When true (default), apply Phil reminder defaults for omitted fields. */
  applyDefaults?: boolean;
}): Promise<Reminder> {
  const settings = await getPhilSettings();
  const applyDefaults = input.applyDefaults !== false;
  const now = Date.now();
  const projectId = input.projectId ?? (await getActiveProjectId()) ?? undefined;
  const when =
    input.when ??
    (applyDefaults ? now + settings.reminderDefaultLeadMinutes * 60_000 : now + 30 * 60_000);
  const repeat =
    input.repeat ?? (applyDefaults ? settings.reminderDefaultRepeat : 'none');
  const reminder: Reminder = {
    id: uid('rem'),
    text: input.text.trim(),
    when,
    repeat,
    status: 'scheduled',
    createdAt: now,
    updatedAt: now,
    projectId,
  };
  await putReminder(reminder);
  if (projectId) {
    await linkReminderToProject(projectId, reminder.id);
  }
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

export async function createGoalFromUi(
  title: string,
  opts?: { projectId?: string },
): Promise<Goal> {
  const now = Date.now();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const projectId = opts?.projectId ?? (await getActiveProjectId()) ?? undefined;
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
    projectId,
  };
  await putGoal(goal);
  if (projectId) {
    await linkGoalToProject(projectId, goal.id);
  }
  return goal;
}

/**
 * Create a Persistent Project (+ linked goal/milestone) from UI or NL (PRJ-01).
 */
export async function createProjectFromUi(input: {
  title: string;
  template?: ProjectTemplate;
  makeActive?: boolean;
  utterance?: string;
}): Promise<{ project: PersistentProject; goal: Goal }> {
  const title = input.title.trim();
  const template = input.template ?? inferProjectTemplate(title);
  const project = await createProject({
    title,
    template,
    makeActive: input.makeActive,
    utterance: input.utterance ?? title,
  });
  const goal = await createGoalFromUi(title, { projectId: project.id });
  return { project, goal };
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

export function requestEveningRecap(notify = true): void {
  notifySw({ type: 'PHIL_RUN_EVENING_RECAP', notify });
}

export function requestProactiveTick(harness = false): void {
  notifySw({ type: 'PHIL_RUN_PROACTIVE', harness });
}

export function dismissSuggestionFromUi(id: string): void {
  notifySw({ type: 'PHIL_SUGGESTION_DISMISS', id });
}

export function snoozeSuggestionFromUi(id: string, ms?: number): void {
  notifySw({ type: 'PHIL_SUGGESTION_SNOOZE', id, ms });
}

export function acceptSuggestionFromUi(id: string): void {
  notifySw({ type: 'PHIL_SUGGESTION_ACCEPT', id });
}

