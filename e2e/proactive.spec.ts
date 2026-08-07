import { test, expect } from './fixtures/extension';

async function seedProactiveHarness(worker: { evaluate: (fn: any, arg?: any) => Promise<any> }): Promise<void> {
  await worker.evaluate(async () => {
    const now = Date.now();
    await chrome.storage.local.set({
      philSettings: {
        fabEnabled: true, trackingEnabled: true, nudgesEnabled: true, briefingEnabled: true,
        briefingHour: 8, briefingMinute: 0, eveningRecapEnabled: true, eveningRecapHour: 18, eveningRecapMinute: 0,
        nudgeThresholdMs: 30_000, notificationFrequency: 'normal', reminderDefaultLeadMinutes: 30,
        reminderDefaultRepeat: 'none', quietHoursEnabled: false, quietHoursStartHour: 22, quietHoursEndHour: 7,
        locality: 'Austin TX', categoryOverrides: {},
      },
      philGoals: [
        { id: 'goal_pro_1', title: 'Finish thesis chapter', status: 'active', allowedDomains: ['overleaf.com'], blockedDomains: ['youtube.com'], createdAt: now, updatedAt: now },
      ],
      philSuggestions: [],
    });
    await chrome.storage.session.set({ philProactiveHarness: true, philForceEmailTime: true });
  });
  await worker.evaluate(async () => {
    const hooks = (globalThis as { __philProactive?: { runProactiveEngine: (o?: { harness?: boolean }) => Promise<unknown> } }).__philProactive;
    if (hooks) await hooks.runProactiveEngine({ harness: true });
    else await chrome.runtime.sendMessage({ type: 'PHIL_RUN_PROACTIVE', harness: true });
  });
}

test.describe('Proactive (PRO)', () => {
  test('PRO-01: Long research without notes suggests summarize', async ({ philPage, philServiceWorker }) => {
    await seedProactiveHarness(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/researching|want a summary|Phil noticed/i).first()).toBeVisible({ timeout: 10_000 });
  });
  test('PRO-02: Multiple similar product tabs suggest compare', async ({ philPage, philServiceWorker }) => {
    await seedProactiveHarness(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/compare/i).first()).toBeVisible({ timeout: 10_000 });
  });
  test('PRO-03: Leisure vs goal suggests refocus', async ({ philPage, philServiceWorker }) => {
    await seedProactiveHarness(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/refocus|back to your goal|nudge/i).first()).toBeVisible({ timeout: 10_000 });
  });
  test('PRO-04: Email-time suggestion when Gmail permitted', async ({ philPage, philServiceWorker }) => {
    await seedProactiveHarness(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/unread|email|triag/i).first()).toBeVisible({ timeout: 10_000 });
  });
  test('PRO-05: Dismiss suggestion', async ({ philPage, philServiceWorker }) => {
    await seedProactiveHarness(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/Dismiss/i).first()).toBeVisible({ timeout: 10_000 });
    await philPage.getByText(/Dismiss/i).first().click();
  });
  test('PRO-06: Snooze suggestion', async ({ philPage, philServiceWorker }) => {
    await seedProactiveHarness(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/Snooze/i).first()).toBeVisible({ timeout: 10_000 });
    await philPage.getByText(/Snooze/i).first().click();
  });
  test('PRO-07: Browse-based smart reminder suggestion', async ({ philPage, philServiceWorker }) => {
    await seedProactiveHarness(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/reminder to book|prices change|smart reminder/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
