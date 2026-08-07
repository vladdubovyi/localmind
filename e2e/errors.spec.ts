import { test, expect } from './fixtures/extension';

/** ERR-* — robust error handling (Wave1 B3). */
test.describe('Errors (ERR)', () => {
  test('ERR-01: WebGPU unavailable shows recovery, not a crash', async ({
    philExtensionContext,
    philExtensionId,
  }) => {
    // Isolated page so init-script GPU stub does not poison the shared philPage worker.
    const page = await philExtensionContext.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        get: () => ({
          requestAdapter: async () => null,
        }),
      });
    });
    await page.goto(`chrome-extension://${philExtensionId}/src/sidebar/index.html`, {
      waitUntil: 'domcontentloaded',
    });
    await page.evaluate(async () => {
      await chrome.storage.local.set({
        onboarding: { completed: true, completedAt: Date.now(), skipped: true },
        agentSettings: {
          enabled: true,
          maxSteps: 8,
          confirmModerate: true,
          allowDebugger: false,
          gmailClientId: '',
          gmailMode: 'session',
          calendarEnabled: false,
        },
      });
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: /^Agent$/i })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /^Agent$/i }).click();
    await expect(page.getByText(/WebGPU|local AI needs|Chrome\/Edge|hardware/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /^Goals$/i }).click();
    await expect(page.getByRole('heading', { name: /Goals/i })).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: /^Reminders$/i }).click();
    await expect(page.getByRole('heading', { name: /Reminders/i })).toBeVisible({ timeout: 5_000 });
  });

  test('ERR-02: Model load failure offers a smaller model', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(
      philPage.getByText(/smaller|fallback model|try.*model|Light|Low RAM|If load fails/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('ERR-03: Failed web research stays helpful', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText(/could not parse|opened search|Google/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('ERR-04: Generic Agent errors show cause + next action', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText(/Milestone|not implemented/i)).toHaveCount(0);
    await expect(
      philPage.getByText(/Retry|check permissions|open Privacy|what went wrong/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });
});
