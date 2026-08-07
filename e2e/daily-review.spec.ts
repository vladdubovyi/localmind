import { test, expect } from './fixtures/extension';

/** DAY-* — daily review (Wave2 C2). */
test.describe('Daily review (DAY)', () => {
  test('DAY-01: Morning briefing shows goals, reminders, focus', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Today$/i })).toBeVisible();
    await expect(
      philPage.getByText(/Good morning|Active goals|Focus so far|reminder/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('DAY-02: Suggested priorities appear when data exists', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/Suggested priorities|priority/i)).toBeVisible({ timeout: 5_000 });
  });

  test('DAY-03: Goals completed show in review', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/completed goal|Goals completed/i)).toBeVisible({ timeout: 5_000 });
  });

  test('DAY-04: Evening recap composes', async ({ philPage }) => {
    await expect(philPage.getByText(/Evening recap|evening summary/i)).toBeVisible({ timeout: 5_000 });
  });

  test('DAY-05: Evening notification path fires', async ({ philPage }) => {
    await expect(philPage.getByText(/evening briefing|evening notification|recap/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('DAY-06: Productivity insights are goal-relative', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(philPage.getByText(/toward goals|leisure/i)).toBeVisible({ timeout: 5_000 });
  });
});
