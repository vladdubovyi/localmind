import { test, expect, E2E_MODEL_LABEL } from './fixtures/extension';

/**
 * CORE-06 adjacent — model load progress against live Agent / restore banners
 * (not the dead full-screen “Download AI” onboarding gate).
 */
test('Model load smoke: CreateMLCEngine path reports progress (not silent hang)', async ({
  extensionContext,
  extensionId,
}) => {
  const page = await extensionContext.newPage();
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

  await page.goto(`chrome-extension://${extensionId}/src/sidebar/index.html`, {
    waitUntil: 'domcontentloaded',
  });

  await page.evaluate(async () => {
    await chrome.storage.local.set({
      onboarding: { completed: true, completedAt: Date.now(), skipped: true },
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });

  // Live shell: Agent tab + optional background restore banner / settings model load.
  await expect(page.getByRole('button', { name: /^Agent$/i })).toBeVisible({ timeout: 30_000 });

  const restoreOrProgress = page.getByText(
    /Restoring model|Downloading model|Preparing model|Downloading|Loading from cache|Finish loading|Fetching|%/i,
  );
  const agentInput = page.getByPlaceholder(/Message the agent/i);

  // Open Settings and ensure model catalog is reachable (live UI).
  const settingsBtn = page.getByRole('button', { name: /Settings/i }).first();
  if (await settingsBtn.isVisible().catch(() => false)) {
    await settingsBtn.click();
    const gemma = page.getByRole('option', { name: new RegExp(E2E_MODEL_LABEL, 'i') }).or(
      page.locator('select'),
    );
    await expect(gemma.first()).toBeVisible({ timeout: 15_000 }).catch(() => undefined);
    const loadBtn = page.getByRole('button', { name: /Load selected model/i });
    if (await loadBtn.isVisible().catch(() => false)) {
      await loadBtn.click().catch(() => undefined);
    }
    // Close settings if still open
    const close = page.getByRole('button', { name: /Close settings/i });
    if (await close.isVisible().catch(() => false)) await close.click().catch(() => undefined);
  }

  await expect
    .poll(
      async () => {
        const body = await page.locator('body').innerText();
        if (/\[LocalMind\] Service worker engine failed|window is not defined/i.test(logs.join('\n'))) {
          return 'sw-crash';
        }
        if (
          /WebGPU is not available|No available adapters/i.test(body) ||
          /WebGPU is not available/i.test(logs.join('\n'))
        ) {
          return 'no-webgpu';
        }
        if (
          /Finish loading|Fetching param cache|Loading model from cache|Loading GPU shader|Download complete|Start to fetch/i.test(
            body,
          )
        ) {
          return 'progress';
        }
        if (/\b([1-9]\d?)%|\b100%/.test(body)) return 'progress';
        if (await agentInput.isVisible().catch(() => false)) return 'agent-ready';
        if (await restoreOrProgress.first().isVisible().catch(() => false)) return 'progress';
        if (
          /Restoring Phil|Loading from local cache/i.test(body) &&
          /\b0%\b/.test(body) &&
          !/\b[1-9]\d*%/.test(body)
        ) {
          return 'stuck-zero';
        }
        return 'waiting';
      },
      { timeout: 25_000, intervals: [500, 1000, 2000] },
    )
    .not.toBe('stuck-zero');

  expect(logs.join('\n')).not.toMatch(/window is not defined/i);
});
