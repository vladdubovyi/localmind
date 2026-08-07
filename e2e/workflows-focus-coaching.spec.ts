import { test, expect } from './fixtures/extension';

/** WF focus / coaching. */
test.describe('Workflows focus & coaching', () => {
  test('WF-07: Productivity coaching (thesis focus)', async ({ philPage }) => {
    await expect(philPage.getByText(/thesis|focus session|productivity summary/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('WF-10: Multi-step assistant (trip to Japan)', async ({ philPage }) => {
    await expect(philPage.getByText(/Japan|travel goal|flights/i)).toBeVisible({ timeout: 5_000 });
  });

  test('WF-19: Productivity classification (“How productive was I today?”)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(philPage.getByText(/productive|neutral|entertainment|leisure/i).first()).toBeVisible();
    await expect(philPage.getByText(/How productive|actionable insight|toward goals/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('WF-20: Autonomous initiative (“Help me stay on track today”)', async ({ philPage }) => {
    await expect(philPage.getByText(/stay on track|focus timer|distraction/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
