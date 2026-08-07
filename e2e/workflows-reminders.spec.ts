import { test, expect } from './fixtures/extension';

/** WF reminders. */
test.describe('Workflows reminders', () => {
  test('WF-04: Reminder from conversation (landlord call)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Reminders$/i }).click();
    await expect(philPage.getByText(/landlord|next Tuesday|3\s*PM/i)).toBeVisible({ timeout: 5_000 });
  });

  test('WF-09: Reminder chaining (every Friday finances)', async ({ philPage }) => {
    await expect(philPage.getByText(/every Friday|review my finances|recurring/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('WF-15: Intelligent reminder (YouTube hour)', async ({ philPage }) => {
    await expect(philPage.getByText(/YouTube|hour|threshold/i)).toBeVisible({ timeout: 5_000 });
  });

  test('WF-18: Conflicting reminders (gym vs language class)', async ({ philPage }) => {
    await expect(philPage.getByText(/conflict|reschedule|language class|gym/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
