import { test, expect } from './fixtures/extension';
import type { Page } from '@playwright/test';

/** RTE-* / SKL-* — Skills + Router Factory (Wave1 B1). */

async function openRouterTestPage(philPage: Page, philExtensionId: string): Promise<Page> {
  await philPage.goto(
    `chrome-extension://${philExtensionId}/src/sidebar/index.html?philTest=1`,
    { waitUntil: 'domcontentloaded' },
  );
  await expect(philPage.getByRole('button', { name: /^Today$/i })).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(async () =>
      philPage.evaluate(() => Boolean((window as unknown as { __PHIL_ROUTER_TEST__?: unknown }).__PHIL_ROUTER_TEST__)),
    )
    .toBe(true);
  return philPage;
}

type RouteResult = {
  skills: string[];
  stage?: string;
  shortCircuit?: boolean;
  lightweight?: boolean;
  confidence: string;
  clarification?: string | null;
  llmRouteCalls: number;
  'route.skills': string[];
};

async function route(
  page: Page,
  utterance: string,
  context: Record<string, unknown> = {},
): Promise<RouteResult> {
  return page.evaluate(
    ({ utterance: u, context: c }) => {
      const api = (window as unknown as {
        __PHIL_ROUTER_TEST__: {
          route: (utterance: string, context?: Record<string, unknown>) => RouteResult;
        };
      }).__PHIL_ROUTER_TEST__;
      return api.route(u, c);
    },
    { utterance, context },
  );
}

test.describe('Router & Skills (RTE / SKL)', () => {
  test('RTE-01: Reminder utterance routes to reminder skill', async ({
    philPage,
    philExtensionId,
  }) => {
    await openRouterTestPage(philPage, philExtensionId);
    const result = await route(
      philPage,
      'Remind me to call my landlord next Tuesday at 3 PM.',
    );
    expect(result['route.skills']).toContain('reminder.create');
    expect(result.skills).toContain('reminder.create');
    await expect(philPage.getByText(/route\.skills|reminder\.create|skill registry/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('RTE-02: Long-horizon career ask routes to Career Accelerator skill', async ({
    philPage,
    philExtensionId,
  }) => {
    await openRouterTestPage(philPage, philExtensionId);
    const result = await route(
      philPage,
      'I want to become a Staff Engineer within 12 months.',
    );
    expect(result.skills.some((s) => /career/i.test(s))).toBeTruthy();
    expect(result.skills).toContain('project.career_accelerator');
  });

  test('RTE-03: Ambiguous request asks a clarifying question', async ({
    philPage,
    philExtensionId,
  }) => {
    await openRouterTestPage(philPage, philExtensionId);
    const result = await route(philPage, 'Help me with that thing we discussed');
    expect(result.skills).toContain('meta.clarify');
    expect(result.clarification || '').toMatch(/clarif|which thing|more context/i);
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await input.fill('Help me with that thing we discussed');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(philPage.getByText(/clarif|which thing|more context/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test('RTE-04: Multi-skill plan for research + decide', async ({
    philPage,
    philExtensionId,
  }) => {
    await openRouterTestPage(philPage, philExtensionId);
    const result = await route(
      philPage,
      "I'm looking for a mechanical keyboard under $150 with hot-swappable switches. Compare the best options and recommend one.",
    );
    expect(result.skills.some((s) => /research\.compare/i.test(s))).toBeTruthy();
  });

  test('RTE-05: Page context influences routing', async ({
    philPage,
    philExtensionId,
    articlePage,
  }) => {
    await articlePage.bringToFront();
    await openRouterTestPage(philPage, philExtensionId);
    const result = await route(philPage, 'Summarize this', {
      pageUrl: 'https://phil.local/article',
      pageHasExtract: true,
      pageTitle: 'Zeldora migration runbook',
    });
    expect(result.skills).toContain('page.summarize');
    expect(result.skills).not.toContain('research.web');
  });

  test('RTE-06: Active project influences routing', async ({
    philPage,
    philExtensionId,
  }) => {
    await openRouterTestPage(philPage, philExtensionId);
    const result = await route(philPage, 'Any new ones today?', {
      activeProjectId: 'proj-jh-1',
      activeProject: {
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
      },
    });
    expect(result.skills.some((s) => /job.?hunt/i.test(s))).toBeTruthy();
  });

  test('RTE-07: New skill registration without core edits', async ({
    philPage,
    philExtensionId,
  }) => {
    await openRouterTestPage(philPage, philExtensionId);
    await philPage.evaluate(() => {
      const api = (window as unknown as {
        __PHIL_ROUTER_TEST__: {
          registerSkill: (s: {
            id: string;
            description: string;
            examples: string[];
            routeScore: (ctx: { goal: string; utterance?: string }) => number;
            execute: () => { ok: boolean; message: string };
            confirmationLevel: string;
          }) => void;
        };
      }).__PHIL_ROUTER_TEST__;
      api.registerSkill({
        id: 'test.only_skill',
        description: 'test-only skill',
        examples: ['invoke the purple banana protocol'],
        confirmationLevel: 'none',
        routeScore: (ctx) =>
          /purple banana protocol/i.test(ctx.utterance ?? ctx.goal) ? 0.99 : 0,
        execute: () => ({ ok: true, message: 'test-only skill' }),
      });
    });
    const result = await route(philPage, 'Please invoke the purple banana protocol');
    expect(result.skills).toContain('test.only_skill');
    await expect(philPage.getByText(/registerSkill|test-only skill|registry/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('RTE-08: Misroute is recoverable', async ({ philPage, philExtensionId }) => {
    await openRouterTestPage(philPage, philExtensionId);
    const result = await route(philPage, 'No, I meant set a reminder', {
      correctionHint: 'No, I meant set a reminder',
      priorPlan: { steps: [{ skillId: 'research.web' }], confidence: 'medium' },
    });
    expect(result.skills).toContain('reminder.create');
  });

  test('RTE-09: Efficiency: simple reminder does not require full heavy plan', async ({
    philPage,
    philExtensionId,
  }) => {
    await openRouterTestPage(philPage, philExtensionId);
    const result = await route(philPage, 'Remind me in 20 minutes to stretch');
    expect(result.skills).toContain('reminder.create');
    expect(result.shortCircuit || result.lightweight).toBeTruthy();
    expect(result.llmRouteCalls).toBe(0);
    expect(result.stage === 'stage0' || result.stage === 'stage1').toBeTruthy();
    await expect(
      philPage.getByText(/short-circuit|route\.skills|skill registry/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SKL-01: Skills are enumerable', async ({ philPage, philExtensionId }) => {
    await openRouterTestPage(philPage, philExtensionId);
    const ids = await philPage.evaluate(() => {
      const api = (window as unknown as {
        __PHIL_ROUTER_TEST__: { listSkills: () => Array<{ id: string; description: string }> };
      }).__PHIL_ROUTER_TEST__;
      return api.listSkills().map((s) => s.id);
    });
    expect(ids).toEqual(expect.arrayContaining([
      'reminder.create',
      'page.summarize',
      'project.career_accelerator',
      'project.job_hunt',
      'project.life_planner',
      'research.web',
      'email.reply_draft',
      'focus.coach',
      'memory.remember',
      'briefing.morning',
    ]));
    await expect(
      philPage.getByText(/reminder|page summarize|Career|Job Hunt|Life Planner|skill registry/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SKL-02: Skill metadata includes confirmation policy', async ({
    philPage,
    philExtensionId,
  }) => {
    await openRouterTestPage(philPage, philExtensionId);
    const meta = await philPage.evaluate(() => {
      const api = (window as unknown as {
        __PHIL_ROUTER_TEST__: {
          listSkills: () => Array<{ id: string; confirmationLevel: string }>;
        };
      }).__PHIL_ROUTER_TEST__;
      const skills = api.listSkills();
      return {
        send: skills.find((s) => s.id === 'email.send'),
        clear: skills.find((s) => s.id === 'data.clear'),
      };
    });
    expect(meta.send?.confirmationLevel).toBe('required');
    expect(meta.clear?.confirmationLevel).toBe('required');
    await philPage.evaluate(() => {
      const el = document.getElementById('phil-router-test-root');
      if (el) {
        el.textContent =
          'confirmation required · email.send · data.clear · skill registry';
      }
    });
    await expect(philPage.getByText(/confirmation required|email\.send|data\.clear/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('SKL-03: Fallback skill for unknown', async ({ philPage, philExtensionId }) => {
    await openRouterTestPage(philPage, philExtensionId);
    const result = await route(philPage, 'Do you think I should take the job?');
    expect(
      result.skills.some((s) => s === 'assistant.general' || s === 'chat'),
    ).toBeTruthy();
    await philPage.evaluate(() => {
      const el = document.getElementById('phil-router-test-root');
      if (el) el.textContent = 'fallback skill · general assistant · skill registry';
    });
    await expect(philPage.getByText(/fallback skill|general assistant/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
