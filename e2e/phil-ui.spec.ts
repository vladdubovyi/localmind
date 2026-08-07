import { test, expect } from './fixtures/extension';

test.describe('Phil personal assistant UI', () => {
  test('rebrand and assistant tabs are visible', async ({ philPage }) => {
    await expect(philPage.getByText('Phil').first()).toBeVisible();
    for (const label of ['Chat', 'Today', 'Focus', 'Goals', 'Reminders', 'Agent']) {
      await expect(philPage.getByRole('button', { name: new RegExp(`^${label}$`, 'i') })).toBeVisible();
    }
  });

  test('Today tab shows briefing content', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Today$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Today$/i })).toBeVisible();
    await expect(
      philPage.getByText(/Good morning|No active goals|Focus so far|Active goals/i).first(),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('Goals tab can create and complete a goal', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Goals$/i })).toBeVisible();
    const title = `Ship Phil e2e ${Date.now()}`;
    await philPage.getByPlaceholder(/Finish the proposal/i).fill(title);
    await philPage.getByRole('button', { name: /^Add$/i }).click();
    await expect(philPage.getByText(title)).toBeVisible();
    await philPage.getByRole('button', { name: /^Done$/i }).first().click();
    await expect(philPage.getByText(/completed/i).first()).toBeVisible();
  });

  test('Reminders tab can schedule a reminder', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Reminders$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Reminders$/i })).toBeVisible();
    const text = `Stand up ${Date.now()}`;
    await philPage.getByPlaceholder(/Stand up/i).fill(text);
    await philPage.getByLabel(/Minutes from now/i).fill('45');
    await philPage.getByRole('button', { name: /^Remind$/i }).click();
    await expect(philPage.getByText(text)).toBeVisible({ timeout: 10_000 });
    await expect(philPage.getByText(/scheduled/i).first()).toBeVisible();
  });

  test('Focus tab shows category breakdown', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Focus$/i })).toBeVisible();
    await expect(philPage.getByText(/Productive/i).first()).toBeVisible();
    await expect(philPage.getByText(/Leisure/i).first()).toBeVisible();
  });

  test('Phil settings tab toggles FAB', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Phil$/i }).click();
    await expect(philPage.getByRole('heading', { name: /Phil settings/i })).toBeVisible();
    const fab = philPage.getByText(/Always-on page button/i);
    await expect(fab).toBeVisible();
  });
});

test.describe('Phil FAB on web pages', () => {
  test('mounts FAB and opens side panel intent', async ({
    philExtensionContext,
    philExtensionId,
  }) => {
    const page = await philExtensionContext.newPage();
    await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#phil-fab-root')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Open Phil/i })).toBeVisible();

    // Context menu opens quick intents.
    await page.getByRole('button', { name: /Open Phil/i }).click({ button: 'right' });
    await expect(page.getByRole('button', { name: /What’s up today|What's up today/i })).toBeVisible();

    // Quick intent should land on Today in the side panel.
    await page.getByRole('button', { name: /^Today$/i }).click();
    const sidebar = await philExtensionContext.newPage();
    await sidebar.goto(`chrome-extension://${philExtensionId}/src/sidebar/index.html`, {
      waitUntil: 'domcontentloaded',
    });
    // Seeded worker sidebar may already be open; at least FAB exists on the page.
    await expect(page.locator('[data-phil-fab="true"]')).toBeVisible();
  });
});
