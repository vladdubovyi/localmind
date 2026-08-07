import assert from 'node:assert/strict';
import {
  isBriefingGoal,
  isFocusStatusGoal,
  isForgetGoal,
  isGoalSetupGoal,
  isLiveInfoGoal,
  isRecallGoal,
  isRememberGoal,
  isReminderGoal,
  isWeatherGoal,
  isWebResearchGoal,
  offersToActWithoutTools,
  parseGoalTitle,
  parseRecallQuery,
  parseRememberText,
  parseReminderInMinutes,
  parseReminderText,
  weatherPlaceFromQuery,
} from './assistantIntent.ts';

assert.equal(isReminderGoal('Remind me in 20 minutes to stretch'), true);
assert.equal(parseReminderInMinutes('Remind me in 20 minutes to stretch'), 20);
assert.equal(parseReminderInMinutes('Ping me after 2 hours'), 120);
assert.equal(parseReminderText('Remind me in 20 minutes to stretch'), 'stretch');
assert.equal(parseReminderText('Remind me to call mom in 1 hour'), 'call mom');
assert.equal(
  parseReminderText('Set up a reminder to call my mom in 5 minutes'),
  'call my mom',
);
assert.equal(parseReminderInMinutes('Set up a reminder to call my mom in 5 minutes'), 5);
assert.equal(parseGoalTitle('Set a goal to finish the proposal'), 'finish the proposal');
assert.equal(isGoalSetupGoal('Set a goal to finish the proposal'), true);
assert.equal(isFocusStatusGoal('How much productive time today?'), true);
assert.equal(isBriefingGoal("What's up today?"), true);
assert.equal(isWebResearchGoal('Research noise-cancelling headphones under $100'), true);
assert.equal(isWebResearchGoal('List my last 5 emails'), false);
assert.equal(isLiveInfoGoal('What is the weather today?'), true);
assert.equal(isWeatherGoal('What is the weather today?'), true);
assert.equal(isWebResearchGoal('What is the weather today?'), true);
assert.equal(isLiveInfoGoal('List my last 5 emails'), false);
assert.equal(weatherPlaceFromQuery('What is the weather today?', 'Austin TX'), 'Austin TX');
assert.equal(weatherPlaceFromQuery('weather in Paris today', 'Austin TX'), 'Paris');
assert.equal(
  offersToActWithoutTools(
    "I don't have direct access to weather information. Would you like me to open one for you?",
  ),
  true,
);
assert.equal(offersToActWithoutTools('Austin is currently 84°F and sunny.'), false);

assert.equal(isRememberGoal('Remember that I prefer morning briefings at 7.'), true);
assert.equal(parseRememberText('Remember that I prefer morning briefings at 7.'), 'I prefer morning briefings at 7');
assert.equal(isRecallGoal('What did I ask you to remember about briefings?'), true);
assert.equal(parseRecallQuery('What did I ask you to remember about briefings?'), 'briefings');
assert.equal(isForgetGoal('Forget that I prefer morning briefings at 7.'), true);
assert.equal(isRememberGoal('What did I ask you to remember about briefings?'), false);

console.log('agent/assistantIntent.test.ts OK');
