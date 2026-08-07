import { test, expect } from './fixtures/extension';

/** ERR-* — robust error handling (Wave1 B3). */
test.describe('Errors (ERR)', () => {
  test('ERR-01: WebGPU unavailable shows recovery, not a crash', async ({ philPage }) => {
    await expect(philPage.getByText(/WebGPU|local AI needs|Chrome\/Edge|hardware/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('ERR-02: Model load failure offers a smaller model', async ({ philPage }) => {
    await expect(philPage.getByText(/smaller|fallback model|try.*model/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('ERR-03: Failed web research stays helpful', async ({ philPage }) => {
    await expect(philPage.getByText(/could not parse|opened search|Google/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('ERR-04: Generic Agent errors show cause + next action', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    // Must not surface Milestone / developer stub errors in empty state.
    await expect(philPage.getByText(/Milestone|not implemented/i)).toHaveCount(0);
    await expect(philPage.getByText(/Retry|check permissions|open Privacy|what went wrong/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
