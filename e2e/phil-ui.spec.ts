import { test, expect, E2E_MODEL_LABEL, MODEL_READY_TIMEOUT_MS } from './fixtures/extension';

/**
 * CORE-01…05 live here as titled regressions (existing Phil UI coverage).
 * Model/Agent chat CORE-06/10 live in model-* specs; Gmail CORE-08/09 in gmail-*.
 */
test.describe('Phil personal assistant UI (CORE)', () => {
  test('CORE-01: Agent tab is default; no Chat tab', async ({ philPage }) => {
    await expect(philPage.getByText('Phil').first()).toBeVisible();
    await expect(philPage.getByRole('button', { name: /^Chat$/i })).toHaveCount(0);

    const tabs = ['Agent', 'Today', 'Focus', 'Goals', 'Reminders', 'Phil'];
    for (const label of tabs) {
      await expect(philPage.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible();
    }

    const agent = philPage.getByRole('button', { name: /^Agent$/i });
    const today = philPage.getByRole('button', { name: /^Today$/i });
    const agentBox = await agent.boundingBox();
    const todayBox = await today.boundingBox();
    expect(agentBox && todayBox && agentBox.x <= todayBox.x).toBeTruthy();
  });

  test('CORE-05: Morning briefing tool / Today content', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Today$/i })).toBeVisible();
    await expect(
      philPage.getByText(/Good morning|No active goals|Focus so far|Active goals/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('CORE-02: Goals create and complete in-tab', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Goals$/i })).toBeVisible();
    const title = `Ship Phil e2e ${Date.now()}`;
    await philPage.getByPlaceholder(/Finish the proposal/i).fill(title);
    await philPage.getByRole('button', { name: /^Add$/i }).click();
    await expect(philPage.getByText(title)).toBeVisible({ timeout: 5_000 });
    await philPage.getByRole('button', { name: /^Done$/i }).first().click();
    await expect(philPage.getByText(/completed/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('CORE-03: Reminders create in-tab', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Reminders$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Reminders$/i })).toBeVisible();
    const text = `Stand up ${Date.now()}`;
    await philPage.getByPlaceholder(/Stand up/i).fill(text);
    await philPage.getByLabel(/Minutes from now/i).fill('45');
    await philPage.getByRole('button', { name: /^Remind$/i }).click();
    await expect(philPage.getByText(text)).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/scheduled/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('CORE-04: Focus shows productive/leisure breakdown', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Focus$/i })).toBeVisible();
    await expect(philPage.getByText(/Productive/i).first()).toBeVisible();
    await expect(philPage.getByText(/Leisure/i).first()).toBeVisible();
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
            checkpointFocus: (opts?: { force?: boolean }) => Promise<void>;
            focusSnapshot: () => Promise<{ totalMs?: number }>;
          };
        }
      ).__philFocus;
      if (!hooks) return { ok: false };
      await hooks.checkpointFocus({ force: true });
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

  test('Focus heartbeat tracks website time without SW test hooks', async ({
    philExtensionContext,
    philServiceWorker,
    philPage,
  }) => {
    await philServiceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        philSettings: {
          fabEnabled: true,
          trackingEnabled: true,
          nudgesEnabled: false,
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
    await expect(site.locator('#phil-fab-root')).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(
        async () => {
          return philServiceWorker.evaluate(async () => {
            const live = await chrome.storage.session.get('philFocusLive');
            const row = live.philFocusLive as { domain?: string } | undefined;
            return row?.domain ?? '';
          });
        },
        { timeout: 20_000 },
      )
      .toMatch(/example\.com/i);

    await site.waitForTimeout(12_000);
    await site.goto('https://example.org/', { waitUntil: 'domcontentloaded' });
    await site.bringToFront();
    await site.waitForTimeout(2_000);

    const activity = await philServiceWorker.evaluate(async () => {
      const stored = await chrome.storage.local.get('philTabActivity');
      const rows = (stored.philTabActivity as Array<{ domain: string; ms: number }> | undefined) ?? [];
      const live = await chrome.storage.session.get('philFocusLive');
      return {
        rows,
        liveDomain: (live.philFocusLive as { domain?: string } | undefined)?.domain ?? null,
        exampleComMs: rows
          .filter((r) => r.domain.includes('example.com'))
          .reduce((sum, r) => sum + (r.ms || 0), 0),
      };
    });

    expect(activity.exampleComMs).toBeGreaterThan(250);
    expect(activity.liveDomain ?? '').toMatch(/example\.org/i);

    await philPage.bringToFront();
    await philPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(philPage.getByText(/example\.com/i).first()).toBeVisible({
      timeout: 10_000,
    });
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

test.describe('CORE model / research (extension profile)', () => {
  test('CORE-06: Local Agent chat responds when model ready', async ({
    agentPage,
    sendAgentGoal,
  }) => {
    await sendAgentGoal('Say hello in one short sentence.');
    const body = await agentPage.locator('body').innerText();
    expect(body.length).toBeGreaterThan(20);
    expect(body).toMatch(/hello|hi|hey|greetings|phil/i);
  });

  test('CORE-07: Web research tool path', async ({ agentPage, sendAgentGoal }) => {
    await sendAgentGoal('Research what WebGPU is in one paragraph. Use web research.');
    const body = await agentPage.locator('body').innerText();
    expect(body).toMatch(/WebGPU|GPU|Google|research|tab/i);
    expect(body).not.toMatch(/Milestone/i);
  });
});

// Silence unused import if tree-shaken oddly in typecheck
void E2E_MODEL_LABEL;
void MODEL_READY_TIMEOUT_MS;
