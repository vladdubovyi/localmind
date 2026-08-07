import { test, expect } from './fixtures/extension';

/** PRJ-RP-* Research Project Manager. */
test.describe('Projects Research (PRJ-RP)', () => {
  test('PRJ-RP-01: Create research project', async ({ philPage }) => {
    await expect(philPage.getByText(/electric car|EV|Research project/i)).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-RP-02: Goal-aware capture while browsing', async ({ philPage }) => {
    await expect(philPage.getByText(/comparison table|conflicting claims|saved.*project/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-RP-03: Recommendation from accumulated research', async ({ philPage }) => {
    await expect(philPage.getByText(/recommendation|trade-offs|remaining unknowns/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
