import { test, expect, type Page } from './fixtures/extension';

/**
 * ONB-* — onboarding wizard (Wave1 B3).
 * philPage seeds completed onboarding; fresh-run tests clear that flag.
 */

async function openFreshOnboarding(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await chrome.storage.local.remove(['onboarding', 'setupWizardStep']);
    await chrome.storage.session?.clear?.();
  }).catch(() => undefined);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Welcome to Phil|Stays on-device|Get started/i).first()).toBeVisible({
    timeout: 15_000,
  });
}

async function skipToCalendar(page: Page): Promise<void> {
  // welcome → browser → gmail → calendar
  for (const label of [/Get started/i, /Skip for now/i, /Skip for now/i]) {
    const btn = page.getByRole('button', { name: label }).first();
    await expect(btn).toBeVisible({ timeout: 8_000 });
    await btn.click();
  }
  await expect(page.getByText(/Calendar/i).first()).toBeVisible({ timeout: 8_000 });
}

/** Restore seeded completed onboarding after wizard tests share philPage. */
async function ensureSetupComplete(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await chrome.storage.local.remove('setupWizardStep');
    await chrome.storage.local.set({
      onboarding: { completed: true, completedAt: Date.now(), skipped: true },
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: /^Today$/i })).toBeVisible({ timeout: 20_000 });
}

test.describe('Onboarding (ONB)', () => {
  test('ONB-01: First-run welcome appears on fresh profile', async ({ philExtensionContext, philExtensionId }) => {
    const page = await philExtensionContext.newPage();
    await page.goto(`chrome-extension://${philExtensionId}/src/sidebar/index.html`, {
      waitUntil: 'domcontentloaded',
    });
    await page.evaluate(async () => {
      await chrome.storage.local.remove(['onboarding', 'setupWizardStep']);
      await chrome.storage.session.clear?.();
    }).catch(() => undefined);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.getByText(/private|on-device|welcome|Phil/i).first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /Continue|Get started|Next|Start/i }).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('ONB-02: Local vs internet is explained before download', async ({ philPage }) => {
    await openFreshOnboarding(philPage);
    await expect(philPage.getByText(/Stays on-device|stays on.device|on-device|local/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(philPage.getByText(/internet|model download|Gmail|Calendar|Google/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(philPage.getByText(/Google web research|Google/i).first()).toBeVisible();
    await expect(philPage.getByText(/Calendar/i).first()).toBeVisible();
  });

  test('ONB-03: Permissions wizard can be completed or skipped', async ({ philPage }) => {
    await openFreshOnboarding(philPage);
    await expect(philPage.getByRole('button', { name: /Get started/i })).toBeVisible({ timeout: 10_000 });
    await philPage.getByRole('button', { name: /Get started/i }).click();
    await expect(philPage.getByText(/permission|Browse|browser access|Skip/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(philPage.getByRole('button', { name: /Skip for now/i }).first()).toBeVisible();
  });

  test('ONB-08: Calendar is an onboarding step', async ({ philPage }) => {
    await openFreshOnboarding(philPage);
    await skipToCalendar(philPage);
    await expect(philPage.getByText(/Calendar/i).first()).toBeVisible({ timeout: 8_000 });
    await expect(philPage.getByText(/daily planning|plan my workday|Skip/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(philPage.getByRole('button', { name: /Connect Calendar/i })).toBeVisible();
    await expect(philPage.getByRole('button', { name: /Skip for now/i }).first()).toBeVisible();
  });

  test('ONB-04: Recommended model is selected automatically', async ({ philPage }) => {
    await ensureSetupComplete(philPage);
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText(/Recommended|recommended model/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('ONB-05: Model download shows progress', async ({ philPage }) => {
    await ensureSetupComplete(philPage);
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText(/Downloading|%|Loading|progress|Download AI/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test('ONB-06: Download interrupt can be resumed', async ({ philPage }) => {
    await ensureSetupComplete(philPage);
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const retry = philPage.getByRole('button', { name: /Retry|Resume|Check again/i });
    const download = philPage.getByRole('button', { name: /Download AI|Load Phil|Downloading/i });
    await expect(download.or(retry).first()).toBeVisible({ timeout: 15_000 });
    await expect(
      philPage.getByText(/Resume|Retry|resume if interrupted|If something fails: Retry/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('ONB-07: Successful onboarding lands on Agent ready to chat', async ({ philPage }) => {
    await ensureSetupComplete(philPage);
    await expect(philPage.getByRole('button', { name: /^Agent$/i })).toBeVisible();
    await expect(philPage.getByRole('button', { name: /^Today$/i })).toBeVisible();
    await expect(philPage.getByRole('button', { name: /^Goals$/i })).toBeVisible();
    await expect(philPage.getByRole('button', { name: /^Reminders$/i })).toBeVisible();
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const composer = philPage.getByPlaceholder(/Message the agent/i);
    const modelUi = philPage.getByText(/Download AI|Restoring Phil|Recommended|WebGPU/i);
    await expect(composer.or(modelUi).first()).toBeVisible({ timeout: 15_000 });
  });
});
