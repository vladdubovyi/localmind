/**
 * Router Factory golden utterances (ADR §11 subset, ≥30).
 * Stage-0/1 only — no WebLLM Stage-2.
 */
import assert from 'node:assert/strict';
import { createRouterFactory } from '../router/factory.ts';
import { registerCoreSkills } from './coreSkills.ts';
import { registerBrowserMemorySkill } from './browserMemorySkill.ts';
import type { PersistentProject } from '../../phil/projectTypes.ts';
import type { RouteContext } from './types.ts';

function makeRouter() {
  const router = createRouterFactory({ defaultSearchEngine: 'google', enableStage2: false });
  registerCoreSkills(router);
  registerBrowserMemorySkill(router);
  return router;
}

function expectSkill(
  utterance: string,
  expected: string | string[],
  ctx: Partial<RouteContext> = {},
) {
  const router = makeRouter();
  const plan = router.routeSync(utterance, {
    goal: utterance,
    utterance,
    testMode: true,
    ...ctx,
  });
  const skills = plan.debug?.skills ?? [];
  const wanted = Array.isArray(expected) ? expected : [expected];
  for (const id of wanted) {
    assert.ok(
      skills.includes(id),
      `expected ${id} in [${skills.join(', ')}] for “${utterance}” (stage=${plan.debug?.stage})`,
    );
  }
  return plan;
}

const jobHuntProject = {
  id: 'proj-jh-1',
  title: 'Job Hunt',
  template: 'job_hunt',
  status: 'active',
  createdAt: 1,
  updatedAt: 1,
  milestones: [],
  linkedGoalIds: [],
  linkedReminderIds: [],
  knowledge: [],
} as PersistentProject;

// --- Goldens (ADR subset) ---
expectSkill('Remind me to call my landlord next Tuesday at 3 PM.', 'reminder.create');
expectSkill('Remind me in 20 minutes to stretch', 'reminder.create');
expectSkill('Remind me every Friday to review my finances.', 'reminder.create');
{
  const plan = expectSkill('Remind me in 20 minutes to stretch', 'reminder.create');
  assert.equal(plan.shortCircuit || plan.lightweight, true);
  assert.ok(plan.debug?.stage === 'stage0' || plan.debug?.stage === 'stage1');
  assert.equal(plan.debug?.llmRouteCalls ?? 0, 0);
}
expectSkill('Set a goal to finish the proposal', 'goal.create');
expectSkill(
  'I want to become a Staff Engineer within 12 months.',
  'project.career_accelerator',
);
expectSkill(
  'I want a remote backend job paying at least €120k.',
  'project.job_hunt',
);
expectSkill(
  "I'm researching whether to buy an electric car this year.",
  'project.research_manager',
);
expectSkill("I'm moving to Spain in six months.", 'project.life_planner');
expectSkill(
  "I'm looking for a mechanical keyboard under $150 with hot-swappable switches. Compare the best options and recommend one.",
  'research.compare_decide',
);
expectSkill('Research noise-cancelling headphones under $100', 'research.web');
expectSkill('Find the three best project management tools for startups.', 'research.web');
expectSkill('Summarize this page.', 'page.summarize', {
  pageUrl: 'https://phil.local/article',
  pageHasExtract: true,
});
expectSkill('Summarize this', 'page.summarize', {
  pageUrl: 'https://phil.local/article',
  pageHasExtract: true,
});
expectSkill('What is the rollback step on this page?', 'page.ask', {
  pageUrl: 'https://phil.local/article',
  pageHasExtract: true,
});
expectSkill(
  "Reply to John's last email saying I can meet Thursday afternoon.",
  'email.reply_draft',
);
expectSkill('List my last 5 emails', 'email.list', { emailIntent: 'email_list' });
expectSkill('Plan my workday.', 'planning.workday', { calendarConnected: true });
expectSkill('Plan my workday.', 'planning.workday', { calendarConnected: false });
expectSkill("What's up today?", 'briefing.morning');
expectSkill('Any new ones today?', 'project.job_hunt', {
  activeProjectId: jobHuntProject.id,
  activeProject: jobHuntProject,
});
expectSkill('Help me stay focused while I work on my thesis today.', 'focus.coach');
expectSkill('How productive was I today?', 'focus.summary');
expectSkill('Help me stay productive today.', 'project.exec_day');
expectSkill('Remember that I prefer morning briefings at 7.', 'memory.remember');
expectSkill('Find that Kubernetes article I read last week.', 'browser_memory.find');
expectSkill('What is the weather today?', 'research.web.weather');
expectSkill('Open https://example.com in a new tab', 'tabs.open_url');
expectSkill('Do you think I should take the job?', 'assistant.general');
expectSkill('Clear all my memories', 'data.clear');
expectSkill('Send that email', 'email.send');

{
  const plan = expectSkill('Help me with that thing we discussed', 'meta.clarify');
  assert.ok(plan.clarification || plan.clarifyQuestion);
  assert.equal(plan.debug?.stage, 'clarify');
}

{
  const plan = expectSkill('No, I meant set a reminder', 'reminder.create', {
    correctionHint: 'No, I meant set a reminder',
    priorPlan: {
      steps: [{ skillId: 'research.web' }],
      confidence: 'medium',
    },
  });
  assert.ok(plan.shortCircuit || plan.lightweight);
}

// SKL-01 enumerable core + templates
{
  const router = makeRouter();
  const ids = router.listSkills().map((s) => s.id);
  for (const id of [
    'reminder.create',
    'goal.create',
    'project.create',
    'research.web',
    'research.compare_decide',
    'email.reply_draft',
    'page.summarize',
    'focus.coach',
    'focus.summary',
    'memory.remember',
    'browser_memory.find',
    'planning.workday',
    'briefing.morning',
    'project.career_accelerator',
    'project.job_hunt',
    'project.research_manager',
    'project.life_planner',
    'meta.clarify',
    'assistant.general',
    'email.send',
    'data.clear',
  ]) {
    assert.ok(ids.includes(id), `missing skill ${id}`);
  }
}

// SKL-02 confirmation
{
  const router = makeRouter();
  assert.equal(router.getSkill('email.send')?.confirmationLevel, 'required');
  assert.equal(router.getSkill('data.clear')?.confirmationLevel, 'required');
}

// RTE-07 registerSkill without core edits
{
  const router = makeRouter();
  router.registerSkill({
    id: 'test.only_skill',
    description: 'test-only skill',
    examples: ['invoke the purple banana protocol'],
    confirmationLevel: 'none',
    routeScore: (ctx) =>
      /purple banana protocol/i.test(ctx.utterance ?? ctx.goal) ? 0.99 : 0,
    execute: () => ({ ok: true, message: 'banana' }),
  });
  const plan = router.routeSync('Please invoke the purple banana protocol', {
    goal: 'Please invoke the purple banana protocol',
  });
  assert.ok(plan.debug?.skills.includes('test.only_skill'));
}

// Alias: flat `reminder` still resolves
{
  const router = makeRouter();
  assert.equal(router.getSkill('reminder')?.id, 'reminder.create');
}

console.log('agent/skills/factory.goldens.test.ts OK');
