/**
 * Device / browser timezone helpers. Product has no TZ picker — always Intl.
 */

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** Local calendar parts in the device timezone. */
export function localPartsInDeviceTz(
  date: Date = new Date(),
  timeZone: string = deviceTimeZone(),
): { year: number; month: number; day: number; hour: number; minute: number; weekday: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '0';
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    hour,
    minute: Number(get('minute')),
    weekday: get('weekday'),
  };
}

/**
 * Build an epoch ms for a local wall time in the device timezone.
 * Uses iterative correction so DST transitions stay correct.
 */
export function zonedLocalToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  timeZone: string = deviceTimeZone(),
): number {
  let utc = Date.UTC(year, month - 1, day, hour, minute, second);
  for (let i = 0; i < 3; i++) {
    const parts = localPartsInDeviceTz(new Date(utc), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      second,
    );
    const targetAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
    utc += targetAsUtc - asUtc;
  }
  return utc;
}

export type AbsoluteReminderParse = {
  when: number;
  text: string;
};

/**
 * Parse absolute phrases like “Remind me tomorrow at 3 PM” in device TZ.
 * Returns null when only relative (“in 20 minutes”) or unmatched.
 */
export function parseAbsoluteReminder(
  goal: string,
  now: Date = new Date(),
  timeZone: string = deviceTimeZone(),
): AbsoluteReminderParse | null {
  const raw = goal.trim();
  if (!raw) return null;

  const lower = raw.toLowerCase();
  const looksLikeReminder =
    /\b(remind|reminder|alarm|ping me)\b/i.test(lower) ||
    /\b(at\s+\d{1,2}|noon|midnight|\d{1,2}\s*(am|pm))\b/i.test(lower);
  if (!looksLikeReminder) return null;

  const partsNow = localPartsInDeviceTz(now, timeZone);

  let dayOffset = 0;
  let matchedDay = false;
  if (/\btomorrow\b/i.test(lower)) {
    dayOffset = 1;
    matchedDay = true;
  } else if (/\btoday\b/i.test(lower)) {
    dayOffset = 0;
    matchedDay = true;
  }

  const clock = raw.match(
    /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\bat\s+(\d{1,2})(?::(\d{2}))?\b|\b(noon|midnight)\b/i,
  );
  // Require an explicit clock for absolute scheduling (avoid “today” alone matching focus asks).
  if (!clock) return null;

  let hour = 15;
  let minute = 0;
  if (clock) {
    if (clock[6]) {
      const word = clock[6].toLowerCase();
      hour = word === 'noon' ? 12 : 0;
      minute = 0;
    } else if (clock[1] != null) {
      hour = Number(clock[1]);
      minute = clock[2] != null ? Number(clock[2]) : 0;
      const mer = (clock[3] || '').toLowerCase();
      if (mer === 'pm' && hour < 12) hour += 12;
      if (mer === 'am' && hour === 12) hour = 0;
    } else if (clock[4] != null) {
      hour = Number(clock[4]);
      minute = clock[5] != null ? Number(clock[5]) : 0;
    }
  } else if (matchedDay) {
    hour = 9;
    minute = 0;
  }

  const baseUtc = zonedLocalToUtcMs(
    partsNow.year,
    partsNow.month,
    partsNow.day,
    12,
    0,
    0,
    timeZone,
  );
  const targetDay = new Date(baseUtc + dayOffset * 24 * 60 * 60_000);
  const dayParts = localPartsInDeviceTz(targetDay, timeZone);
  let when = zonedLocalToUtcMs(
    dayParts.year,
    dayParts.month,
    dayParts.day,
    hour,
    minute,
    0,
    timeZone,
  );

  if (dayOffset === 0 && when <= now.getTime()) {
    const next = new Date(baseUtc + 24 * 60 * 60_000);
    const np = localPartsInDeviceTz(next, timeZone);
    when = zonedLocalToUtcMs(np.year, np.month, np.day, hour, minute, 0, timeZone);
  }

  let text = raw;
  text = text.replace(/^(please\s+)?(can you\s+)?/i, '');
  text = text.replace(
    /^(remind\s+me|set(\s+up)?\s+(a\s+)?reminder|ping\s+me|alarm\s+me)\s*/i,
    '',
  );
  text = text.replace(/\b(tomorrow|today)\b/gi, '');
  text = text.replace(
    /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b|\bat\s+\d{1,2}(?::\d{2})?\b|\b(noon|midnight)\b/gi,
    '',
  );
  text = text.replace(/^(to|that|about|at)\s+/i, '');
  text = text.replace(/\s+/g, ' ').replace(/\.$/, '').trim();

  return { when, text: text || raw.trim() };
}

/** Format a fire time with device timezone label for UI copy. */
export function formatInDeviceTz(
  whenMs: number,
  timeZone: string = deviceTimeZone(),
): string {
  return new Intl.DateTimeFormat(undefined, {
    timeZone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(whenMs));
}
