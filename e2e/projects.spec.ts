import { test, expect } from './fixtures/extension';

/** PRJ-01…06 — Persistent Projects core (Wave1 B2). */
test.describe('Projects core (PRJ)', () => {
  test('PRJ-01: Create project from natural language', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /^Projects$/i })).toBeVisible({
      timeout: 5_000,
    });
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Staff Engineer Promotion');
    await philPage.getByLabel(/Project template/i).selectOption('career');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/Staff Engineer Promotion/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(philPage.getByText(/I've set up your .* project/i).first()).toBeVisible();
    await expect(philPage.getByText(/Career Accelerator/i).first()).toBeVisible();
    await expect(
      philPage.getByText(/Get started on|Map Staff Engineer|System design|roadmap/i).first(),
    ).toBeVisible();
  });

  test('PRJ-02: Attach artifacts to a project', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Move to Spain');
    await philPage.getByLabel(/Project template/i).selectOption('life_move');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/project artifacts/i)).toBeVisible({ timeout: 5_000 });
    await philPage.getByRole('button', { name: /\+ linked reminder/i }).click();
    await philPage.getByRole('button', { name: /\+ knowledge/i }).click();
    await expect(philPage.getByText(/linked reminder/i).first()).toBeVisible();
    await expect(philPage.getByText(/knowledge/i).first()).toBeVisible();
    await expect(philPage.getByText(/Starter research note/i)).toBeVisible();
  });

  test('PRJ-03: Project appears in daily briefing', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Job Hunt Q3');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/Job Hunt Q3/i).first()).toBeVisible({ timeout: 5_000 });

    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await philPage.getByRole('button', { name: /^Refresh$/i }).click();
    await expect(philPage.getByText(/project/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/Job Hunt Q3|Active project/i).first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test('PRJ-04: Switch / list projects', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await expect(philPage.getByText(/What projects|active project|Projects/i).first()).toBeVisible({
      timeout: 5_000,
    });

    await philPage.getByLabel(/New project title/i).fill('Career Track');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Research Notes');
    await philPage.getByRole('button', { name: /^Create$/i }).click();

    await expect(philPage.getByText(/Career Track/i).first()).toBeVisible();
    await expect(philPage.getByText(/Research Notes/i).first()).toBeVisible();
    await expect(philPage.getByText(/active project/i).first()).toBeVisible();
  });

  test('PRJ-05: Project progress query', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Buy a House');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/Where am I/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/workstream/i).first()).toBeVisible();
    await expect(philPage.getByText(/next-week/i).first()).toBeVisible();
  });

  test('PRJ-06: No orphan feature spam', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await expect(philPage.getByText(/project terms/i).first()).toBeVisible({ timeout: 5_000 });
    await philPage.getByLabel(/New project title/i).fill('Move to Spain');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/I've set up your .* project/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });
});
