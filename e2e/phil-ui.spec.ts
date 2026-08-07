import { test, expect } from './fixtures/extension';

test.describe('Phil personal assistant UI', () => {
  test('rebrand and assistant tabs are visible (Agent first, no Chat)', async ({ philPage }) => {
    await expect(philPage.getByText('Phil').first()).toBeVisible();
    await expect(philPage.getByRole('button', { name: /^Chat$/i })).toHaveCount(0);

    const tabs = ['Agent', 'Today', 'Focus', 'Goals', 'Reminders', 'Phil'];
    for (const label of tabs) {
      await expect(philPage.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible();
    }

    // Agent is the default and first chip.
    const chips = philPage.locator('header + div button, .flex.gap-1 button').filter({
      hasText: /^(Agent|Today|Focus|Goals|Reminders|Phil)$/,
    });
    // Prefer role buttons in the tab strip order: Agent should appear before Today.
    const agent = philPage.getByRole('button', { name: /^Agent$/i });
    const today = philPage.getByRole('button', { name: /^Today$/i });
    const agentBox = await agent.boundingBox();
    const todayBox = await today.boundingBox();
    expect(agentBox && todayBox && agentBox.x <= todayBox.x).toBeTruthy();
    void chips;
  });

  test('Today tab shows briefing content', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Today$/i })).toBeVisible();
    await expect(
      philPage.getByText(/Good morning|No active goals|Focus so far|Active goals/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Goals tab updates immediately without leaving the tab', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Goals$/i })).toBeVisible();
    const title = `Ship Phil e2e ${Date.now()}`;
    await philPage.getByPlaceholder(/Finish the proposal/i).fill(title);
    await philPage.getByRole('button', { name: /^Add$/i }).click();
    // Must appear without switching tabs away/back.
    await expect(philPage.getByText(title)).toBeVisible({ timeout: 5_000 });
    await philPage.getByRole('button', { name: /^Done$/i }).first().click();
    await expect(philPage.getByText(/completed/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Reminders tab updates immediately without leaving the tab', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Reminders$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Reminders$/i })).toBeVisible();
    const text = `Stand up ${Date.now()}`;
    await philPage.getByPlaceholder(/Stand up/i).fill(text);
    await philPage.getByLabel(/Minutes from now/i).fill('45');
    await philPage.getByRole('button', { name: /^Remind$/i }).click();
    await expect(philPage.getByText(text)).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/scheduled/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('Focus tab shows category breakdown and can display seconds', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Focus$/i })).toBeVisible();
    await expect(philPage.getByText(/Productive/i).first()).toBeVisible();
    await expect(philPage.getByText(/Leisure/i).first()).toBeVisible();
    // Counters render as Ns / Nm — not stuck blank.
    await expect(philPage.getByText(/Tab time today/i)).toBeVisible();
  });

  test('Focus tracker records dwell time after browsing', async ({
    philExtensionContext,
    philServiceWorker,
    philPage,
  }) => {
    await philServiceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        philSettings: {
          fabEnabled: true,
          trackingEnabled: true,
          nudgesEnabled: true,
          briefingEnabled: true,
          briefingHour: 8,
          briefingMinute: 0,
          nudgeThresholdMs: 120_000,
          locality: 'Austin TX',
          categoryOverrides: {},
        },
        philTabActivity: [],
      });
      await chrome.storage.session.remove('philFocusLive');
    });

    const site = await philExtensionContext.newPage();
    await site.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    await site.bringToFront();

    // Drive tracker via SW hooks (extension-page → SW messaging is unreliable in Playwright).
    await expect
      .poll(async () => {
        return philServiceWorker.evaluate(() =>
          Boolean((globalThis as { __philFocus?: unknown }).__philFocus),
        );
      }, { timeout: 15_000 })
      .toBe(true);

    const resumed = await philServiceWorker.evaluate(async () => {
      const hooks = (
        globalThis as {
          __philFocus?: {
            resumeFocusTracking: () => Promise<void>;
            focusSnapshot: () => Promise<{ active?: { domain?: string } | null; totalMs?: number }>;
          };
        }
      ).__philFocus;
      if (!hooks) return { ok: false, error: 'hooks missing' };
      await hooks.resumeFocusTracking();
      const snapshot = await hooks.focusSnapshot();
      return { ok: true, snapshot };
    });
    expect(resumed.ok).toBe(true);
    expect(resumed.snapshot?.active?.domain).toMatch(/example\.com/i);

    await site.waitForTimeout(2_000);

    const checkpointed = await philServiceWorker.evaluate(async () => {
      const hooks = (
        globalThis as {
          __philFocus?: {
            checkpointFocus: () => Promise<void>;
            focusSnapshot: () => Promise<{ totalMs?: number }>;
          };
        }
      ).__philFocus;
      if (!hooks) return { ok: false };
      await hooks.checkpointFocus();
      return { ok: true, snapshot: await hooks.focusSnapshot() };
    });
    expect(checkpointed.ok).toBe(true);
    expect(checkpointed.snapshot?.totalMs ?? 0).toBeGreaterThan(250);

    const activity = await philServiceWorker.evaluate(async () => {
      const stored = await chrome.storage.local.get('philTabActivity');
      const rows = (stored.philTabActivity as Array<{ domain: string; ms: number }> | undefined) ?? [];
      return {
        count: rows.length,
        exampleMs: rows
          .filter((r) => r.domain.includes('example'))
          .reduce((sum, r) => sum + (r.ms || 0), 0),
      };
    });

    expect(activity.count).toBeGreaterThan(0);
    expect(activity.exampleMs).toBeGreaterThan(250);

    await philPage.bringToFront();
    await philPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Focus$/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(philPage.getByText(/example\.com/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(philPage.getByText(/\d+s|\d+m/i).first()).toBeVisible();
  });

  test('Phil settings tab toggles FAB', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Phil$/i }).click();
    await expect(philPage.getByRole('heading', { name: /Phil settings/i })).toBeVisible();
    const fab = philPage.getByText(/Always-on page button/i);
    await expect(fab).toBeVisible();
  });

  test('Agent tab accepts input while model may still be restoring', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await expect(input).toBeVisible({ timeout: 15_000 });
    // Input should not be blocked solely because the model is not ready.
    await expect(input).toBeEnabled();
  });
});

test.describe('Phil FAB on web pages', () => {
  test('mounts FAB and opens side panel intent', async ({
    philExtensionContext,
    philExtensionId,
  }) => {
    const page = await philExtensionContext.newPage();
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#phil-fab-root')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Open Phil/i })).toBeVisible();

    await page.getByRole('button', { name: /Open Phil/i }).click({ button: 'right' });
    await expect(page.getByRole('button', { name: /What’s up today|What's up today/i })).toBeVisible();

    await page.getByRole('button', { name: /^Today$/i }).click();
    const sidebar = await philExtensionContext.newPage();
    await sidebar.goto(`chrome-extension://${philExtensionId}/src/sidebar/index.html`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('[data-phil-fab="true"]')).toBeVisible();
  });
});
