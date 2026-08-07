import { test, expect } from './fixtures/extension';
import type { Page } from '@playwright/test';

/** BRW-* — browser memory (Wave2 C4). */

const K8S_URL = 'https://phil.local/articles/kubernetes-operators-deep-dive';
const K8S_TITLE = 'Kubernetes operators deep dive';

async function enableMemory(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open('localmind', 1);
      req.onerror = () => reject(req.error ?? new Error('idb open failed'));
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings');
      };
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('settings', 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('idb write failed'));
        const store = tx.objectStore('settings');
        const getReq = store.get('app');
        getReq.onsuccess = () => {
          const cur = (getReq.result as Record<string, unknown> | undefined) ?? {};
          store.put({ ...cur, memoryEnabled: true }, 'app');
        };
      };
    });
  });
}

async function seedBrowserMemory(
  page: Page,
  opts: { historyGranted: boolean; withVisit: boolean },
): Promise<void> {
  await enableMemory(page);
  const visitedAt = Date.now() - 7 * 24 * 60 * 60 * 1000;
  await page.evaluate(
    async (payload) => {
      const chromeApi = (
        globalThis as unknown as {
          chrome: {
            storage: { local: { set: (v: Record<string, unknown>) => Promise<void> } };
          };
        }
      ).chrome;
      await chromeApi.storage.local.set({
        philHistoryPermissionSeed: payload.historyGranted,
        philBrowseIndex: payload.withVisit
          ? [
              {
                id: 'browse_e2e_k8s',
                url: payload.url,
                title: payload.title,
                visitedAt: payload.visitedAt,
                source: 'seed',
              },
            ]
          : [],
      });
    },
    {
      historyGranted: opts.historyGranted,
      withVisit: opts.withVisit,
      url: K8S_URL,
      title: K8S_TITLE,
      visitedAt,
    },
  );
}

async function openAgentAndAsk(page: Page, goal: string): Promise<void> {
  await page.getByRole('button', { name: /^Agent$/i }).click();
  await expect(page.getByText('Browser Agent')).toBeVisible({ timeout: 10_000 });
  const enableBtn = page.getByRole('button', { name: /Enable \+ grant permissions/i });
  if (await enableBtn.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /^Settings$/ }).last().click();
    await enableBtn.click();
    await expect(page.getByRole('button', { name: /^Disable$/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: /Hide settings/i }).click();
  }
  const clearBtn = page.getByRole('button', { name: /^Clear$/i });
  if (await clearBtn.isEnabled().catch(() => false)) {
    await clearBtn.click();
  }
  const input = page.getByPlaceholder('Message the agent…');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill(goal);
  await page.getByRole('button', { name: 'Send' }).click();
}

test.describe('Browser memory (BRW)', () => {
  test('BRW-01: Find article from last week with history granted', async ({ philPage }) => {
    await seedBrowserMemory(philPage, { historyGranted: true, withVisit: true });
    await openAgentAndAsk(philPage, 'Find that Kubernetes article I read last week.');
    await expect(philPage.getByText(/Kubernetes operators deep dive/i).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(philPage.getByText(/phil\.local\/articles\/kubernetes/i).first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(philPage.getByRole('button', { name: /^Open$/i }).first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test('BRW-02: Open found result', async ({ philPage, philExtensionContext }) => {
    await seedBrowserMemory(philPage, { historyGranted: true, withVisit: true });
    await openAgentAndAsk(philPage, 'Find that Kubernetes article I read last week.');
    const openBtn = philPage.getByRole('button', { name: /^Open$/i }).first();
    await expect(openBtn).toBeVisible({ timeout: 20_000 });

    await openBtn.click();
    await expect
      .poll(
        () =>
          philExtensionContext.pages().some((p) => {
            try {
              return p.url().includes('kubernetes-operators');
            } catch {
              return false;
            }
          }),
        { timeout: 15_000 },
      )
      .toBe(true);
  });

  test('BRW-03: Without history permission, Phil explains how to enable', async ({ philPage }) => {
    await seedBrowserMemory(philPage, { historyGranted: false, withVisit: false });
    await openAgentAndAsk(philPage, 'Find that Kubernetes article I read last week.');
    await expect(
      philPage
        .getByText(/History enabled in Privacy|browser memory needs History/i)
        .first(),
    ).toBeVisible({ timeout: 20_000 });
    await expect(philPage.getByText(/Kubernetes operators deep dive/i)).toHaveCount(0);
  });

  test('BRW-04: Clear / disable browser memory removes results', async ({ philPage }) => {
    await seedBrowserMemory(philPage, { historyGranted: true, withVisit: true });

    const privacy = philPage.getByRole('heading', { name: /^Privacy$/i });
    if (!(await privacy.isVisible().catch(() => false))) {
      await philPage.getByRole('button', { name: 'Settings', exact: true }).first().click();
      await expect(privacy).toBeVisible({ timeout: 5_000 });
    }
    await expect(
      philPage.getByRole('button', { name: /Clear browser memory|Disable browser memory/i }),
    ).toBeVisible({ timeout: 5_000 });

    philPage.once('dialog', (d) => d.accept());
    await philPage.getByRole('button', { name: /Clear browser memory/i }).click();
    await expect(philPage.getByText(/Browser memory cleared/i)).toBeVisible({ timeout: 10_000 });

    const close = philPage.getByRole('button', { name: /Close settings/i });
    if (await close.isVisible().catch(() => false)) await close.click();

    await openAgentAndAsk(philPage, 'Find that Kubernetes article I read last week.');
    await expect(philPage.getByText(/Kubernetes operators deep dive/i)).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(
      philPage.getByText(/couldn.?t find|no matching|browser memory/i).first(),
    ).toBeVisible({ timeout: 20_000 });
  });
});
