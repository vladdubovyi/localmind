import { test, expect } from './fixtures/extension';

/** PRJ-LP-* Personal Life Planner. */
test.describe('Projects Life Planner (PRJ-LP)', () => {
  test('PRJ-LP-01: Master project with subprojects', async ({ philPage }) => {
    await expect(philPage.getByText(/Move to Spain|Apartment|Visa|Banking/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-LP-02: Automatic orchestration', async ({ philPage }) => {
    await expect(philPage.getByText(/visa|flights|missing documents|deadline/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-LP-03: Daily briefing specifics', async ({ philPage }) => {
    await expect(philPage.getByText(/book flights|visa appointment|electricity/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
