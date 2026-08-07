/**
 * Unit checks for notification frequency + quiet hours (SET-02/03/06).
 */
import assert from 'node:assert/strict';
import {
  canDeliverNotification,
  isInQuietHours,
  NOTIFICATION_FREQUENCY_CAPS,
  proactiveAllowed,
  SENSITIVITY_PRESETS,
  sensitivityFromThresholdMs,
} from './notificationPolicy.ts';
import { DEFAULT_PHIL_SETTINGS } from './types.ts';

assert.equal(NOTIFICATION_FREQUENCY_CAPS.off, 0);
assert.ok(NOTIFICATION_FREQUENCY_CAPS.high > NOTIFICATION_FREQUENCY_CAPS.low);
assert.equal(proactiveAllowed('off'), false);
assert.equal(proactiveAllowed('normal'), true);

assert.equal(sensitivityFromThresholdMs(SENSITIVITY_PRESETS.strict), 'strict');
assert.equal(sensitivityFromThresholdMs(SENSITIVITY_PRESETS.chill), 'chill');
assert.ok(SENSITIVITY_PRESETS.strict < SENSITIVITY_PRESETS.chill);

const quietOn = {
  ...DEFAULT_PHIL_SETTINGS,
  quietHoursEnabled: true,
  quietHoursStartHour: 22,
  quietHoursEndHour: 7,
};
const evening = new Date('2026-08-07T23:30:00');
assert.equal(isInQuietHours(quietOn, evening), true);
const midday = new Date('2026-08-07T12:00:00');
assert.equal(isInQuietHours(quietOn, midday), false);

assert.equal(
  canDeliverNotification(
    { ...DEFAULT_PHIL_SETTINGS, notificationFrequency: 'off' },
    { now: midday },
  ),
  false,
);
assert.equal(
  canDeliverNotification(
    { ...DEFAULT_PHIL_SETTINGS, notificationFrequency: 'low' },
    { deliveredInWindow: 2, now: midday },
  ),
  false,
);
assert.equal(
  canDeliverNotification(
    { ...DEFAULT_PHIL_SETTINGS, notificationFrequency: 'high' },
    { deliveredInWindow: 2, now: midday },
  ),
  true,
);

console.log('notificationPolicy.test.ts: ok');
