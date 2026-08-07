/**
 * Reminder recurrence + conflict helpers (WF-09, WF-18, SET-08).
 */

import {
  deviceTimeZone,
  formatInDeviceTz,
  localPartsInDeviceTz,
  parseAbsoluteReminder,
  zonedLocalToUtcMs,
} from './deviceTime';
import type { Reminder } from './types';

export type ReminderRepeat = Reminder['repeat'];

const WEEKDAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export type ParsedReminderSchedule = {
  text: string;
  when: number;
  repeat: ReminderRepeat;
  /** 0=Sun … 6=Sat when repeat is weekly */
  repeatWeekday?: number;
  humanWhen: string;
};

function parseClock(goal: string): { hour: number; minute: number } | null {
  const clock = goal.match(
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\bat\s+(\d{1,2})(?::(\d{2}))?\b|\b(\d{1,2}):(\d{2})\b|\b(noon|midnight)\b/i,
  );
  if (!clock) return null;
  if (clock[8]) {
    const word = clock[8].toLowerCase();
    return { hour: word === 'noon' ? 12 : 0, minute: 0 };
  }
  if (clock[1] != null) {
    let hour = Number(clock[1]);
    const minute = clock[2] != null ? Number(clock[2]) : 0;
    const mer = (clock[3] || '').toLowerCase();
    if (mer === 'pm' && hour < 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
    return { hour, minute };
  }
  if (clock[4] != null) {
    return { hour: Number(clock[4]), minute: clock[5] != null ? Number(clock[5]) : 0 };
  }
  if (clock[6] != null) {
    return { hour: Number(clock[6]), minute: Number(clock[7] ?? 0) };
  }
  return null;
}

function nextWeekdayOnOrAfter(
  fromParts: { year: number; month: number; day: number },
  targetDow: number,
  hour: number,
  minute: number,
  nowMs: number,
  timeZone: string,
  /** If true, skip today even when the clock is still in the future. */
  forceFutureDay = false,
): number {
  const baseUtc = zonedLocalToUtcMs(fromParts.year, fromParts.month, fromParts.day, 12, 0, 0, timeZone);
  for (let add = 0; add < 14; add++) {
    const day = new Date(baseUtc + add * 24 * 60 * 60_000);
    const parts = localPartsInDeviceTz(day, timeZone);
    const dow = new Date(
      zonedLocalToUtcMs(parts.year, parts.month, parts.day, 12, 0, 0, timeZone),
    ).getUTCDay();
    // getUTCDay on the noon-UTC-corrected local day: use weekday from Intl instead.
    const weekdayShort = parts.weekday.toLowerCase().slice(0, 3);
    const map: Record<string, number> = {
      sun: 0,
      mon: 1,
      tue: 2,
      wed: 3,
      thu: 4,
      fri: 5,
      sat: 6,
    };
    const localDow = map[weekdayShort] ?? dow;
    if (localDow !== targetDow) continue;
    if (forceFutureDay && add === 0) continue;
    const when = zonedLocalToUtcMs(parts.year, parts.month, parts.day, hour, minute, 0, timeZone);
    if (when > nowMs) return when;
  }
  // Fallback: +7 days from a matching day
  const when = zonedLocalToUtcMs(
    fromParts.year,
    fromParts.month,
    fromParts.day,
    hour,
    minute,
    0,
    timeZone,
  );
  return when + 7 * 24 * 60 * 60_000;
}

function stripReminderLead(raw: string): string {
  let text = raw;
  text = text.replace(/^(please\s+)?(can you\s+)?/i, '');
  text = text.replace(
    /^(remind\s+me|set(\s+up)?\s+(a\s+)?reminder|ping\s+me|alarm\s+me|every\s+\w+)\s*/i,
    '',
  );
  text = text.replace(
    /\b(every\s+(weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|next\s+\w+|tomorrow|today)\b/gi,
    '',
  );
  text = text.replace(
    /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bat\s+\d{1,2}(?::\d{2})?\b|\b\d{1,2}:\d{2}\b|\b(noon|midnight)\b/gi,
    '',
  );
  text = text.replace(/^(to|that|about|at)\s+/i, '');
  text = text.replace(/\s+/g, ' ').replace(/\.$/, '').trim();
  return text;
}

/**
 * Parse absolute + recurring reminder phrases in device TZ.
 * Supports: tomorrow/today, next Tuesday, every Friday, every weekday at 18:00.
 */
export function parseReminderSchedule(
  goal: string,
  now: Date = new Date(),
  timeZone: string = deviceTimeZone(),
): ParsedReminderSchedule | null {
  const raw = goal.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const looksLikeReminder =
    /\b(remind|reminder|alarm|ping me)\b/i.test(lower) ||
    /\bevery\s+(weekday|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(lower);
  if (!looksLikeReminder) return null;

  const clock = parseClock(raw);
  const partsNow = localPartsInDeviceTz(now, timeZone);

  // every weekday / every Friday …
  const everyWeekday = /\bevery\s+weekday\b/i.test(lower);
  const everyDayMatch = lower.match(
    /\bevery\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
  );

  if (everyWeekday) {
    const hour = clock?.hour ?? 9;
    const minute = clock?.minute ?? 0;
    // Next weekday (Mon–Fri) at clock
    let when = 0;
    for (let add = 0; add < 8; add++) {
      const day = new Date(
        zonedLocalToUtcMs(partsNow.year, partsNow.month, partsNow.day, 12, 0, 0, timeZone) +
          add * 24 * 60 * 60_000,
      );
      const p = localPartsInDeviceTz(day, timeZone);
      const map: Record<string, number> = {
        sun: 0,
        mon: 1,
        tue: 2,
        wed: 3,
        thu: 4,
        fri: 5,
        sat: 6,
      };
      const dow = map[p.weekday.toLowerCase().slice(0, 3)] ?? 0;
      if (dow === 0 || dow === 6) continue;
      const candidate = zonedLocalToUtcMs(p.year, p.month, p.day, hour, minute, 0, timeZone);
      if (candidate > now.getTime()) {
        when = candidate;
        break;
      }
    }
    const text = stripReminderLead(raw) || 'weekday reminder';
    return {
      text,
      when,
      repeat: 'weekdays',
      humanWhen: formatInDeviceTz(when, timeZone),
    };
  }

  if (everyDayMatch) {
    const hour = clock?.hour ?? 9;
    const minute = clock?.minute ?? 0;
    const targetDow = WEEKDAY_NAMES.indexOf(
      everyDayMatch[1].toLowerCase() as (typeof WEEKDAY_NAMES)[number],
    );
    const when = nextWeekdayOnOrAfter(
      partsNow,
      targetDow,
      hour,
      minute,
      now.getTime(),
      timeZone,
    );
    const text = stripReminderLead(raw) || `${everyDayMatch[1]} reminder`;
    return {
      text,
      when,
      repeat: 'weekly',
      repeatWeekday: targetDow,
      humanWhen: formatInDeviceTz(when, timeZone),
    };
  }

  // next Tuesday / next Friday …
  const nextDow = lower.match(
    /\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i,
  );
  if (nextDow && clock) {
    const targetDow = WEEKDAY_NAMES.indexOf(
      nextDow[1].toLowerCase() as (typeof WEEKDAY_NAMES)[number],
    );
    const when = nextWeekdayOnOrAfter(
      partsNow,
      targetDow,
      clock.hour,
      clock.minute,
      now.getTime(),
      timeZone,
      true, // "next" skips today
    );
    const text = stripReminderLead(raw) || `call on ${nextDow[1]}`;
    return {
      text,
      when,
      repeat: 'none',
      humanWhen: formatInDeviceTz(when, timeZone),
    };
  }

  // Fall back to absolute tomorrow/today parser
  const absolute = parseAbsoluteReminder(raw, now, timeZone);
  if (absolute) {
    return {
      text: absolute.text,
      when: absolute.when,
      repeat: 'none',
      humanWhen: formatInDeviceTz(absolute.when, timeZone),
    };
  }

  return null;
}

export type ReminderConflict = {
  existing: Reminder;
  candidateWhen: number;
  message: string;
};

function dowFromWeekdayLabel(weekday: string): number {
  const map: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  };
  return map[weekday.toLowerCase().slice(0, 3)] ?? -1;
}

/** Detect same local clock-time conflicts (WF-18 gym vs language class). */
export function findReminderConflicts(
  candidate: { when: number; text: string; repeat?: ReminderRepeat; repeatWeekday?: number },
  existing: Reminder[],
  timeZone: string = deviceTimeZone(),
): ReminderConflict[] {
  const candParts = localPartsInDeviceTz(new Date(candidate.when), timeZone);
  const candLocalDow = dowFromWeekdayLabel(candParts.weekday);
  const conflicts: ReminderConflict[] = [];

  for (const r of existing) {
    if (r.status !== 'scheduled') continue;
    const rp = localPartsInDeviceTz(new Date(r.when), timeZone);
    const sameClock = rp.hour === candParts.hour && rp.minute === candParts.minute;
    if (!sameClock) continue;

    const existLocalDow = dowFromWeekdayLabel(rp.weekday);
    const candRepeat = candidate.repeat ?? 'none';
    let overlaps = false;

    // Gym weekdays @ 18:00 vs language class every Tuesday @ 18:00
    if (r.repeat === 'weekdays' && candRepeat === 'weekly' && candidate.repeatWeekday != null) {
      if (candidate.repeatWeekday >= 1 && candidate.repeatWeekday <= 5) overlaps = true;
    }
    if (candRepeat === 'weekdays' && r.repeat === 'weekly' && r.repeatWeekday != null) {
      if (r.repeatWeekday >= 1 && r.repeatWeekday <= 5) overlaps = true;
    }
    if (r.repeat === 'weekdays' && candLocalDow >= 1 && candLocalDow <= 5 && candRepeat !== 'none') {
      overlaps = true;
    }
    if (candRepeat === 'weekdays' && existLocalDow >= 1 && existLocalDow <= 5) overlaps = true;
    if (r.repeat === 'weekly' && r.repeatWeekday != null && r.repeatWeekday === candLocalDow) {
      overlaps = true;
    }
    if (
      candRepeat === 'weekly' &&
      candidate.repeatWeekday != null &&
      (existLocalDow === candidate.repeatWeekday ||
        (r.repeat === 'weekly' && r.repeatWeekday === candidate.repeatWeekday))
    ) {
      overlaps = true;
    }
    if (
      r.repeat === 'none' &&
      candRepeat === 'none' &&
      rp.day === candParts.day &&
      rp.month === candParts.month &&
      rp.year === candParts.year
    ) {
      overlaps = true;
    }

    if (!overlaps) continue;

    const hh = candParts.hour.toString().padStart(2, '0');
    const mm = candParts.minute.toString().padStart(2, '0');
    conflicts.push({
      existing: r,
      candidateWhen: candidate.when,
      message: `Conflict: “${r.text}” is already scheduled at ${formatInDeviceTz(r.when, timeZone)} (${r.repeat}). “${candidate.text}” would also fire at ${hh}:${mm}. Reschedule one, or keep both?`,
    });
  }

  return conflicts;
}
