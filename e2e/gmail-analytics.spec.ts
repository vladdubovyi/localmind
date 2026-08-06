import { expect, test } from './fixtures/extension';

test.describe('Gmail product — inbox overview / analytics via chat', () => {
  test('agent reports inbox overview stats from listed mail', async ({
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
      'Based on those emails, give me inbox analytics: total count, and categorize into invoices, security, recruiting, and other. Mention Acme Billing and the security sign-in mail.',
    );

    // Model final answer should reason over the tool results.
    await expect(agentPage.getByText(/5|five/i).first()).toBeVisible({ timeout: 60_000 });
    await expect(agentPage.getByText(/invoice|billing|Acme/i).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(agentPage.getByText(/security|sign-in|sign in/i).first()).toBeVisible({
      timeout: 60_000,
    });
  });
});
