import { test, expect } from './fixtures/extension';

/** WF goals / planning. */
test.describe('Workflows goals & planning', () => {
  test('WF-02: Goal creation from natural language (AWS exam)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    await expect(philPage.getByText(/AWS Solutions Architect|study schedule|milestone/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('WF-03: Daily planning (“Plan my workday”)', async ({ philPage }) => {
    await expect(philPage.getByText(/Plan my workday|agenda|focus block/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('WF-08: Goal progress tracking (this week)', async ({ philPage }) => {
    await expect(philPage.getByText(/How am I doing|overdue|priorities/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('WF-14: Executive assistant (Staff Engineer interview)', async ({ philPage }) => {
    await expect(philPage.getByText(/Staff Engineer interview|study resources/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('WF-17: Long-running conversation (startup six months)', async ({ philPage }) => {
    await expect(philPage.getByText(/startup|six months|milestone/i)).toBeVisible({ timeout: 5_000 });
  });
});
