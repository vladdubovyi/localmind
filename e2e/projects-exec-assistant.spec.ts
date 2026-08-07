import { test, expect } from './fixtures/extension';

/** PRJ-EA-* Browser Executive Assistant day project. */
test.describe('Projects Exec Assistant (PRJ-EA)', () => {
  test('PRJ-EA-01: Morning plan from projects/goals/reminders', async ({ philPage }) => {
    await expect(philPage.getByText(/today.?s plan|agenda|stay productive today/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-EA-02: During the day continuous assistance', async ({ philPage }) => {
    await expect(philPage.getByText(/context switching|focus session|suggest.*break/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-EA-03: Evening auto-recap without prompting', async ({ philPage }) => {
    await expect(philPage.getByText(/evening|work completed|biggest distractions/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
