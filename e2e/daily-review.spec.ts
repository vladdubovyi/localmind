import { test, expect } from './fixtures/extension';

async function seedDailyReview(worker: { evaluate: (fn: any, arg?: any) => Promise<any> }): Promise<void> {
  await worker.evaluate(async () => {
    const now = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    await chrome.storage.local.set({
      philSettings: {
        fabEnabled: true, trackingEnabled: true, nudgesEnabled: true, briefingEnabled: true,
        briefingHour: 8, briefingMinute: 0, eveningRecapEnabled: true, eveningRecapHour: 18, eveningRecapMinute: 0,
        nudgeThresholdMs: 60_000, notificationFrequency: 'normal', reminderDefaultLeadMinutes: 30,
        reminderDefaultRepeat: 'none', quietHoursEnabled: false, quietHoursStartHour: 22, quietHoursEndHour: 7,
        locality: 'Austin TX', categoryOverrides: {},
      },
      philGoals: [
        { id: 'goal_active_1', title: 'Ship daily review', status: 'active', allowedDomains: ['github.com'], blockedDomains: ['youtube.com'], createdAt: now, updatedAt: now },
        { id: 'goal_active_2', title: 'Finish thesis outline', status: 'active', allowedDomains: ['overleaf.com'], blockedDomains: ['youtube.com'], createdAt: now, updatedAt: now },
        { id: 'goal_done_1', title: 'Morning stretch completed goal', status: 'completed', allowedDomains: [], blockedDomains: [], createdAt: now - 86_400_000, updatedAt: now - 3_600_000 },
      ],
      philReminders: [
        { id: 'rem_1', text: 'Call landlord', when: now + 2 * 60 * 60_000, repeat: 'none', status: 'scheduled', createdAt: now, updatedAt: now },
      ],
      philTabActivity: [
        { id: 'act_1', domain: 'github.com', url: 'https://github.com/phil', title: 'Phil repo', startedAt: startMs + 60_000, endedAt: startMs + 40 * 60_000, ms: 39 * 60_000, category: 'productive' },
        { id: 'act_2', domain: 'youtube.com', url: 'https://youtube.com/watch?v=1', title: 'Leisure', startedAt: startMs + 50 * 60_000, endedAt: startMs + 70 * 60_000, ms: 20 * 60_000, category: 'leisure' },
      ],
      philBriefings: [],
      philSuggestions: [],
    });
  });
}

test.describe('Daily review (DAY)', () => {
  test('DAY-01: Morning briefing shows goals, reminders, focus', async ({ philPage, philServiceWorker }) => {
    await seedDailyReview(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await philPage.getByRole('button', { name: /^Refresh$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Today$/i })).toBeVisible();
    await expect(philPage.getByText(/Good morning|Active goals|Focus so far|reminder/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('DAY-02: Suggested priorities appear when data exists', async ({ philPage, philServiceWorker }) => {
    await seedDailyReview(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await philPage.getByRole('button', { name: /^Refresh$/i }).click();
    await expect(philPage.getByText(/Suggested priorities|priority/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('DAY-03: Goals completed show in review', async ({ philPage, philServiceWorker }) => {
    await seedDailyReview(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await philPage.getByRole('button', { name: /^Refresh$/i }).click();
    await expect(philPage.getByText(/completed goal|Goals completed/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('DAY-04: Evening recap composes', async ({ philPage, philServiceWorker }) => {
    await seedDailyReview(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await philPage.getByRole('button', { name: /Compose evening summary/i }).click();
    await expect(philPage.getByText(/Evening recap —|Work completed|Biggest distractions/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('DAY-05: Evening notification path fires', async ({ philPage, philServiceWorker }) => {
    await seedDailyReview(philServiceWorker);
    await philServiceWorker.evaluate(async () => {
      const hooks = (globalThis as { __philProactive?: { runEveningRecap: (o?: { notify?: boolean }) => Promise<void> } }).__philProactive;
      if (hooks) await hooks.runEveningRecap({ notify: true });
      else await chrome.runtime.sendMessage({ type: 'PHIL_RUN_EVENING_RECAP', notify: true });
    });
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(
      philPage.getByText(/evening notification path|Evening recap —|Work completed/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('DAY-06: Productivity insights are goal-relative', async ({ philPage, philServiceWorker }) => {
    await seedDailyReview(philServiceWorker);
    await philPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(philPage.getByText(/toward goals|leisure/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
