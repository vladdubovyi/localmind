/**
 * Unit checks for reminder schedule + conflict detection (WF-04/09/18, SET-08).
 */
import assert from 'node:assert/strict';
import {
  findReminderConflicts,
  parseReminderSchedule,
} from './reminderSchedule.ts';
import type { Reminder } from './types.ts';
import { localPartsInDeviceTz } from './deviceTime.ts';

const tz = 'America/Chicago';
// Friday Aug 7, 2026 afternoon CDT
const now = new Date('2026-08-07T15:00:00-05:00');

const landlord = parseReminderSchedule(
  'Remind me to call my landlord next Tuesday at 3 PM.',
  now,
  tz,
);
assert.ok(landlord, 'parses next Tuesday at 3 PM');
assert.match(landlord!.text, /landlord/i);
const lp = localPartsInDeviceTz(new Date(landlord!.when), tz);
assert.equal(lp.hour, 15);
assert.equal(lp.weekday.toLowerCase().startsWith('tue'), true);
assert.equal(landlord!.repeat, 'none');

const friday = parseReminderSchedule(
  'Remind me every Friday to review my finances.',
  now,
  tz,
);
assert.ok(friday);
assert.equal(friday!.repeat, 'weekly');
assert.equal(friday!.repeatWeekday, 5);
assert.match(friday!.text, /finances/i);

const gym = parseReminderSchedule(
  'Remind me to go to the gym every weekday at 18:00.',
  now,
  tz,
);
assert.ok(gym);
assert.equal(gym!.repeat, 'weekdays');
const gp = localPartsInDeviceTz(new Date(gym!.when), tz);
assert.equal(gp.hour, 18);

const lang = parseReminderSchedule(
  'Every Tuesday at 18:00 remind me to attend my language class.',
  now,
  tz,
);
assert.ok(lang);
assert.equal(lang!.repeat, 'weekly');
assert.equal(lang!.repeatWeekday, 2);

const gymReminder: Reminder = {
  id: 'rem-gym',
  text: 'go to the gym',
  when: gym!.when,
  repeat: 'weekdays',
  status: 'scheduled',
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
const conflicts = findReminderConflicts(
  {
    when: lang!.when,
    text: lang!.text,
    repeat: lang!.repeat,
    repeatWeekday: lang!.repeatWeekday,
  },
  [gymReminder],
  tz,
);
assert.ok(conflicts.length >= 1, 'detects gym vs language class conflict');
assert.match(conflicts[0]!.message, /conflict|reschedule/i);

console.log('reminderSchedule.test.ts: ok');
