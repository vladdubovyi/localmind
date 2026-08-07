import { test, expect } from './fixtures/extension';

/** PRJ-RP-* Research Project Manager. */
test.describe('Projects Research (PRJ-RP)', () => {
  test('PRJ-RP-01: Create research project', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill("Researching whether to buy an electric car this year");
    await philPage.getByLabel(/Project template/i).selectOption('research');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await expect(philPage.getByText(/electric car|EV|Research project/i).first()).toBeVisible({ timeout: 5_000 });
    await expect(philPage.getByText(/empty but ready|Knowledge store/i).first()).toBeVisible();
  });

  test('PRJ-RP-02: Goal-aware capture while browsing', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('EV purchase research');
    await philPage.getByLabel(/Project template/i).selectOption('research');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await philPage.getByRole('button', { name: /Capture EV fixtures/i }).click();
    await expect(philPage.getByText(/comparison table|conflicting claims|saved.*project/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('PRJ-RP-03: Recommendation from accumulated research', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Projects$/i }).click();
    await philPage.getByLabel(/New project title/i).fill('EV purchase research');
    await philPage.getByLabel(/Project template/i).selectOption('research');
    await philPage.getByRole('button', { name: /^Create$/i }).click();
    await philPage.getByRole('button', { name: /Capture EV fixtures/i }).click();
    await philPage.getByRole('button', { name: /recommendation/i }).click();
    await expect(philPage.getByText(/recommendation|trade-offs|remaining unknowns/i).first()).toBeVisible({ timeout: 5_000 });
  });
});
