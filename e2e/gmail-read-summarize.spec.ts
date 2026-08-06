import { expect, test } from './fixtures/extension';

test.describe('Gmail product — read & summarize via agent chat', () => {
  test('agent reads and summarizes the weekly digest email', async ({
    agentPage,
    gmailPage,
    sendAgentGoal,
  }) => {
    test.setTimeout(8 * 60_000);
    await expect(gmailPage.locator('tr.zA')).toHaveCount(5);

    await sendAgentGoal('Which 5 emails did I get last? Use gmail_list.');
    await expect(agentPage.getByText(/Weekly product digest/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await sendAgentGoal(
      'Summarize the Weekly product digest email. Use gmail_read on that message, then give a short summary with the action items.',
    );

    await expect(agentPage.getByText(/Reading email|gmail read|gmail_read/i).first()).toBeVisible({
      timeout: 60_000,
    });

    // Summary should reflect fixture body (dark mode / action items / demo).
    await expect(
      agentPage.getByText(/dark mode|action items|Friday demo|shipped/i).first(),
    ).toBeVisible({ timeout: 60_000 });
  });
});
