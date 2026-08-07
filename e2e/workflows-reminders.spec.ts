import { test, expect } from './fixtures/extension';

/** WF reminders — absolute TZ + weekly + conflicts (no model required). */
test.describe('Workflows reminders', () => {
  test('WF-04: Reminder from conversation (landlord call)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill('Remind me to call my landlord next Tuesday at 3 PM.');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(philPage.getByText(/landlord|Reminder set/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await philPage.getByRole('button', { name: /^Reminders$/i }).click();
    await expect(philPage.getByText(/landlord/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('WF-09: Reminder chaining (every Friday finances)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill('Remind me every Friday to review my finances.');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(
      philPage.getByText(/finances|recurring|weekly|Reminder set/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await philPage.getByRole('button', { name: /^Reminders$/i }).click();
    await expect(philPage.getByText(/finances|recurring|weekly/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('WF-15: Intelligent reminder (YouTube hour)', async ({ philPage }) => {
    // Owned primarily by C2 proactive; assert Settings threshold copy still present.
    await philPage.getByRole('button', { name: 'Settings', exact: true }).first().click();
    await expect(
      philPage.getByText(/YouTube|threshold|nudge|sensitivity|leisure/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('WF-18: Conflicting reminders (gym vs language class)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill('Remind me to go to the gym every weekday at 18:00.');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(philPage.getByText(/gym|Reminder set/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await input.fill('Every Tuesday at 18:00 remind me to attend my language class.');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(
      philPage.getByText(/conflict|reschedule|language class|gym/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
