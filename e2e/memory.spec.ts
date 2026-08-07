import { test, expect } from './fixtures/extension';

/** MEM-* — persistent memory (Wave1 B4). Prefer fail-on-missing UI. */
test.describe('Memory (MEM)', () => {
  test('MEM-01: Remember this via natural language', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText(/Memories|Remember that/i)).toBeVisible({ timeout: 5_000 });
  });

  test('MEM-02: Remember this from a message action', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /^Remember$/i })).toBeVisible({ timeout: 5_000 });
  });

  test('MEM-03: Recall remembered facts later', async ({ philPage }) => {
    await expect(philPage.getByText(/briefings at 7|remembered/i)).toBeVisible({ timeout: 5_000 });
  });

  test('MEM-04: Forget this removes the fact', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /Forget/i })).toBeVisible({ timeout: 5_000 });
  });

  test('MEM-05: Search previous conversations by keyword', async ({ philPage }) => {
    await expect(philPage.getByPlaceholder(/Search conversations|Search/i)).toBeVisible({ timeout: 5_000 });
  });

  test('MEM-06: Memory off stops new indexing', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /Settings/i }).click();
    // Must not be a disabled Milestone 4 fake toggle only.
    const toggle = philPage.getByText(/Memory \(coming in Milestone 4\)/i);
    if (await toggle.isVisible().catch(() => false)) {
      expect(false, 'Memory still shows Milestone 4 stub — MEM-06 blocked').toBeTruthy();
    }
    await expect(philPage.getByText(/Memory.*off|memory is off/i)).toBeVisible({ timeout: 5_000 });
  });

  test('MEM-07: No Milestone / coming-soon memory UI', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /Settings/i }).click();
    const body = await philPage.locator('body').innerText();
    expect(body).not.toMatch(/Milestone \d/i);
    expect(body).not.toMatch(/coming soon/i);
  });
});
