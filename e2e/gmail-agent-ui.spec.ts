import { expect, test } from './fixtures/extension';

test.describe('Gmail product — agent settings UI', () => {
  test('Agent settings expose Gmail session/API mode after model load', async ({
    agentPage,
  }) => {
    test.setTimeout(2 * 60_000);

    await agentPage.getByRole('button', { name: /^Settings$/ }).last().click();
    await expect(agentPage.getByText('Gmail mode')).toBeVisible();

    const mode = agentPage.locator('select').filter({
      has: agentPage.locator('option[value="session"]'),
    });
    await expect(mode).toHaveValue('session');
    await expect(
      agentPage.getByRole('button', { name: /Connect Gmail API/i }),
    ).toBeDisabled();
    await expect(agentPage.getByText(/will not auto-click Send/i)).toBeVisible();
    await agentPage.getByRole('button', { name: /Hide settings/i }).click();
  });
});
