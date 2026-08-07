import {
  test as base,
  chromium,
  expect as baseExpect,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pathToExtension = path.join(rootDir, 'dist');
const gmailFixturePath = path.join(rootDir, 'e2e/fixtures/gmail-inbox.html');
/** Persistent Chromium profile so WebLLM Cache API survives across runs. */
const userDataDir = path.join(rootDir, 'e2e/.browser-profile');
/** Separate profile for Phil PA tests (no WebLLM) so SW updates cleanly. */
const philUserDataDir = path.join(rootDir, 'e2e/.browser-profile-phil');

/** Smallest catalog model — faster first download for full-product e2e. */
export const E2E_MODEL_LABEL = 'Gemma 2 2B';

/** First-time download can take a long time on slow networks. */
export const MODEL_READY_TIMEOUT_MS = Number(process.env.E2E_MODEL_TIMEOUT_MS ?? 45 * 60_000);
export const AGENT_TURN_TIMEOUT_MS = Number(process.env.E2E_AGENT_TIMEOUT_MS ?? 4 * 60_000);

type WorkerFixtures = {
  extensionContext: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  /** Side panel with WebLLM loaded and Agent enabled. */
  readySidebar: Page;
  /** Side panel seeded for Phil PA (no WebLLM required). */
  philSidebar: Page;
  philExtensionContext: BrowserContext;
  philExtensionId: string;
  philServiceWorker: Worker;
};

type TestFixtures = {
  extensionPage: Page;
  /** Phil UI/tools page — does not wait for WebLLM. */
  philPage: Page;
  gmailPage: Page;
  /** Opens Agent tab on a model-ready sidebar. */
  agentPage: Page;
  sendAgentGoal: (
    goal: string,
    opts?: { autoAllow?: boolean },
  ) => Promise<void>;
  waitForAgentIdle: () => Promise<void>;
};

async function waitForServiceWorker(context: BrowserContext): Promise<Worker> {
  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent('serviceworker');
  }
  return worker;
}

const E2E_MODEL_ID = 'gemma-2-2b-it-q4f16_1-MLC';

async function seedExtensionStorage(page: Page): Promise<void> {
  await page.evaluate(async (modelId) => {
    const chromeApi = (
      globalThis as unknown as {
        chrome: {
          storage: { local: { set: (v: Record<string, unknown>) => Promise<void> } };
        };
      }
    ).chrome;
    await chromeApi.storage.local.set({
      onboarding: {
        completed: true,
        completedAt: Date.now(),
        skipped: true,
      },
      agentSettings: {
        enabled: true,
        maxSteps: 8,
        confirmModerate: true,
        allowDebugger: false,
        gmailClientId: '',
        gmailMode: 'session',
      },
      philSettings: {
        fabEnabled: true,
        trackingEnabled: true,
        nudgesEnabled: true,
        briefingEnabled: true,
        briefingHour: 8,
        briefingMinute: 0,
        nudgeThresholdMs: 120_000,
        locality: 'Austin TX',
        categoryOverrides: {},
      },
    });

    // App settings live in IndexedDB (`localmind`), not chrome.storage.
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('localmind', 1);
      req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
        if (!db.objectStoreNames.contains('conversations')) {
          db.createObjectStore('conversations', { keyPath: 'id' }).createIndex(
            'by-updated',
            'updatedAt',
          );
        }
        if (!db.objectStoreNames.contains('modelMeta')) {
          db.createObjectStore('modelMeta', { keyPath: 'modelId' });
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(['settings', 'modelMeta'], 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('indexedDB write failed'));
        tx.objectStore('settings').put(
          {
            selectedModelId: modelId,
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
      };
    });

    // Phil PA data lives in IndexedDB (`phil`).
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('phil', 1);
      req.onerror = () => reject(req.error ?? new Error('phil indexedDB open failed'));
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('philSettings')) db.createObjectStore('philSettings');
        if (!db.objectStoreNames.contains('reminders')) {
          db.createObjectStore('reminders', { keyPath: 'id' }).createIndex('by-when', 'when');
        }
        if (!db.objectStoreNames.contains('goals')) {
          db.createObjectStore('goals', { keyPath: 'id' }).createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('tabActivity')) {
          const store = db.createObjectStore('tabActivity', { keyPath: 'id' });
          store.createIndex('by-started', 'startedAt');
          store.createIndex('by-domain', 'domain');
        }
        if (!db.objectStoreNames.contains('briefings')) {
          db.createObjectStore('briefings', { keyPath: 'id' }).createIndex('by-date', 'dateKey');
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('philSettings', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('phil settings write failed'));
        tx.objectStore('philSettings').put(
          {
            fabEnabled: true,
            trackingEnabled: true,
            nudgesEnabled: true,
            briefingEnabled: true,
            briefingHour: 8,
            briefingMinute: 0,
            nudgeThresholdMs: 120_000,
            locality: 'Austin TX',
            categoryOverrides: {},
          },
          'app',
        );
      };
    });
  }, E2E_MODEL_ID);
}

async function ensureModelReady(page: Page): Promise<void> {
  const agentTab = page.getByRole('button', { name: /^Agent$/i });
  const restoreHint = page.getByText(
    /Model is restoring in the background|Restoring model|Downloading model|Preparing model|Downloading|Loading from cache|Starting download/i,
  );

  const isAgentReady = async (): Promise<boolean> => {
    if (!(await agentTab.isVisible().catch(() => false))) return false;
    await agentTab.click();
    // Soft banner means the engine is still hydrating — keep waiting.
    if (await restoreHint.first().isVisible().catch(() => false)) return false;
    const input = page.getByPlaceholder('Message the agent…');
    return input.isVisible().catch(() => false);
  };

  if (await isAgentReady()) return;

  await page
    .getByRole('button', { name: new RegExp(E2E_MODEL_LABEL, 'i') })
    .or(page.getByRole('button', { name: /Download AI|Load Phil|Retry/i }))
    .or(agentTab)
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 })
    .catch(() => undefined);

  const busy =
    (await page.getByText(/Downloading|Loading from cache|Restoring model|Preparing model/i).isVisible().catch(() => false)) ||
    (await page.getByRole('button', { name: /Downloading…|Loading from cache/i }).isVisible().catch(() => false));

  if (!busy) {
    const gemma = page.getByRole('button', { name: new RegExp(E2E_MODEL_LABEL, 'i') });
    if (await gemma.isEnabled().catch(() => false)) {
      await gemma.click({ timeout: 5_000 }).catch(() => undefined);
    }
    const startBtn = page.getByRole('button', { name: /Download AI|Load Phil|Retry/i });
    if (await startBtn.isEnabled().catch(() => false)) {
      await startBtn.click({ timeout: 5_000 }).catch(() => undefined);
    }
  }

  await expect
    .poll(async () => {
      const err = page.locator('.text-danger, [class*="danger"]').filter({
        hasText: /WebGPU|Download failed|not available|Error/i,
      });
      if (await err.first().isVisible().catch(() => false)) {
        const text = await err.first().innerText();
        throw new Error(`Model load failed in UI: ${text}`);
      }
      return isAgentReady();
    }, {
      timeout: MODEL_READY_TIMEOUT_MS,
      intervals: [2_000, 5_000, 10_000],
      message: 'WebLLM model did not become ready for Agent chat',
    })
    .toBe(true);
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  extensionContext: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      if (!fs.existsSync(path.join(pathToExtension, 'manifest.json'))) {
        throw new Error('dist/ is missing — run `npm run build` first.');
      }

      fs.mkdirSync(userDataDir, { recursive: true });

      const extensionContext = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chromium',
        headless: false,
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
          '--enable-unsafe-webgpu',
          '--enable-features=WebGPU',
        ],
        viewport: { width: 420, height: 800 },
      });

      const html = fs.readFileSync(gmailFixturePath, 'utf8');
      await extensionContext.route('https://mail.google.com/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'text/html; charset=utf-8',
          body: html,
        });
      });

      await use(extensionContext);
      await extensionContext.close();
      // Keep userDataDir so the WebLLM model cache is reused next run.
    },
    { scope: 'worker' },
  ],

  serviceWorker: [
    async ({ extensionContext }, use) => {
      const worker = await waitForServiceWorker(extensionContext);
      await use(worker);
    },
    { scope: 'worker' },
  ],

  extensionId: [
    async ({ serviceWorker }, use) => {
      await use(serviceWorker.url().split('/')[2]);
    },
    { scope: 'worker' },
  ],

  philExtensionContext: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      if (!fs.existsSync(path.join(pathToExtension, 'manifest.json'))) {
        throw new Error('dist/ is missing — run `npm run build` first.');
      }
      fs.mkdirSync(philUserDataDir, { recursive: true });
      const ctx = await chromium.launchPersistentContext(philUserDataDir, {
        channel: 'chromium',
        headless: false,
        args: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
        ],
        viewport: { width: 420, height: 800 },
      });
      await use(ctx);
      await ctx.close();
    },
    { scope: 'worker' },
  ],

  philServiceWorker: [
    async ({ philExtensionContext }, use) => {
      const worker = await waitForServiceWorker(philExtensionContext);
      await use(worker);
    },
    { scope: 'worker' },
  ],

  philExtensionId: [
    async ({ philServiceWorker }, use) => {
      await use(philServiceWorker.url().split('/')[2]);
    },
    { scope: 'worker' },
  ],

  philSidebar: [
    async ({ philExtensionContext, philExtensionId }, use) => {
      const page = await philExtensionContext.newPage();
      await page.goto(`chrome-extension://${philExtensionId}/src/sidebar/index.html`, {
        waitUntil: 'domcontentloaded',
      });
      await seedExtensionStorage(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: /^Today$/i })).toBeVisible({
        timeout: 30_000,
      });
      await use(page);
    },
    { scope: 'worker' },
  ],

  philPage: async ({ philSidebar }, use) => {
    await use(philSidebar);
  },

  readySidebar: [
    async ({ extensionContext, extensionId }, use) => {
      const page = await extensionContext.newPage();
      await page.goto(`chrome-extension://${extensionId}/src/sidebar/index.html`, {
        waitUntil: 'domcontentloaded',
      });
      await seedExtensionStorage(page);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await ensureModelReady(page);
      await use(page);
    },
    { scope: 'worker', timeout: MODEL_READY_TIMEOUT_MS + 120_000 },
  ],

  extensionPage: async ({ readySidebar }, use) => {
    await use(readySidebar);
  },

  gmailPage: async ({ extensionContext }, use) => {
    const existing = extensionContext
      .pages()
      .find((p) => p.url().includes('mail.google.com'));
    if (existing && !existing.isClosed()) {
      await existing.bringToFront();
      await existing.waitForSelector('tr.zA');
      await use(existing);
      return;
    }

    const page = await extensionContext.newPage();
    await page.goto('https://mail.google.com/mail/u/0/#inbox', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForSelector('tr.zA');
    await use(page);
  },

  agentPage: async ({ extensionPage, gmailPage }, use) => {
    // Ensure session-mode Gmail tab exists before the model calls gmail_*.
    await gmailPage.bringToFront();
    await expect(gmailPage.locator('tr.zA')).toHaveCount(5);

    await extensionPage.bringToFront();
    await extensionPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(extensionPage.getByText('Browser Agent')).toBeVisible();

    const enableBtn = extensionPage.getByRole('button', {
      name: /Enable \+ grant permissions/i,
    });
    if (await enableBtn.isVisible().catch(() => false)) {
      await extensionPage.getByRole('button', { name: /^Settings$/ }).last().click();
      await enableBtn.click();
      await expect(extensionPage.getByRole('button', { name: /^Disable$/i })).toBeVisible({
        timeout: 15_000,
      });
      await extensionPage.getByRole('button', { name: /Hide settings/i }).click();
    }

    const clearBtn = extensionPage.getByRole('button', { name: /^Clear$/i });
    if (await clearBtn.isEnabled().catch(() => false)) {
      await clearBtn.click();
    }

    await use(extensionPage);
  },

  waitForAgentIdle: async ({ agentPage }, use) => {
    await use(async () => {
      // Confirm keeps `running` true. After Allow, the model may request another
      // confirm — keep approving until the turn fully ends.
      const allowBtn = agentPage.getByRole('button', { name: /^Allow$/i });
      const deadline = Date.now() + AGENT_TURN_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (await allowBtn.isVisible().catch(() => false)) {
          await allowBtn.click();
          await expect(allowBtn).toBeHidden({ timeout: 15_000 }).catch(() => undefined);
          continue;
        }
        const working = await agentPage.getByText('Working…').isVisible().catch(() => false);
        if (!working) return;
        await agentPage.waitForTimeout(400);
      }
      throw new Error('Agent did not become idle before timeout');
    });
  },

  sendAgentGoal: async ({ agentPage, waitForAgentIdle }, use) => {
    await use(async (goal: string, opts: { autoAllow?: boolean } = {}) => {
      const autoAllow = opts.autoAllow !== false;
      const input = agentPage.getByPlaceholder('Message the agent…');
      const allowBtn = agentPage.getByRole('button', { name: /^Allow$/i });

      await expect(input).toBeEnabled();
      await input.fill(goal);
      await agentPage.getByRole('button', { name: 'Send' }).click();
      await expect(agentPage.getByText('Working…')).toBeVisible({ timeout: 30_000 });

      const deadline = Date.now() + AGENT_TURN_TIMEOUT_MS;
      while (Date.now() < deadline) {
        const confirmVisible = await allowBtn.isVisible().catch(() => false);

        if (confirmVisible) {
          // `running` stays true during confirm — return immediately for manual Allow.
          if (!autoAllow) return;
          await allowBtn.click();
          await expect(allowBtn).toBeHidden({ timeout: 15_000 }).catch(() => undefined);
          continue;
        }

        const working = await agentPage.getByText('Working…').isVisible().catch(() => false);
        if (!working) break;
        await agentPage.waitForTimeout(400);
      }

      if (autoAllow) await waitForAgentIdle();
    });
  },
});

export const expect = baseExpect;
