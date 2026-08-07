import { test, expect } from './fixtures/extension';

async function seedExecDay(worker: { evaluate: (fn: any, arg?: any) => Promise<any> }): Promise<void> {
  await worker.evaluate(async () => {
    const now = Date.now();
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    const projectId = 'proj_exec_day_1';
    await chrome.storage.local.set({
      philSettings: {
        fabEnabled: true, trackingEnabled: true, nudgesEnabled: true, briefingEnabled: true,
        briefingHour: 8, briefingMinute: 0, eveningRecapEnabled: true, eveningRecapHour: 18, eveningRecapMinute: 0,
        nudgeThresholdMs: 30_000, notificationFrequency: 'normal', reminderDefaultLeadMinutes: 30,
        reminderDefaultRepeat: 'none', quietHoursEnabled: false, quietHoursStartHour: 22, quietHoursEndHour: 7,
        locality: 'Austin TX', categoryOverrides: {},
      },
      philProjects: [{
        id: projectId, title: 'Stay productive today', template: 'exec_day', status: 'active',
        createdAt: now, updatedAt: now, lastProgressAt: now, metrics: {}, knowledgeEntries: [],
        milestones: [{ id: 'ms_1', title: 'Morning agenda', status: 'in_progress', updatedAt: now }],
        linkedGoalIds: ['goal_ea_1'], linkedReminderIds: ['rem_ea_1'],
        statusSummary: 'Exec day coaching active',
      }],
      philActiveProject: { activeProjectId: projectId, updatedAt: now },
      philGoals: [{
        id: 'goal_ea_1', title: 'Stay productive today', status: 'active',
        allowedDomains: ['github.com'], blockedDomains: ['youtube.com'],
        createdAt: now, updatedAt: now, projectId,
      }],
      philReminders: [{
        id: 'rem_ea_1', text: 'Review inbox at noon', when: now + 60 * 60_000, repeat: 'none',
        status: 'scheduled', createdAt: now, updatedAt: now, projectId,
      }],
      philTabActivity: [
        { id: 'act_ea_1', domain: 'github.com', url: 'https://github.com', startedAt: startMs + 1000, endedAt: startMs + 20 * 60_000, ms: 19 * 60_000, category: 'productive' },
        { id: 'act_ea_2', domain: 'youtube.com', url: 'https://youtube.com', startedAt: startMs + 30 * 60_000, endedAt: startMs + 50 * 60_000, ms: 20 * 60_000, category: 'leisure' },
        { id: 'act_ea_3', domain: 'reddit.com', url: 'https://reddit.com', startedAt: startMs + 51 * 60_000, endedAt: startMs + 55 * 60_000, ms: 4 * 60_000, category: 'leisure' },
        { id: 'act_ea_4', domain: 'news.ycombinator.com', url: 'https://news.ycombinator.com', startedAt: startMs + 56 * 60_000, endedAt: startMs + 58 * 60_000, ms: 2 * 60_000, category: 'neutral' },
        { id: 'act_ea_5', domain: 'twitter.com', url: 'https://twitter.com', startedAt: startMs + 59 * 60_000, endedAt: startMs + 62 * 60_000, ms: 3 * 60_000, category: 'leisure' },
      ],
      philSuggestions: [],
      philBriefings: [],
    });
    await chrome.storage.session.set({ philProactiveHarness: true });
  });
  await worker.evaluate(async () => {
    const hooks = (globalThis as { __philProactive?: { runProactiveEngine: (o?: { harness?: boolean }) => Promise<unknown>; runEveningRecap: (o?: { notify?: boolean }) => Promise<void> } }).__philProactive;
    if (hooks) { await hooks.runProactiveEngine({ harness: true }); await hooks.runEveningRecap({ notify: true }); }
    else {
      await chrome.runtime.sendMessage({ type: 'PHIL_RUN_PROACTIVE', harness: true });
      await chrome.runtime.sendMessage({ type: 'PHIL_RUN_EVENING_RECAP', notify: true });
    }
  });
}

test.describe('Projects Exec Assistant (PRJ-EA)', () => {
  test('PRJ-EA-01: Morning plan from projects/goals/reminders', async ({ philPage, philServiceWorker }) => {
    await seedExecDay(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await philPage.getByRole('button', { name: /^Refresh$/i }).click();
    await expect(philPage.getByText(/today.?s plan|agenda|stay productive today/i).first()).toBeVisible({ timeout: 10_000 });
  });
  test('PRJ-EA-02: During the day continuous assistance', async ({ philPage, philServiceWorker }) => {
    await seedExecDay(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/context switching|focus session|suggest.*break/i).first()).toBeVisible({ timeout: 10_000 });
  });
  test('PRJ-EA-03: Evening auto-recap without prompting', async ({ philPage, philServiceWorker }) => {
    await seedExecDay(philServiceWorker);
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/evening|work completed|biggest distractions/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
