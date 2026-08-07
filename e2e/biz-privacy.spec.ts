import { test, expect } from './fixtures/extension';

/**
 * BIZ-05…08 — Feedback + analytics/crash defaults in Privacy (Agent B4).
 * Kept separate from e2e/business.spec.ts so static website tests stay fixture-free.
 */
test.describe('Business privacy controls (BIZ-05…08)', () => {
  test.beforeEach(async ({ philPage }) => {
    const privacy = philPage.getByRole('heading', { name: /^Privacy$/i });
    if (await privacy.isVisible().catch(() => false)) return;
    await philPage.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await expect(privacy).toBeVisible({ timeout: 5_000 });
  });

  test('BIZ-05: Feedback button in extension', async ({ philPage }) => {
    await expect(philPage.getByRole('link', { name: /^Feedback$/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('BIZ-06: Analytics default off', async ({ philPage }) => {
    const checkbox = philPage.locator('label').filter({ hasText: /^Analytics$/i }).locator('input');
    await expect(checkbox).toBeVisible({ timeout: 5_000 });
    await expect(checkbox).not.toBeChecked();
  });

  test('BIZ-07: Crash reporting default off', async ({ philPage }) => {
    const checkbox = philPage
      .locator('label')
      .filter({ hasText: /Crash reporting/i })
      .locator('input');
    await expect(checkbox).toBeVisible({ timeout: 5_000 });
    await expect(checkbox).not.toBeChecked();
  });

  test('BIZ-08: Opt-in analytics can be enabled explicitly', async ({ philPage }) => {
    const checkbox = philPage.locator('label').filter({ hasText: /^Analytics$/i }).locator('input');
    await expect(checkbox).toBeVisible({ timeout: 5_000 });
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });
});
