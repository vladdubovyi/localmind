import { test, expect } from './fixtures/extension';

/** PRJ-GA-* Goal-aware browsing. */
test.describe('Projects Goal-aware browse (PRJ-GA)', () => {
  test('PRJ-GA-01: Monday: create home-buying project', async ({ philPage }) => {
    await expect(philPage.getByText(/buying my first home|mortgage|home purchase/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-GA-02: Tuesday: silent knowledge while browsing', async ({ philPage }) => {
    await expect(philPage.getByText(/browse log|knowledge candidate|silent/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-GA-03: Friday: “Where am I?”', async ({ philPage }) => {
    await expect(philPage.getByText(/Where am I|timeline|next week.?s action plan/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
