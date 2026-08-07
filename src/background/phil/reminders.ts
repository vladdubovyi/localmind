import type { Reminder } from '@/phil/types';
import {
  getPhilSettings,
  getReminder,
  listReminders,
  localDateKey,
  putBriefing,
  putReminder,
  uid,
} from '@/storage/phil';
import { getActiveProjectId, linkReminderToProject } from '@/storage/projects';
import {
  buildEveningBriefingRecord,
  buildMorningBriefingRecord,
} from '@/background/phil/dailyReview';
import { isInQuietHours } from '@/phil/notificationPolicy';

const REMINDER_ALARM_PREFIX = 'phil-reminder:';
const BRIEFING_ALARM = 'phil-morning-briefing';
const EVENING_ALARM = 'phil-evening-recap';
const QUIET_RETRY_ALARM_PREFIX = 'phil-quiet-retry:';

export function reminderAlarmName(id: string): string {
  return `${REMINDER_ALARM_PREFIX}${id}`;
}

function quietRetryAlarmName(id: string): string {
  return `${QUIET_RETRY_ALARM_PREFIX}${id}`;
}

function nextQuietHoursEndMs(endHour: number, now = new Date()): number {
  const end = new Date(now);
  end.setSeconds(0, 0);
  end.setMinutes(0);
  end.setHours(endHour, 0, 0, 0);
  if (end.getTime() <= now.getTime()) end.setDate(end.getDate() + 1);
  return Math.max(end.getTime(), now.getTime() + 60_000);
}

export async function scheduleReminderAlarm(reminder: Reminder): Promise<void> {
  if (reminder.status !== 'scheduled') return;
  const delay = reminder.when - Date.now();
  if (delay <= 0) {
    await fireReminder(reminder.id);
    return;
  }
  await chrome.alarms.create(reminderAlarmName(reminder.id), { when: reminder.when });
}

export async function cancelReminderAlarm(id: string): Promise<void> {
  await chrome.alarms.clear(reminderAlarmName(id));
  await chrome.alarms.clear(quietRetryAlarmName(id));
}

export async function createReminder(input: {
  text: string;
  when?: number;
  repeat?: Reminder['repeat'];
  projectId?: string;
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
  if (projectId) await linkReminderToProject(projectId, reminder.id);
  void scheduleReminderAlarm(reminder).catch(() => undefined);
  return reminder;
}

export async function cancelReminder(id: string): Promise<Reminder | undefined> {
  const existing = await getReminder(id);
  if (!existing) return undefined;
  const next: Reminder = { ...existing, status: 'cancelled', updatedAt: Date.now() };
  await putReminder(next);
  void cancelReminderAlarm(id).catch(() => undefined);
  return next;
}

async function nextRepeatWhen(from: number, repeat: Reminder['repeat']): Promise<number | null> {
  if (repeat === 'none') return null;
  const d = new Date(from);
  if (repeat === 'daily') {
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d.getTime();
}

export async function fireReminder(id: string): Promise<void> {
  const reminder = await getReminder(id);
  if (!reminder || reminder.status === 'cancelled' || reminder.status === 'done') return;

  const settings = await getPhilSettings();
  if (isInQuietHours(settings)) {
    await chrome.alarms.create(quietRetryAlarmName(id), {
      when: nextQuietHoursEndMs(settings.quietHoursEndHour),
    });
    return;
  }

  try {
    await chrome.notifications.create(`phil-reminder-${id}-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Phil reminder',
      message: reminder.text,
      priority: 2,
    });
  } catch {
    // ignore
  }

  const nextWhen = await nextRepeatWhen(reminder.when, reminder.repeat);
  if (nextWhen) {
    const next: Reminder = {
      ...reminder,
      when: nextWhen,
      status: 'scheduled',
      updatedAt: Date.now(),
    };
    await putReminder(next);
    await scheduleReminderAlarm(next);
  } else {
    await putReminder({ ...reminder, status: 'fired', updatedAt: Date.now() });
  }
}

export async function rescheduleAllReminders(): Promise<void> {
  for (const r of await listReminders()) {
    if (r.status === 'scheduled') await scheduleReminderAlarm(r);
  }
}

function nextLocalAlarmMs(hour: number, minute: number, now = new Date()): number {
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next.getTime();
}

export async function scheduleMorningBriefingAlarm(): Promise<void> {
  const settings = await getPhilSettings();
  if (!settings.briefingEnabled) {
    await chrome.alarms.clear(BRIEFING_ALARM);
    return;
  }
  await chrome.alarms.create(BRIEFING_ALARM, {
    when: nextLocalAlarmMs(settings.briefingHour, settings.briefingMinute),
    periodInMinutes: 24 * 60,
  });
}

export async function scheduleEveningRecapAlarm(): Promise<void> {
  const settings = await getPhilSettings();
  if (!settings.eveningRecapEnabled) {
    await chrome.alarms.clear(EVENING_ALARM);
    return;
  }
  await chrome.alarms.create(EVENING_ALARM, {
    when: nextLocalAlarmMs(settings.eveningRecapHour, settings.eveningRecapMinute),
    periodInMinutes: 24 * 60,
  });
}

export async function scheduleDailyReviewAlarms(): Promise<void> {
  await scheduleMorningBriefingAlarm();
  await scheduleEveningRecapAlarm();
}

export async function runMorningBriefing(): Promise<void> {
  const settings = await getPhilSettings();
  if (!settings.briefingEnabled) return;
  const briefing = await buildMorningBriefingRecord();
  await putBriefing(briefing);

  if (!isInQuietHours(settings)) {
    try {
      await chrome.notifications.create(`phil-briefing-${briefing.id}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Phil — morning briefing',
        message: 'Your day overview is ready. Open Phil to see what’s up.',
        priority: 1,
      });
    } catch {
      // ignore
    }
  }

  await chrome.storage.session.set({
    philQuickIntent: { kind: 'open_today', createdAt: Date.now() },
  });
}

export async function runEveningRecap(opts?: { notify?: boolean }): Promise<void> {
  const settings = await getPhilSettings();
  const recap = await buildEveningBriefingRecord();
  if (!recap.dateKey) recap.dateKey = localDateKey();
  await putBriefing(recap);

  const shouldNotify = opts?.notify !== false && settings.eveningRecapEnabled;
  if (shouldNotify && !isInQuietHours(settings)) {
    try {
      await chrome.notifications.create(`phil-evening-${recap.id}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: 'Phil — evening recap',
        message: 'Your evening summary is ready — work completed and priorities for tomorrow.',
        priority: 1,
      });
    } catch {
      // ignore
    }
  }

  await chrome.storage.session.set({
    philQuickIntent: { kind: 'open_today', createdAt: Date.now() },
    philEveningNotification: {
      id: recap.id,
      createdAt: Date.now(),
      message: 'evening notification / evening briefing ready',
    },
  });
}

export function registerPhilAlarms(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    void (async () => {
      if (alarm.name === BRIEFING_ALARM) {
        await runMorningBriefing();
        return;
      }
      if (alarm.name === EVENING_ALARM) {
        await runEveningRecap();
        return;
      }
      if (alarm.name.startsWith(QUIET_RETRY_ALARM_PREFIX)) {
        await fireReminder(alarm.name.slice(QUIET_RETRY_ALARM_PREFIX.length));
        return;
      }
      if (alarm.name.startsWith(REMINDER_ALARM_PREFIX)) {
        await fireReminder(alarm.name.slice(REMINDER_ALARM_PREFIX.length));
      }
    })();
  });

  chrome.notifications.onClicked.addListener((notificationId) => {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId != null) await chrome.sidePanel.open({ windowId: tab.windowId });
      if (notificationId.includes('briefing') || notificationId.includes('evening')) {
        await chrome.storage.session.set({
          philQuickIntent: { kind: 'open_today', createdAt: Date.now() },
        });
      } else if (notificationId.includes('reminder')) {
        await chrome.storage.session.set({
          philQuickIntent: { kind: 'open_reminders', createdAt: Date.now() },
        });
      } else if (notificationId.includes('nudge') || notificationId.includes('proactive')) {
        await chrome.storage.session.set({
          philQuickIntent: { kind: 'open_today', createdAt: Date.now() },
        });
      }
    })();
  });

  void rescheduleAllReminders();
  void scheduleDailyReviewAlarms();
}
