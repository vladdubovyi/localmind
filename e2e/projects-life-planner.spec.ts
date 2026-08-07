import { test, expect } from './fixtures/extension';

/** PRJ-LP-* Personal Life Planner. */
test.describe('Projects Life Planner (PRJ-LP)', () => {
  test('PRJ-LP-01: Master project with subprojects', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Move to Spain');
    await philPage.getByLabel(/Project template/i).selectOption('life_move');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/Move to Spain|Apartment|Visa|Banking/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/Flights|Insurance|Packing/i).first()).toBeVisible();
  });

  test('PRJ-LP-02: Automatic orchestration', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Move to Spain');
    await philPage.getByLabel(/Project template/i).selectOption('life_move');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/visa|flights|missing documents|deadline/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-LP-03: Daily briefing specifics', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Move to Spain');
    await philPage.getByLabel(/Project template/i).selectOption('life_move');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/book flights|visa appointment|electricity/i).first()).toBeVisible({ timeout: 5_000 });
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await philPage.getByRole('button', { name: /^Refresh$/i }).click();
    await expect(philPage.getByText(/book flights|visa appointment|electricity/i).first()).toBeVisible({ timeout: 8_000 });
  });
});
