import { test, expect } from './fixtures/extension';

/** PRJ-GA-* Goal-aware browsing. */
test.describe('Projects Goal-aware browse (PRJ-GA)', () => {
  test('PRJ-GA-01: Monday: create home-buying project', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill("Buying my first home");
    await philPage.getByLabel(/Project template/i).selectOption('custom');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/buying my first home|mortgage|home purchase/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/Apartments|Insurance|Lawyer/i).first()).toBeVisible();
  });

  test('PRJ-GA-02: Tuesday: silent knowledge while browsing', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Buying my first home');
    await philPage.getByLabel(/Project template/i).selectOption('custom');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await philPage.getByRole('button', { name: /Simulate silent browse/i }).click();
    await expect(philPage.getByText(/browse log|knowledge candidate|silent/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-GA-03: Friday: “Where am I?”', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Buying my first home');
    await philPage.getByLabel(/Project template/i).selectOption('custom');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await philPage.getByRole('button', { name: /Seed Friday standing/i }).click();
    await expect(philPage.getByText(/Where am I|timeline|next week.?s action plan/i).first()).toBeVisible({ timeout: 5_000 });
    await philPage.getByRole('button', { name: /Generate next week/i }).click();
    await expect(philPage.getByText(/action plan|mortgage|shortlisted/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
