import { test, expect } from './fixtures/extension';

/** BRW-* — browser memory (Wave2 C4). */
test.describe('Browser memory (BRW)', () => {
  test('BRW-01: Find article from last week with history granted', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText(/Kubernetes operators|browser memory|History/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('BRW-02: Open found result', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /^Open$/i })).toBeVisible({ timeout: 5_000 });
  });

  test('BRW-03: Without history permission, Phil explains how to enable', async ({ philPage }) => {
    await expect(philPage.getByText(/History enabled in Privacy|browser memory needs History/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('BRW-04: Clear / disable browser memory removes results', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /Clear browser memory|Disable browser memory/i })).toBeVisible({
      timeout: 5_000,
    });
  });
});
