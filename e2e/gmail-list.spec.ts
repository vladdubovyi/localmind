import { expect, test } from './fixtures/extension';

test.describe('Gmail product — list recent mail via agent chat', () => {
  test('agent lists recent emails from the Gmail tab', async ({
    agentPage,
    gmailPage,
    sendAgentGoal,
  }) => {
    test.setTimeout(5 * 60_000);
    await expect(gmailPage.locator('tr.zA')).toHaveCount(5);

    await sendAgentGoal('Which 5 emails did I get last? Use gmail_list.');

    await expect(agentPage.getByText(/Checking Gmail|gmail list|gmail_list/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Final (or tool) transcript should surface real fixture subjects — not invented ones.
    await expect(agentPage.getByText(/Weekly product digest/i).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(agentPage.getByText(/Invoice #4821/i).first()).toBeVisible();
  });
});
