import { test, expect } from './fixtures/extension';

/** WF-05 email workflow. */
test.describe('Workflows email', () => {
  test('WF-05: Email workflow (reply to John)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText(/John|Thursday afternoon|preview|confirm/i)).toBeVisible({
      timeout: 5_000,
    });
  });
});
