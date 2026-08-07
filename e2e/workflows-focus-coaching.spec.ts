import { test, expect } from './fixtures/extension';

async function seedCoaching(worker: { evaluate: (fn: any, arg?: any) => Promise<any> }): Promise<void> {
  await worker.evaluate(async () => {
    const now = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    await chrome.storage.local.set({
      philSettings: {
        fabEnabled: true, trackingEnabled: true, nudgesEnabled: true, briefingEnabled: true,
        briefingHour: 8, briefingMinute: 0, eveningRecapEnabled: true, eveningRecapHour: 18, eveningRecapMinute: 0,
        nudgeThresholdMs: 30_000, notificationFrequency: 'normal', reminderDefaultLeadMinutes: 30,
        reminderDefaultRepeat: 'none', quietHoursEnabled: false, quietHoursStartHour: 22, quietHoursEndHour: 7,
        locality: 'Austin TX', categoryOverrides: {},
      },
      philGoals: [{
        id: 'goal_thesis', title: 'Work on my thesis today', status: 'active',
        allowedDomains: ['overleaf.com'], blockedDomains: ['youtube.com'], createdAt: now, updatedAt: now,
      }],
      philTabActivity: [
        { id: 'act_t1', domain: 'overleaf.com', url: 'https://overleaf.com', startedAt: startMs + 1000, endedAt: startMs + 30 * 60_000, ms: 29 * 60_000, category: 'productive' },
        { id: 'act_t2', domain: 'example.com', url: 'https://example.com', startedAt: startMs + 31 * 60_000, endedAt: startMs + 40 * 60_000, ms: 9 * 60_000, category: 'neutral' },
        { id: 'act_t3', domain: 'youtube.com', url: 'https://youtube.com', title: 'entertainment', startedAt: startMs + 41 * 60_000, endedAt: startMs + 55 * 60_000, ms: 14 * 60_000, category: 'leisure' },
      ],
      philSuggestions: [],
    });
    await chrome.storage.session.set({ philProactiveHarness: true });
  });
  await worker.evaluate(async () => {
    const hooks = (globalThis as { __philProactive?: { runProactiveEngine: (o?: { harness?: boolean }) => Promise<unknown> } }).__philProactive;
    if (hooks) await hooks.runProactiveEngine({ harness: true });
    else await chrome.runtime.sendMessage({ type: 'PHIL_RUN_PROACTIVE', harness: true });
  });
}

test.describe('Workflows focus & coaching', () => {
  test('WF-07: Productivity coaching (thesis focus)', async ({ philPage, philServiceWorker }) => {
    await seedCoaching(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/thesis|focus session|productivity summary/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('WF-10: Multi-step assistant (trip to Japan)', async ({
    philPage,
    philExtensionId,
  }) => {
    await philPage.goto(
      `chrome-extension://${philExtensionId}/src/sidebar/index.html?philTest=1`,
      { waitUntil: 'domcontentloaded' },
    );
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await expect(input).toBeVisible({ timeout: 20_000 });
    await input.fill("I'm planning a trip to Japan next April.");
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(
      philPage.getByText(/Japan|travel|Trip to Japan|flights|booking/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    await expect(philPage.getByText(/Japan|Trip to Japan|travel/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('WF-19: Productivity classification (“How productive was I today?”)', async ({ philPage, philServiceWorker }) => {
    await seedCoaching(philServiceWorker);
    await philPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(philPage.getByText(/productive|neutral|entertainment|leisure/i).first()).toBeVisible();
    await expect(philPage.getByText(/How productive|actionable insight|toward goals/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('WF-20: Autonomous initiative (“Help me stay on track today”)', async ({ philPage, philServiceWorker }) => {
    await seedCoaching(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/stay on track|focus timer|distraction/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
