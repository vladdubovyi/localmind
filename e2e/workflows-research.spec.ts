import { test, expect } from './fixtures/extension';

/** WF research workflows — Google-default fixture path (no model required). */
test.describe('Workflows research (WF-01/06/16)', () => {
  test('WF-01: Research + decision making (mechanical keyboard)', async ({
    philPage,
  }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill(
      "I'm looking for a mechanical keyboard under $150 with hot-swappable switches. Compare the best options and recommend one.",
    );
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(
      philPage.getByText(/ranked recommendation|trade-off|Keychron|hot-swap/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await expect(philPage.getByText(/mechanical keyboard|Keychron/i).first()).toBeVisible();
  });

  test('WF-06: Internet research with follow-up (PM tools)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill('Find the three best project management tools for startups.');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(
      philPage.getByText(/project management|Linear|Asana|ClickUp/i).first(),
    ).toBeVisible({ timeout: 30_000 });
    await input.fill('Which one has the best API?');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(philPage.getByText(/best API|Linear|prior/i).first()).toBeVisible({
      timeout: 30_000,
    });
  });

  test('WF-16: Smart search (Warsaw → Tokyo flights)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill('Find the cheapest direct flight from Warsaw to Tokyo in April.');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(
      philPage.getByText(/Warsaw|Tokyo|direct flight/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
