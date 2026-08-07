import assert from 'node:assert/strict';
import {
  isBriefingGoal,
  isFocusStatusGoal,
  isGoalSetupGoal,
  isReminderGoal,
  isWebResearchGoal,
  parseReminderInMinutes,
} from './assistantIntent.ts';

assert.equal(isReminderGoal('Remind me in 20 minutes to stretch'), true);
assert.equal(parseReminderInMinutes('Remind me in 20 minutes to stretch'), 20);
assert.equal(parseReminderInMinutes('Ping me after 2 hours'), 120);
assert.equal(isGoalSetupGoal('Set a goal to finish the proposal'), true);
assert.equal(isFocusStatusGoal('How much productive time today?'), true);
assert.equal(isBriefingGoal("What's up today?"), true);
assert.equal(isWebResearchGoal('Research noise-cancelling headphones under $100'), true);
assert.equal(isWebResearchGoal('List my last 5 emails'), false);

console.log('agent/assistantIntent.test.ts OK');
