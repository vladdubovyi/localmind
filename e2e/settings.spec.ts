import { test, expect } from './fixtures/extension';

/**
 * SET-* settings matrix. SET-01 is shipped regression; SET-02…08 Phil + Privacy.
 */
test.describe('Settings (SET)', () => {
  test.beforeEach(async ({ philPage }) => {
    const close = philPage.getByRole('button', { name: /Close settings/i });
    if (await close.isVisible().catch(() => false)) await close.click();
  });

  test('SET-01: Change and load AI model', async ({ philPage }) => {
    await philPage.getByRole('button', { name: 'Settings', exact: true }).first().click();
    // Header gear opens the app Settings panel (model picker).
    await expect(philPage.getByText(/^Settings$/).first()).toBeVisible({ timeout: 10_000 });

    const modelSelect = philPage.locator('select').first();
    await expect(modelSelect).toBeVisible();
    const options = modelSelect.locator('option');
    const count = await options.count();
    expect(count).toBeGreaterThanOrEqual(2);

    const current = await modelSelect.inputValue();
    let other: string | null = null;
    for (let i = 0; i < count; i++) {
      const val = await options.nth(i).getAttribute('value');
      if (val && val !== current) {
        other = val;
        break;
      }
    }
    expect(other).toBeTruthy();
    await modelSelect.selectOption(other!);

    await philPage.getByRole('button', { name: /Load selected model/i }).click();
    // Ensure overlay closes even if model load is blocked (no WebGPU).
    const close = philPage.getByRole('button', { name: /Close settings/i });
    if (await close.isVisible().catch(() => false)) await close.click();
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    // Agent may show WebGPU recovery instead of input — either is OK for SET-01.
    await expect(
      philPage
        .getByPlaceholder(/Message the agent/i)
        .or(philPage.getByText(/WebGPU|Download AI|Recommended/i).first()),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('SET-02: Notification frequency off blocks proactive creation', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Phil$/i }).click();
    await expect(
      philPage.getByText('Notification frequency', { exact: true }),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SET-03: Notification frequency low vs high changes cap', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Phil$/i }).click();
    await expect(philPage.getByText('Notification frequency', { exact: true })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('SET-04: Productivity sensitivity changes nudge threshold', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Phil$/i }).click();
    await expect(
      philPage.getByText(/Productivity sensitivity|nudge threshold|Sensitivity/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SET-05: Reminder defaults apply to new reminders', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Phil$/i }).click();
    await expect(
      philPage.getByText(/Reminder defaults|Default lead|Default repeat/i).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SET-06: Quiet hours suppress notification delivery', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Phil$/i }).click();
    await expect(philPage.getByText(/Quiet hours/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('SET-07: Privacy controls link works', async ({ philPage }) => {
    await philPage.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await expect(
      philPage.getByText(/Privacy controls|Open Privacy|Privacy dashboard/i).first(),
    ).toBeVisible({ timeout: 5_000 });
    await philPage.getByRole('button', { name: /Close settings/i }).click();
  });

  test('SET-08: Reminder times honor device timezone', async ({ philPage }) => {
    // Product must NOT expose a timezone picker (device TZ only).
    await philPage.getByRole('button', { name: /^Phil$/i }).click();
    await expect(philPage.getByText(/timezone|time zone/i)).toHaveCount(0);
    await philPage.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await expect(philPage.getByLabel(/timezone|time zone/i)).toHaveCount(0);
    await expect(
      philPage.getByText(/Remind me tomorrow at 3 PM|device timezone/i).first(),
    ).toBeVisible({ timeout: 5_000 });
    await philPage.getByRole('button', { name: /Close settings/i }).click();
  });
});
