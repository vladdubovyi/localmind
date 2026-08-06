/**
 * Verifies restore UI does not hang at 0% when model meta says ready.
 * Engine loads via in-page CreateMLCEngine + Cache API (SW host disabled).
 */
import { test, expect } from './fixtures/extension';

test.describe('WebLLM restore', () => {
  test('restore UI leaves stuck 0% state when meta says ready', async ({
    extensionContext,
    extensionId,
  }) => {
    const page = await extensionContext.newPage();
    await page.goto(`chrome-extension://${extensionId}/src/sidebar/index.html`, {
      waitUntil: 'domcontentloaded',
    });

    await page.evaluate(async () => {
      await chrome.storage.local.set({
        onboarding: { completed: true, completedAt: Date.now(), skipped: true },
      });
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('localmind', 1);
        req.onerror = () => reject(req.error ?? new Error('idb open failed'));
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
          if (!db.objectStoreNames.contains('modelMeta')) {
            db.createObjectStore('modelMeta', { keyPath: 'modelId' });
          }
          if (!db.objectStoreNames.contains('conversations')) {
            db.createObjectStore('conversations', { keyPath: 'id' });
          }
        };
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(['settings', 'modelMeta'], 'readwrite');
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error ?? new Error('idb write failed'));
          tx.objectStore('settings').put(
            {
              selectedModelId: 'gemma-2-2b-it-q4f16_1-MLC',
              theme: 'dark',
              memoryEnabled: false,
              autoSummarize: false,
              generation: {
                temperature: 0.7,
                topP: 0.95,
                maxTokens: 1024,
                systemPrompt: '',
              },
            },
            'app',
          );
          tx.objectStore('modelMeta').put({
            modelId: 'gemma-2-2b-it-q4f16_1-MLC',
            status: 'ready',
            updatedAt: Date.now(),
          });
        };
      });
    });

    await page.reload({ waitUntil: 'domcontentloaded' });

    const restoring = page.getByText(/Restoring LocalMind/i);
    const download = page.getByRole('button', { name: /Download AI|Load LocalMind/i });
    await expect(restoring.or(download).first()).toBeVisible({ timeout: 30_000 });

    if (!(await restoring.isVisible().catch(() => false))) {
      // Cache miss → onboarding is fine; this test cares about the hang path.
      return;
    }

    await expect
      .poll(
        async () => {
          const body = await page.locator('body').innerText();
          if (
            /Loading model|Finish loading|Fetching|cache\[|Downloading|%|Try again|WebGPU/i.test(
              body,
            ) &&
            !(/Loading from local cache…/i.test(body) && /\b0%\b/.test(body) && !/\b[1-9]\d*%/.test(body))
          ) {
            // Progressed, errored visibly, or moved off pure 0% idle copy.
            if (/Loading from local cache…/i.test(body) && /\b0%\b/.test(body)) {
              // Still 0% — only OK briefly at start; treat as stuck if no other signal.
              return /Finish loading|Fetching|Loading model from|Loading GPU|shard/i.test(body)
                ? 'progressed'
                : 'stuck';
            }
            return 'progressed';
          }
          return 'stuck';
        },
        {
          timeout: 25_000,
          intervals: [500, 1000, 2000],
          message: 'Restore UI remained stuck at 0% Loading from local cache',
        },
      )
      .toBe('progressed');
  });
});
