import { test, expect } from './fixtures/extension';

/** PRJ-CA-* Career Accelerator. */
test.describe('Projects Career (PRJ-CA)', () => {
  test('PRJ-CA-01: Immediate setup', async ({ philPage }) => {
    await expect(philPage.getByText(/Staff Engineer|Career Accelerator|12.month|roadmap/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-CA-02: Next day briefing + browse awareness', async ({ philPage }) => {
    await expect(philPage.getByText(/study task|system design|productive toward/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-CA-03: Week later: no progress nudge', async ({ philPage }) => {
    await expect(philPage.getByText(/no progress|adjusting the schedule/i)).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-CA-04: Month later: progress + realism', async ({ philPage }) => {
    await expect(philPage.getByText(/12-month|realistic|weak areas/i)).toBeVisible({ timeout: 5_000 });
  });
});
