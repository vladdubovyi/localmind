import { expect, test } from './fixtures/extension';

const CONFIRM_TIMEOUT = 3 * 60_000;

test.describe('Gmail product — draft & send via agent chat', () => {
  test('CORE-09: Gmail draft/send path (fixture)', async ({
    agentPage,
    gmailPage,
    sendAgentGoal,
    waitForAgentIdle,
  }) => {
    test.setTimeout(8 * 60_000);
    await expect(gmailPage.locator('tr.zA')).toHaveCount(5);

    // Returns on first confirm gate (Working… stays on while awaiting Allow).
    await sendAgentGoal(
      'Use gmail_draft now. to: alex@friends.example Subject: Re: Dinner plans Saturday? Body: Yes — 7pm at the ramen place works for me.',
      { autoAllow: false },
    );

    const allow = agentPage.getByRole('button', { name: /^Allow$/i });
    await expect(allow).toBeVisible({ timeout: CONFIRM_TIMEOUT });
    await expect(agentPage.getByText('Create an email draft', { exact: true })).toBeVisible();
    await allow.click();

    // waitForAgentIdle auto-allows any follow-up confirms the model may raise.
    await waitForAgentIdle();

    await expect(agentPage.getByText(/opened|draft/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(gmailPage.locator('#compose-pane')).toHaveClass(/open/, { timeout: 30_000 });
    await expect(gmailPage.locator('textarea[name="to"]')).toHaveValue(/alex@friends\.example/i);
    await expect(gmailPage.locator('input[name="subjectbox"]')).toHaveValue(/Dinner plans/i);
    await expect(gmailPage.locator('[aria-label="Message Body"]')).toContainText(/7pm|ramen/i);
  });

  test('gmail_send confirm opens draft only — never auto-sends in session mode', async ({
    agentPage,
    gmailPage,
    sendAgentGoal,
    waitForAgentIdle,
  }) => {
    test.setTimeout(8 * 60_000);
    await expect(gmailPage.locator('tr.zA')).toHaveCount(5);

    await sendAgentGoal(
      'Use gmail_send now. to: billing@acme.example Subject: Re: Invoice #4821 Body: Payment scheduled for Friday.',
      { autoAllow: false },
    );

    const allow = agentPage.getByRole('button', { name: /^Allow$/i });
    await expect(allow).toBeVisible({ timeout: CONFIRM_TIMEOUT });
    await expect(agentPage.getByText('Send an email', { exact: true }).first()).toBeVisible();
    await allow.click();
    await waitForAgentIdle();

    await expect(gmailPage.locator('#compose-pane')).toHaveClass(/open/, { timeout: 30_000 });
    await expect(
      agentPage.getByText(/will not auto-send|Click Send yourself/i).first(),
    ).toBeVisible({ timeout: 60_000 });
    await expect(gmailPage.getByRole('button', { name: /^send$/i })).toHaveCount(0);
  });
});
