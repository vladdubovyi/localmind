import assert from 'node:assert/strict';
import { isFactualLookupGoal, rankSkills, routeGoal } from './index.ts';

function route(goal: string, emailIntent?: string | null) {
  return routeGoal({ goal, emailIntent: emailIntent ?? null });
}

assert.equal(route('Remind me in 20 minutes to stretch').skill.id, 'reminder');
assert.equal(route('Set a goal to finish the proposal').skill.id, 'goal');
assert.equal(route('How much productive time today?').skill.id, 'focus');
assert.equal(route("What's up today?").skill.id, 'briefing');
assert.equal(route('What is the weather today?').skill.id, 'live_weather');
assert.equal(route('weather in Paris').skill.id, 'live_weather');
assert.ok(route('What is the weather today?').toolCall?.name === 'web_research');
assert.equal(route('Who won the election yesterday?').skill.id, 'web_lookup');
assert.equal(route('What is the capital of France?').skill.id, 'web_lookup');
assert.ok(route('What is the capital of France?').toolCall?.arguments?.skill === 'web_lookup');
assert.equal(route('Research noise-cancelling headphones under $100').skill.id, 'web_lookup');
assert.equal(route('List my last 5 emails', 'email_list').skill.id, 'gmail');
assert.equal(route('Open https://example.com in a new tab').skill.id, 'open_link');
assert.equal(route('Do you think I should take the job?').skill.id, 'chat');
assert.equal(isFactualLookupGoal('What is Bitcoin worth today?'), true);
assert.equal(isFactualLookupGoal('Remind me in 5 minutes'), false);

const ranked = rankSkills({ goal: 'What is the weather today?' });
assert.ok(ranked[0]?.id === 'live_weather');
assert.ok(ranked.every((r) => r.id !== 'web_lookup' || r.score < ranked[0].score));

console.log('agent/skills/router.test.ts OK');
