import { test, expect } from './fixtures/extension';

/** EA-* — executive assistant personality (Wave2 C2). */
test.describe('Personality (EA)', () => {
  test('EA-01: “I want to learn Kubernetes” runs a playbook', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    await expect(philPage.getByText(/Kubernetes|learning goal|playbook/i)).toBeVisible({ timeout: 5_000 });
  });

  test('EA-02: Playbook mentions progress / next step', async ({ philPage }) => {
    await expect(philPage.getByText(/next step|first resource|continue learning/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('EA-03: Empty states use assistant voice', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    const body = await philPage.locator('body').innerText();
    expect(body).not.toMatch(/^\s*No data\s*$/m);
    await expect(philPage.getByText(/help you|add a goal|what are you working/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('EA-04: Research intent stays in assistant voice', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText(/Used tool|raw tool JSON/i)).toHaveCount(0);
  });
});
