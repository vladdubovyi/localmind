/**
 * CORE-10 — Verifies restore UI does not hang at 0% when model meta says ready.
 * Aligns with live Agent shell + background restore banner (not dead Download AI UI).
 */
import { test, expect } from './fixtures/extension';

test.describe('WebLLM restore (CORE-10)', () => {
  test('CORE-10: Model restore from cache', async ({ extensionContext, extensionId }) => {
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

    await expect(page.getByRole('button', { name: /^Agent$/i })).toBeVisible({ timeout: 30_000 });

    const restoring = page.getByText(
      /Restoring model|Restoring Phil|Preparing model|Downloading model|Loading from cache/i,
    );
    const agentInput = page.getByPlaceholder(/Message the agent/i);

    // Either Agent is already usable, or a restore banner is progressing — never stuck 0% forever.
    if (await agentInput.isVisible().catch(() => false)) {
      await expect(agentInput).toBeEnabled();
      return;
    }

    await expect(restoring.or(agentInput).first()).toBeVisible({ timeout: 30_000 });

    if (!(await restoring.first().isVisible().catch(() => false))) {
      // Cache miss → Agent shell without restore banner is acceptable for this path.
      return;
    }

    await expect
      .poll(
        async () => {
          const body = await page.locator('body').innerText();
          if (await agentInput.isVisible().catch(() => false)) return 'ready';
          if (
            /Loading model|Finish loading|Fetching|cache\[|Downloading|Try again|WebGPU|Preparing model|Restoring model in the background/i.test(
              body,
            ) &&
            !(
              /Loading from local cache…/i.test(body) &&
              /\b0%\b/.test(body) &&
              !/\b[1-9]\d*%/.test(body)
            )
          ) {
            if (/Loading from local cache…/i.test(body) && /\b0%\b/.test(body)) {
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
      .not.toBe('stuck');
  });
});
