/**
 * Unit checks for device-TZ absolute reminder parsing (SET-08).
 */
import assert from 'node:assert/strict';
import {
  localPartsInDeviceTz,
  parseAbsoluteReminder,
  zonedLocalToUtcMs,
} from './deviceTime.ts';

const tz = 'America/Chicago';
const now = new Date('2026-08-07T15:00:00-05:00'); // Fri afternoon CDT

const parsed = parseAbsoluteReminder('Remind me tomorrow at 3 PM', now, tz);
assert.ok(parsed, 'parses tomorrow at 3 PM');
const parts = localPartsInDeviceTz(new Date(parsed!.when), tz);
assert.equal(parts.hour, 15, `expected 15:00 local, got ${parts.hour}`);
assert.equal(parts.minute, 0);
assert.equal(parts.day, 8, `expected Aug 8, got day ${parts.day}`);

const noon = parseAbsoluteReminder('Remind me tomorrow at noon to stretch', now, tz);
assert.ok(noon);
assert.match(noon!.text, /stretch/i);
const noonParts = localPartsInDeviceTz(new Date(noon!.when), tz);
assert.equal(noonParts.hour, 12);

const relative = parseAbsoluteReminder('Remind me in 20 minutes to stand', now, tz);
assert.equal(relative, null, 'relative phrases stay for parseReminderInMinutes');

const wall = zonedLocalToUtcMs(2026, 8, 8, 15, 0, 0, tz);
const wallParts = localPartsInDeviceTz(new Date(wall), tz);
assert.equal(wallParts.hour, 15);
assert.equal(wallParts.day, 8);

console.log('deviceTime.test.ts: ok');
