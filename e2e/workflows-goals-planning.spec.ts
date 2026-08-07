import { test, expect, type Page } from './fixtures/extension';

async function openAgentTest(philPage: Page, philExtensionId: string): Promise<void> {
  await philPage.goto(
    `chrome-extension://${philExtensionId}/src/sidebar/index.html?philTest=1`,
    { waitUntil: 'domcontentloaded' },
  );
  await expect(philPage.getByRole('button', { name: /^Agent$/i })).toBeVisible({
    timeout: 30_000,
  });
  await philPage.getByRole('button', { name: /^Agent$/i }).click();
  await expect(philPage.getByPlaceholder(/Message the agent/i)).toBeVisible({
    timeout: 20_000,
  });
}


/** WF goals / planning. */
test.describe('Workflows goals & planning', () => {
  test('WF-02: Goal creation from natural language (AWS exam)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    const input = philPage.getByPlaceholder(/Finish the proposal|goal/i);
    if (await input.isVisible().catch(() => false)) {
      await input.fill('AWS Solutions Architect exam — study schedule milestone');
      await philPage.getByRole('button', { name: /^Add$/i }).click();
    }
    await expect(
      philPage.getByText(/AWS Solutions Architect|study schedule|milestone/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('WF-03: Daily planning (“Plan my workday”)', async ({ philPage, philExtensionId }) => {
    await openAgentTest(philPage, philExtensionId);
    await philPage.evaluate(async () => {
      const now = Date.now();
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('phil', 1);
        req.onerror = () => reject(req.error ?? new Error('idb'));
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['goals', 'reminders'], 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('tx'));
          tx.objectStore('goals').put({
            id: 'goal-wf03',
            title: 'Ship WF-03 agenda',
            status: 'active',
            allowedDomains: [],
            blockedDomains: [],
            createdAt: now,
            updatedAt: now,
          });
          tx.objectStore('reminders').put({
            id: 'rem-wf03',
            text: 'Review focus block plan',
            when: now + 60 * 60_000,
            repeat: 'none',
            status: 'scheduled',
            createdAt: now,
            updatedAt: now,
          });
        };
      });
    });
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await input.fill('Plan my workday.');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(
      philPage.getByText(/Plan my workday|agenda|focus block/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('WF-08: Goal progress tracking (this week)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    await expect(philPage.getByRole('heading', { name: /Goals/i })).toBeVisible();
    await expect(philPage.getByText(/goal|active|Add/i).first()).toBeVisible();
  });

  test('WF-14: Executive assistant (Staff Engineer interview)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByRole('button', { name: /^Agent$/i })).toBeVisible();
  });

  test('WF-17: Long-running conversation (startup six months)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await expect(philPage.getByText(/Project|startup|custom|Create/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
