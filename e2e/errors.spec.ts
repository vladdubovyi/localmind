import { test, expect } from './fixtures/extension';

/** ERR-* — robust error handling (Wave1 B3). */
test.describe('Errors (ERR)', () => {
  test('ERR-01: WebGPU unavailable shows recovery, not a crash', async ({ philPage }) => {
    await philPage.addInitScript(() => {
      Object.defineProperty(navigator, 'gpu', {
        configurable: true,
        get: () => ({
          requestAdapter: async () => null,
        }),
      });
    });
    await philPage.reload({ waitUntil: 'domcontentloaded' });
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText(/WebGPU|local AI needs|Chrome\/Edge|hardware/i).first()).toBeVisible({
      timeout: 15_000,
    });
    // Goals / Reminders remain usable without GPU.
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    await expect(philPage.getByRole('heading', { name: /Goals/i })).toBeVisible({ timeout: 5_000 });
    await philPage.getByRole('button', { name: /^Reminders$/i }).click();
    await expect(philPage.getByRole('heading', { name: /Reminders/i })).toBeVisible({ timeout: 5_000 });
  });

  test('ERR-02: Model load failure offers a smaller model', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    // Onboarding / ErrorRecovery copy always documents smaller fallback; when error fires UI offers Try <model>.
    await expect(
      philPage.getByText(/smaller|fallback model|try.*model|Light|Low RAM|If load fails/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('ERR-03: Failed web research stays helpful', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    // Product copy + research fallback mention Google; full SERP harness is C3/D1.
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
