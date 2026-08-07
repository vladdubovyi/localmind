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
import { composeBriefingContent } from '@/background/phil/focusTracker';

const REMINDER_ALARM_PREFIX = 'phil-reminder:';
const BRIEFING_ALARM = 'phil-morning-briefing';

export function reminderAlarmName(id: string): string {
  return `${REMINDER_ALARM_PREFIX}${id}`;
}

export async function scheduleReminderAlarm(reminder: Reminder): Promise<void> {
  if (reminder.status !== 'scheduled') return;
  const delay = reminder.when - Date.now();
  if (delay <= 0) {
    await fireReminder(reminder.id);
    return;
  }
  await chrome.alarms.create(reminderAlarmName(reminder.id), {
    when: reminder.when,
  });
}

export async function cancelReminderAlarm(id: string): Promise<void> {
  await chrome.alarms.clear(reminderAlarmName(id));
}

export async function createReminder(input: {
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
  // Never block tool/UI callers on chrome.alarms — schedule best-effort.
  void scheduleReminderAlarm(reminder).catch(() => undefined);
  return reminder;
}

export async function cancelReminder(id: string): Promise<Reminder | undefined> {
  const existing = await getReminder(id);
  if (!existing) return undefined;
  const next: Reminder = {
    ...existing,
    status: 'cancelled',
    updatedAt: Date.now(),
  };
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
  // weekdays
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d.getTime();
}

export async function fireReminder(id: string): Promise<void> {
  const reminder = await getReminder(id);
  if (!reminder || reminder.status === 'cancelled' || reminder.status === 'done') {
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
    // ignore missing permission
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
    await putReminder({
      ...reminder,
      status: 'fired',
      updatedAt: Date.now(),
    });
  }
}

export async function rescheduleAllReminders(): Promise<void> {
  const reminders = await listReminders();
  for (const r of reminders) {
    if (r.status === 'scheduled') {
      await scheduleReminderAlarm(r);
    }
  }
}

export async function scheduleMorningBriefingAlarm(): Promise<void> {
  const settings = await getPhilSettings();
  if (!settings.briefingEnabled) {
    await chrome.alarms.clear(BRIEFING_ALARM);
    return;
  }
  const now = new Date();
  const next = new Date();
  next.setHours(settings.briefingHour, settings.briefingMinute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  await chrome.alarms.create(BRIEFING_ALARM, {
    when: next.getTime(),
    periodInMinutes: 24 * 60,
  });
}

export async function runMorningBriefing(): Promise<void> {
  const settings = await getPhilSettings();
  if (!settings.briefingEnabled) return;
  const composed = await composeBriefingContent();
  const briefing = {
    id: uid('brief'),
    dateKey: localDateKey(),
    content: composed.content,
    createdAt: Date.now(),
    sources: composed.sources,
  };
  await putBriefing(briefing);
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
  await chrome.storage.session.set({
    philQuickIntent: {
      kind: 'open_today',
      createdAt: Date.now(),
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
      if (alarm.name.startsWith(REMINDER_ALARM_PREFIX)) {
        const id = alarm.name.slice(REMINDER_ALARM_PREFIX.length);
        await fireReminder(id);
      }
    })();
  });

  chrome.notifications.onClicked.addListener((notificationId) => {
    void (async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.windowId != null) {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      }
      if (notificationId.includes('briefing')) {
        await chrome.storage.session.set({
          philQuickIntent: { kind: 'open_today', createdAt: Date.now() },
        });
      } else if (notificationId.includes('reminder')) {
        await chrome.storage.session.set({
          philQuickIntent: { kind: 'open_reminders', createdAt: Date.now() },
        });
      } else if (notificationId.includes('nudge')) {
        await chrome.storage.session.set({
          philQuickIntent: { kind: 'open_goals', createdAt: Date.now() },
        });
      }
    })();
  });

  void rescheduleAllReminders();
  void scheduleMorningBriefingAlarm();
}
