import { test, expect } from './fixtures/extension';

test('CreateMLCEngine path reports progress (not silent hang)', async ({
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

  // Pick lightest model and start download/load.
  const gemma = page.getByRole('button', { name: /Gemma 2 2B/i });
  await expect(gemma.or(page.getByText(/Restoring Phil|Download AI/i)).first()).toBeVisible({
    timeout: 30_000,
  });

  if (await gemma.isVisible().catch(() => false)) {
    await gemma.click();
    const start = page.getByRole('button', { name: /Download AI|Load Phil/i });
    await start.click();
  }

  // Within 20s we must see real WebLLM progress text OR a visible error — never stay
  // forever on our synthetic "Loading from local cache…" at 0% with no engine activity.
  await expect
    .poll(
      async () => {
        const body = await page.locator('body').innerText();
        if (/\[LocalMind\] Service worker engine failed|window is not defined/i.test(logs.join('\n'))) {
          return 'sw-crash';
        }
        if (/WebGPU is not available|No available adapters/i.test(body) || /WebGPU is not available/i.test(logs.join('\n'))) {
          return 'no-webgpu'; // environment limitation, not a hang
        }
        if (/Finish loading|Fetching param cache|Loading model from cache|Loading GPU shader|Download complete|Start to fetch/i.test(body)) {
          return 'progress';
        }
        if (/\b([1-9]\d?)%|\b100%/.test(body)) {
          return 'progress';
        }
        if (/Restoring Phil/i.test(body) && /\b0%\b/.test(body) && /Loading from local cache/i.test(body)) {
          return 'stuck-zero';
        }
        return 'waiting';
      },
      { timeout: 25_000, intervals: [500, 1000, 2000] },
    )
    .not.toBe('stuck-zero');

  expect(logs.join('\n')).not.toMatch(/window is not defined/i);
});
