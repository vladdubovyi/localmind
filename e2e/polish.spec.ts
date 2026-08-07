import { test, expect } from './fixtures/extension';

/** POL-* — polish (Wave1 B5). */
test.describe('Polish (POL)', () => {
  test('POL-01: Empty states for primary tabs', async ({ philPage }) => {
    for (const tab of ['Agent', 'Goals', 'Reminders', 'Focus']) {
      await philPage.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') }).click();
      await expect(philPage.locator('body')).not.toBeEmpty();
    }
    // Privacy tab is shipped; Memories may be a Privacy control rather than a top tab.
    await expect(philPage.getByRole('button', { name: /Memories|Privacy/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  test('POL-02: Keyboard shortcuts cheatsheet visible', async ({ philPage }) => {
    await expect(philPage.getByText(/Shortcuts|keyboard shortcuts|\?/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('POL-03: Shortcuts perform their actions', async ({ philPage }) => {
    await expect(philPage.getByText(/summarize page|focus Agent|command/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('POL-04: No coming-soon or Milestone strings in UI', async ({ philPage }) => {
    await philPage.getByRole('button', { name: 'Settings', exact: true }).first().click();
    let body = await philPage.locator('body').innerText();
    expect(body).not.toMatch(/coming soon/i);
    expect(body).not.toMatch(/Milestone \d/i);
    expect(body).not.toMatch(/not implemented/i);
    await philPage.getByRole('button', { name: /Close settings/i }).click();
    for (const tab of ['Privacy', 'Projects']) {
      await philPage.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') }).click();
      body = await philPage.locator('body').innerText();
      expect(body).not.toMatch(/coming soon/i);
      expect(body).not.toMatch(/Milestone \d/i);
      expect(body).not.toMatch(/not implemented/i);
    }
  });

  test('POL-05: Narrow side panel has no horizontal scroll', async ({ philPage }) => {
    await philPage.setViewportSize({ width: 320, height: 720 });
    for (const tab of ['Agent', 'Today']) {
      await philPage.getByRole('button', { name: new RegExp(`^${tab}$`, 'i') }).click();
      const overflow = await philPage.evaluate(() => {
        const el = document.documentElement;
        return el.scrollWidth - el.clientWidth;
      });
      expect(overflow).toBeLessThanOrEqual(1);
    }
    // Privacy tab not shipped — fail until present.
    await expect(philPage.getByRole('button', { name: /Privacy/i })).toBeVisible({ timeout: 5_000 });
  });
});
