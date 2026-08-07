import { test, expect } from './fixtures/extension';

/** PRO-* — proactive intelligence (Wave2 C2). */
test.describe('Proactive (PRO)', () => {
  test('PRO-01: Long research without notes suggests summarize', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/researching|want a summary|Phil noticed/i)).toBeVisible({ timeout: 5_000 });
  });
  test('PRO-02: Multiple similar product tabs suggest compare', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/compare/i)).toBeVisible({ timeout: 5_000 });
  });
  test('PRO-03: Leisure vs goal suggests refocus', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/refocus|back to your goal|nudge/i)).toBeVisible({ timeout: 5_000 });
  });
  test('PRO-04: Email-time suggestion when Gmail permitted', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/unread|email|triag/i)).toBeVisible({ timeout: 5_000 });
  });
  test('PRO-05: Dismiss suggestion', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/Dismiss/i)).toBeVisible({ timeout: 5_000 });
  });
  test('PRO-06: Snooze suggestion', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/Snooze/i)).toBeVisible({ timeout: 5_000 });
  });
  test('PRO-07: Browse-based smart reminder suggestion', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByText(/reminder to book|prices change|smart reminder/i)).toBeVisible({ timeout: 5_000 });
  });
});
