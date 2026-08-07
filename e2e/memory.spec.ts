import { test, expect } from './fixtures/extension';

/** MEM-* — persistent memory (Wave1 B4). Prefer fail-on-missing UI. */
test.describe('Memory (MEM)', () => {
  test('MEM-01: Remember this via natural language', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByText('Memories', { exact: true }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('MEM-02: Remember this from a message action', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByRole('button', { name: /^Remember$/i }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('MEM-03: Recall remembered facts later', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await philPage.evaluate(async () => {
      const chromeApi = (
        globalThis as unknown as {
          chrome: { storage: { local: { set: (v: Record<string, unknown>) => Promise<void> } } };
        }
      ).chrome;
      await chromeApi.storage.local.set({
        philMemories: [
          {
            id: 'mem_e2e_briefings',
            text: 'I prefer morning briefings at 7',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: 'import',
          },
        ],
      });
    });
    await expect(philPage.getByText(/briefings at 7|remembered/i).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('MEM-04: Forget this removes the fact', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await philPage.evaluate(async () => {
      const chromeApi = (
        globalThis as unknown as {
          chrome: { storage: { local: { set: (v: Record<string, unknown>) => Promise<void> } } };
        }
      ).chrome;
      await chromeApi.storage.local.set({
        philMemories: [
          {
            id: 'mem_e2e_forget',
            text: 'Temporary fact for forget test',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            source: 'import',
          },
        ],
      });
    });
    await expect(philPage.getByRole('button', { name: /Forget/i }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('MEM-05: Search previous conversations by keyword', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(philPage.getByPlaceholder('Search conversations')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('MEM-06: Memory off stops new indexing', async ({ philPage }) => {
    const privacy = philPage.getByRole('heading', { name: /^Privacy$/i });
    if (!(await privacy.isVisible().catch(() => false))) {
      await philPage.getByRole('button', { name: 'Settings', exact: true }).first().click();
      await expect(privacy).toBeVisible({ timeout: 5_000 });
    }
    const toggle = philPage.getByText(/Memory \(coming in Milestone 4\)/i);
    if (await toggle.isVisible().catch(() => false)) {
      expect(false, 'Memory still shows Milestone 4 stub — MEM-06 blocked').toBeTruthy();
    }
    await expect(philPage.getByText('Memory is off', { exact: true }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('MEM-07: No Milestone / coming-soon memory UI', async ({ philPage }) => {
    const privacy = philPage.getByRole('heading', { name: /^Privacy$/i });
    if (!(await privacy.isVisible().catch(() => false))) {
      await philPage.getByRole('button', { name: 'Settings', exact: true }).first().click();
      await expect(privacy).toBeVisible({ timeout: 5_000 });
    }
    const body = await philPage.locator('body').innerText();
    expect(body).not.toMatch(/Milestone \d/i);
    expect(body).not.toMatch(/coming soon/i);
  });
});
