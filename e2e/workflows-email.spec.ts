import { test, expect, type Page } from './fixtures/extension';

async function openAgentTest(philPage: Page, philExtensionId: string): Promise<void> {
  await philPage.goto(
    `chrome-extension://${philExtensionId}/src/sidebar/index.html?philTest=1`,
    { waitUntil: 'domcontentloaded' },
  );
  await expect(philPage.getByRole('button', { name: /^Agent$/i })).toBeVisible({
    timeout: 30_000,
  });
  await philPage.getByRole('button', { name: /^Agent$/i }).click();
  await expect(philPage.getByPlaceholder(/Message the agent/i)).toBeVisible({
    timeout: 20_000,
  });
}


/** WF-05 email workflow — preview + confirm before send. */
test.describe('Workflows email', () => {
  test('WF-05: Email workflow (reply to John)', async ({ philPage, philExtensionId }) => {
    await openAgentTest(philPage, philExtensionId);
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await input.fill("Reply to John's last email saying I can meet Thursday afternoon.");
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(
      philPage.getByText(/John|Thursday afternoon|preview|confirm/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
