import { test, expect } from './fixtures/extension';

/** PRJ-JH-* Job Hunt Copilot. */
test.describe('Projects Job Hunt (PRJ-JH)', () => {
  test('PRJ-JH-01: Create job-hunt project with constraints', async ({ philPage }) => {
    await expect(philPage.getByText(/€120k|120k|remote|Job Hunt/i)).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-JH-02: Daily job search loop', async ({ philPage }) => {
    await expect(philPage.getByText(/any new jobs|top matches|duplicates/i)).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-JH-03: Per-job application assistance', async ({ philPage }) => {
    await expect(philPage.getByText(/cover letter|CV|application status/i)).toBeVisible({ timeout: 5_000 });
  });
});
