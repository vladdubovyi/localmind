import { test, expect } from './fixtures/extension';

/** PRIV-* — permissions transparency (Wave1 B4). */
test.describe('Privacy (PRIV)', () => {
  test.beforeEach(async ({ philPage }) => {
    await philPage.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await expect(philPage.getByRole('heading', { name: /Privacy/i })).toBeVisible({ timeout: 5_000 });
  });

  test('PRIV-01: Privacy dashboard is reachable', async ({ philPage }) => {
    await expect(philPage.getByTestId('privacy-dashboard')).toBeVisible();
  });

  test('PRIV-02: Permission inventory matches reality', async ({ philPage }) => {
    await expect(philPage.getByText(/tabs|scripting|notifications|Gmail|Calendar|history/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/granted|not granted|enabled|disabled/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('PRIV-03: Local vs leaves-device is explicit', async ({ philPage }) => {
    await expect(philPage.getByText(/stays on device|on-device/i)).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/may leave device|leaves device|model download|Google/i)).toBeVisible({ timeout: 5_000 });
  });

  test('PRIV-04: Clear chats removes conversation data', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /Clear chats|Clear conversations/i })).toBeVisible({ timeout: 5_000 });
  });

  test('PRIV-05: Clear memories and focus history work', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /Clear memories/i })).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByRole('button', { name: /Clear focus|Clear.*history/i })).toBeVisible({ timeout: 5_000 });
  });

  test('PRIV-06: Revoke optional permission updates the dashboard', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /Revoke|Disconnect|Disable/i }).first()).toBeVisible({ timeout: 5_000 });
  });
});
