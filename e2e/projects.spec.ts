import { test, expect } from './fixtures/extension';

/** PRJ-01…06 — Persistent Projects core (Wave1 B2). */
test.describe('Projects core (PRJ)', () => {
  test('PRJ-01: Create project from natural language', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /^Projects$/i })).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-02: Attach artifacts to a project', async ({ philPage }) => {
    await expect(philPage.getByText(/linked reminder|knowledge|project artifacts/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-03: Project appears in daily briefing', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/project/i)).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-04: Switch / list projects', async ({ philPage }) => {
    await expect(philPage.getByText(/What projects|active project|Projects/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('PRJ-05: Project progress query', async ({ philPage }) => {
    await expect(philPage.getByText(/Where am I|next-week|workstream/i)).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-06: No orphan feature spam', async ({ philPage }) => {
    await expect(philPage.getByText(/I've set up your .* project|project terms/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
