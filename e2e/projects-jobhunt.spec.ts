import { test, expect } from './fixtures/extension';

/** PRJ-JH-* Job Hunt Copilot. */
test.describe('Projects Job Hunt (PRJ-JH)', () => {
  test('PRJ-JH-01: Create job-hunt project with constraints', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Remote backend job paying at least €120k');
    await philPage.getByLabel(/Project template/i).selectOption('job_hunt');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/€120k|120k|remote|Job Hunt/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/backend/i).first()).toBeVisible();
  });

  test('PRJ-JH-02: Daily job search loop', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Remote backend job paying at least €120k');
    await philPage.getByLabel(/Project template/i).selectOption('job_hunt');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await philPage.getByRole('button', { name: /Run daily job search/i }).click();
    await expect(philPage.getByText(/any new jobs|top matches|duplicates/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-JH-03: Per-job application assistance', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Remote backend job paying at least €120k');
    await philPage.getByLabel(/Project template/i).selectOption('job_hunt');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await philPage.getByRole('button', { name: /Run daily job search/i }).click();
    await philPage.getByRole('button', { name: /Application assistance/i }).click();
    await expect(philPage.getByText(/cover letter|CV|application status/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
