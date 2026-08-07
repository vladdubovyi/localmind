/**
 * UI-safe Phil mutations. Storage writes happen immediately; alarm scheduling
 * is best-effort via the service worker so the sidebar never blocks on
 * chrome.alarms (which can hang the page context).
 */
import type { PersistentProject, ProjectTemplate } from '@/phil/projectTypes';
import type { Goal, Reminder } from '@/phil/types';
import {
  getGoal,
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
  when: number;
  repeat?: Reminder['repeat'];
  projectId?: string;
}): Promise<Reminder> {
  const now = Date.now();
  const projectId = input.projectId ?? (await getActiveProjectId()) ?? undefined;
  const reminder: Reminder = {
    id: uid('rem'),
    text: input.text.trim(),
    when: input.when,
    repeat: input.repeat ?? 'none',
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
}): Promise<{ project: PersistentProject; goal: Goal }> {
  const title = input.title.trim();
  const template = input.template ?? inferProjectTemplate(title);
  const project = await createProject({
    title,
    template,
    makeActive: input.makeActive,
    milestoneTitles: [`Get started on ${title}`],
    statusSummary: `I've set up your ${title} project — next steps tracked in project terms.`,
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
