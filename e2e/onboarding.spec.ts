import { test, expect } from './fixtures/extension';

/**
 * ONB-* — onboarding wizard (Wave1 B3). Fail on missing UI until wired.
 */
test.describe('Onboarding (ONB)', () => {
  test('ONB-01: First-run welcome appears on fresh profile', async ({ philExtensionContext, philExtensionId }) => {
    const page = await philExtensionContext.newPage();
    await page.goto(`chrome-extension://${philExtensionId}/src/sidebar/index.html`, {
      waitUntil: 'domcontentloaded',
    });
    await page.evaluate(async () => {
      await chrome.storage.local.remove('onboarding');
      await chrome.storage.session.clear?.();
    }).catch(() => undefined);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(/private|on-device|welcome|Phil/i).first(),
    ).toBeVisible({ timeout: 20_000 });
    // Must look like first-run welcome, not a blank Agent chat alone.
    await expect(page.getByRole('button', { name: /Continue|Get started|Next|Start/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('ONB-02: Local vs internet is explained before download', async ({ philPage }) => {
    await expect(philPage.getByText(/stays on.device|on-device|local/i)).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/internet|model download|Gmail|Calendar|Google/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('ONB-03: Permissions wizard can be completed or skipped', async ({ philPage }) => {
    await expect(philPage.getByText(/permission|Gmail|browser access|Skip/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('ONB-08: Calendar is an onboarding step', async ({ philPage }) => {
    await expect(philPage.getByText(/Calendar/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/daily planning|plan my workday|Skip/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('ONB-04: Recommended model is selected automatically', async ({ philPage }) => {
    await expect(philPage.getByText(/Recommended|recommended model/i)).toBeVisible({ timeout: 5_000 });
  });

  test('ONB-05: Model download shows progress', async ({ philPage }) => {
    await expect(philPage.getByText(/Downloading|%|Loading|progress/i)).toBeVisible({ timeout: 5_000 });
  });

  test('ONB-06: Download interrupt can be resumed', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /Retry|Resume/i })).toBeVisible({ timeout: 5_000 });
  });

  test('ONB-07: Successful onboarding lands on Agent ready to chat', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByPlaceholder(/Message the agent/i)).toBeVisible();
    await expect(philPage.getByRole('button', { name: /^Today$/i })).toBeVisible();
  });
});
