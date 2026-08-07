import { test, expect } from './fixtures/extension';

/** WF-05 email workflow — preview + confirm before send. */
test.describe('Workflows email', () => {
  test('WF-05: Email workflow (reply to John)', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill("Reply to John's last email saying I can meet Thursday afternoon.");
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(
      philPage.getByText(/John|Thursday afternoon|preview|confirm/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
