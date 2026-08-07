import { test, expect } from './fixtures/extension';

/** PRJ-CA-* Career Accelerator. */
test.describe('Projects Career (PRJ-CA)', () => {
  test('PRJ-CA-01: Immediate setup', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Staff Engineer within 12 months');
    await philPage.getByLabel(/Project template/i).selectOption('career');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/Career Accelerator|Staff Engineer/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/12.month|roadmap|weekly study/i).first()).toBeVisible();
    await expect(philPage.getByText(/System design|Learning roadmap/i).first()).toBeVisible();
    await expect(philPage.getByText(/recurring study|Shall I schedule/i).first()).toBeVisible();
  });

  test('PRJ-CA-02: Next day briefing + browse awareness', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Staff Engineer Promotion');
    await philPage.getByLabel(/Project template/i).selectOption('career');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/Study task|system design/i).first()).toBeVisible({ timeout: 5_000 });
    await philPage.getByRole('button', { name: /Simulate browse awareness/i }).click();
    await expect(philPage.getByText(/productive toward|system design/i).first()).toBeVisible({ timeout: 5_000 });
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await philPage.getByRole('button', { name: /^Refresh$/i }).click();
    await expect(philPage.getByText(/study task|system design|Staff Engineer/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('PRJ-CA-03: Week later: no progress nudge', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Staff Engineer Promotion');
    await philPage.getByLabel(/Project template/i).selectOption('career');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await philPage.getByRole('button', { name: /Week later: no progress nudge/i }).click();
    await expect(philPage.getByText(/no progress|adjusting the schedule/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-CA-04: Month later: progress + realism', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('Staff Engineer Promotion');
    await philPage.getByLabel(/Project template/i).selectOption('career');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await philPage.getByRole('button', { name: /Month later: progress review/i }).click();
    await expect(philPage.getByText(/12-month|realistic|weak areas/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
