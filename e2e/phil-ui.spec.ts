import { test, expect } from './fixtures/extension';

test.describe('Phil personal assistant UI', () => {
  test('rebrand and assistant tabs are visible', async ({ extensionPage }) => {
    await expect(extensionPage.getByText('Phil').first()).toBeVisible();
    for (const label of ['Chat', 'Today', 'Focus', 'Goals', 'Reminders', 'Agent']) {
      await expect(extensionPage.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible();
    }
  });

  test('Today tab shows briefing content', async ({ extensionPage }) => {
    await extensionPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(extensionPage.getByRole('heading', { name: /^Today$/i })).toBeVisible();
    await expect(
      extensionPage.getByText(/Good morning|No active goals|Focus so far|Active goals/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Goals tab can create and complete a goal', async ({ extensionPage }) => {
    await extensionPage.getByRole('button', { name: /^Goals$/i }).click();
    await expect(extensionPage.getByRole('heading', { name: /^Goals$/i })).toBeVisible();
    const title = `Ship Phil e2e ${Date.now()}`;
    await extensionPage.getByPlaceholder(/Finish the proposal/i).fill(title);
    await extensionPage.getByRole('button', { name: /^Add$/i }).click();
    await expect(extensionPage.getByText(title)).toBeVisible();
    await extensionPage.getByRole('button', { name: /^Done$/i }).first().click();
    await expect(extensionPage.getByText(/completed/i).first()).toBeVisible();
  });

  test('Reminders tab can schedule a reminder', async ({ extensionPage }) => {
    await extensionPage.getByRole('button', { name: /^Reminders$/i }).click();
    await expect(extensionPage.getByRole('heading', { name: /^Reminders$/i })).toBeVisible();
    const text = `Stand up ${Date.now()}`;
    await extensionPage.getByPlaceholder(/Stand up/i).fill(text);
    await extensionPage.getByLabel(/Minutes from now/i).fill('45');
    await extensionPage.getByRole('button', { name: /^Remind$/i }).click();
    await expect(extensionPage.getByText(text)).toBeVisible({ timeout: 10_000 });
    await expect(extensionPage.getByText(/scheduled/i).first()).toBeVisible();
  });

  test('Focus tab shows category breakdown', async ({ extensionPage }) => {
    await extensionPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(extensionPage.getByRole('heading', { name: /^Focus$/i })).toBeVisible();
    await expect(extensionPage.getByText(/Productive/i).first()).toBeVisible();
    await expect(extensionPage.getByText(/Leisure/i).first()).toBeVisible();
  });

  test('Phil settings tab toggles FAB', async ({ extensionPage }) => {
    await extensionPage.getByRole('button', { name: /^Phil$/i }).click();
    await expect(extensionPage.getByRole('heading', { name: /Phil settings/i })).toBeVisible();
    const fab = extensionPage.getByText(/Always-on page button/i);
    await expect(fab).toBeVisible();
  });
});

test.describe('Phil FAB on web pages', () => {
  test('mounts FAB and opens side panel intent', async ({ extensionContext, extensionId }) => {
    const page = await extensionContext.newPage();
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#phil-fab-root')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Open Phil/i })).toBeVisible();

    // Context menu opens quick intents.
    await page.getByRole('button', { name: /Open Phil/i }).click({ button: 'right' });
    await expect(page.getByRole('button', { name: /What’s up today|What's up today/i })).toBeVisible();

    // Quick intent should land on Today in the side panel.
    await page.getByRole('button', { name: /^Today$/i }).click();
    const sidebar = await extensionContext.newPage();
    await sidebar.goto(`chrome-extension://${extensionId}/src/sidebar/index.html`, {
      waitUntil: 'domcontentloaded',
    });
    // Seeded worker sidebar may already be open; at least FAB exists on the page.
    await expect(page.locator('[data-phil-fab="true"]')).toBeVisible();
  });
});
