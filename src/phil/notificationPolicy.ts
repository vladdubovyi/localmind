/**
 * Notification frequency + quiet-hours helpers for nudges / proactive delivery.
 * C2 (proactive engine) can import these without owning settings UI.
 */
import type { PhilAssistantSettings } from './types';

export type NotificationFrequency = PhilAssistantSettings['notificationFrequency'];

/** Max proactive / nudge deliveries per rolling hour (device-local). */
export const NOTIFICATION_FREQUENCY_CAPS: Record<NotificationFrequency, number> = {
  off: 0,
  low: 2,
  normal: 6,
  high: 20,
};

/** Productivity sensitivity presets → leisure ms before a goal nudge. */
export const SENSITIVITY_PRESETS = {
  strict: 60_000,
  balanced: 120_000,
  chill: 5 * 60_000,
} as const;

export type SensitivityPreset = keyof typeof SENSITIVITY_PRESETS;

export function sensitivityFromThresholdMs(ms: number): SensitivityPreset {
  if (ms <= SENSITIVITY_PRESETS.strict) return 'strict';
  if (ms >= SENSITIVITY_PRESETS.chill) return 'chill';
  return 'balanced';
}

export function proactiveCapFor(frequency: NotificationFrequency): number {
  return NOTIFICATION_FREQUENCY_CAPS[frequency] ?? NOTIFICATION_FREQUENCY_CAPS.normal;
}

export function proactiveAllowed(frequency: NotificationFrequency): boolean {
  return proactiveCapFor(frequency) > 0;
}

/**
 * Quiet hours in device-local time. Window may wrap midnight
 * (e.g. start=22, end=7).
 */
export function isInQuietHours(
  settings: Pick<
    PhilAssistantSettings,
    'quietHoursEnabled' | 'quietHoursStartHour' | 'quietHoursEndHour'
  >,
  now = new Date(),
): boolean {
  if (!settings.quietHoursEnabled) return false;
  const hour = now.getHours();
  const start = ((settings.quietHoursStartHour % 24) + 24) % 24;
  const end = ((settings.quietHoursEndHour % 24) + 24) % 24;
  if (start === end) return true;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

/**
 * Whether a Chrome notification / proactive suggestion may be delivered now.
 * Does not mutate storage — callers enforce caps via their own counters.
 */
export function canDeliverNotification(
  settings: PhilAssistantSettings,
  options: { deliveredInWindow?: number; now?: Date } = {},
): boolean {
  if (!proactiveAllowed(settings.notificationFrequency)) return false;
  if (isInQuietHours(settings, options.now ?? new Date())) return false;
  const cap = proactiveCapFor(settings.notificationFrequency);
  const delivered = options.deliveredInWindow ?? 0;
  return delivered < cap;
}

/** Minimum gap between nudges scales with frequency (ms). */
export function nudgeCooldownMs(frequency: NotificationFrequency): number {
  switch (frequency) {
    case 'off':
      return Number.POSITIVE_INFINITY;
    case 'low':
      return 30 * 60_000;
    case 'high':
      return 5 * 60_000;
    case 'normal':
    default:
      return 10 * 60_000;
  }
}
