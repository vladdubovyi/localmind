import { test, expect } from './fixtures/extension';

/** WF research workflows. */
test.describe('Workflows research (WF-01/06/16)', () => {
  test('WF-01: Research + decision making (mechanical keyboard)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText(/mechanical keyboard|ranked recommendation|trade-off/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('WF-06: Internet research with follow-up (PM tools)', async ({ philPage }) => {
    await expect(philPage.getByText(/project management|best API/i)).toBeVisible({ timeout: 5_000 });
  });

  test('WF-16: Smart search (Warsaw → Tokyo flights)', async ({ philPage }) => {
    await expect(philPage.getByText(/Warsaw|Tokyo|direct flight/i)).toBeVisible({ timeout: 5_000 });
  });
});
