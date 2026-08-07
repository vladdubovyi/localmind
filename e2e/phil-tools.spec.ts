import { test, expect } from './fixtures/extension';

/**
 * Phil tool/data-layer checks that do not require WebLLM.
 * Full UI flows live in phil-ui.spec.ts. Agent tool routing is exercised when
 * the model e2e profile can load WebGPU; here we validate persistence + manifest.
 */
test.describe('Phil data layer + manifest', () => {
  test('manifest reports Phil 1.0.0', async ({ philServiceWorker }) => {
    const info = await philServiceWorker.evaluate(async () => {
      const manifest = chrome.runtime.getManifest();
      return {
        name: manifest.name,
        version: manifest.version,
        permissions: manifest.permissions ?? [],
      };
    });
    expect(info.name).toBe('Phil');
    expect(info.version).toBe('1.0.0');
    expect(info.permissions).toEqual(
      expect.arrayContaining(['alarms', 'notifications', 'idle', 'tabs']),
    );
  });

  test('phil settings persist in chrome.storage.local', async ({ philPage }) => {
    const settings = await philPage.evaluate(async () => {
      const stored = await chrome.storage.local.get('philSettings');
      return stored.philSettings as Record<string, unknown> | undefined;
    });
    expect(settings).toBeTruthy();
    expect(settings?.fabEnabled).toBe(true);
    expect(settings?.trackingEnabled).toBe(true);
  });

  test('reminders and goals round-trip via storage', async ({ philPage }) => {
    const result = await philPage.evaluate(async () => {
      const remId = `rem_e2e_${Date.now()}`;
      const goalId = `goal_e2e_${Date.now()}`;
      const now = Date.now();
      await chrome.storage.local.set({
        philReminders: [
          {
            id: remId,
            text: 'E2E storage reminder',
            when: now + 60_000,
            repeat: 'none',
            status: 'scheduled',
            createdAt: now,
            updatedAt: now,
          },
        ],
        philGoals: [
          {
            id: goalId,
            title: 'E2E storage goal',
            status: 'active',
            allowedDomains: [],
            blockedDomains: ['youtube.com'],
            createdAt: now,
            updatedAt: now,
          },
        ],
      });
      const stored = await chrome.storage.local.get(['philReminders', 'philGoals']);
      return {
        reminders: stored.philReminders as Array<{ id: string; text: string }>,
        goals: stored.philGoals as Array<{ id: string; title: string }>,
      };
    });
    expect(result.reminders.some((r) => r.text === 'E2E storage reminder')).toBe(true);
    expect(result.goals.some((g) => g.title === 'E2E storage goal')).toBe(true);
  });

  test('Focus / Reminders / Goals panels read storage-backed state', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Reminders$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Reminders$/i })).toBeVisible();
    await philPage.getByRole('button', { name: /^Goals$/i }).click();
    await expect(philPage.getByRole('heading', { name: /^Goals$/i })).toBeVisible();
    await philPage.getByRole('button', { name: /^Focus$/i }).click();
    await expect(philPage.getByText(/Productive/i).first()).toBeVisible();
  });

  test('reminder_create tool executes in the service worker', async ({ philServiceWorker }) => {
    await expect
      .poll(async () => {
        return philServiceWorker.evaluate(() =>
          typeof (globalThis as { __philExecuteTool?: unknown }).__philExecuteTool === 'function',
        );
      }, { timeout: 15_000 })
      .toBe(true);

    const result = await philServiceWorker.evaluate(async () => {
      const run = (
        globalThis as {
          __philExecuteTool?: (call: {
            id: string;
            name: string;
            arguments: Record<string, unknown>;
          }) => Promise<{ ok: boolean; error?: string; data?: { text?: string; id?: string } }>;
        }
      ).__philExecuteTool;
      if (!run) return { ok: false, error: 'hook missing' };
      return run({
        id: 't_rem',
        name: 'reminder_create',
        arguments: { text: 'call my mom', inMinutes: 5 },
      });
    });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.data?.text).toMatch(/call my mom/i);

    const stored = await philServiceWorker.evaluate(async () => {
      const all = await chrome.storage.local.get('philReminders');
      const rows = (all.philReminders as Array<{ text: string; status: string }> | undefined) ?? [];
      return rows.some((r) => /call my mom/i.test(r.text) && r.status === 'scheduled');
    });
    expect(stored).toBe(true);
  });

  test('web_research weather returns a live answer without junk search tabs', async ({
    philServiceWorker,
    philExtensionContext,
  }) => {
    await philServiceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        agentSettings: {
          enabled: true,
          maxSteps: 8,
          confirmModerate: false,
          allowDebugger: false,
          gmailClientId: '',
          gmailMode: 'session',
        },
        philSettings: {
          fabEnabled: true,
          trackingEnabled: true,
          nudgesEnabled: false,
          briefingEnabled: true,
          briefingHour: 8,
          briefingMinute: 0,
          nudgeThresholdMs: 120_000,
          locality: 'Austin TX',
          categoryOverrides: {},
        },
      });
    });

    await expect
      .poll(async () => {
        return philServiceWorker.evaluate(
          () => typeof (globalThis as { __routeAgentTool?: unknown }).__routeAgentTool === 'function',
        );
      }, { timeout: 15_000 })
      .toBe(true);

    const result = await philServiceWorker.evaluate(async () => {
      const run = (
        globalThis as {
          __routeAgentTool?: (
            call: { id: string; name: string; arguments: Record<string, unknown> },
            confirmed?: boolean,
          ) => Promise<{
            ok: boolean;
            error?: string;
            data?: {
              answer?: string;
              source?: string;
              serpUrl?: string;
              findings?: Array<{ url?: string }>;
              note?: string;
            };
          }>;
        }
      ).__routeAgentTool;
      if (!run) return { ok: false, error: 'route hook missing' };
      return run(
        {
          id: 't_weather',
          name: 'web_research',
          arguments: { query: 'What is the weather today?', maxResults: 2 },
        },
        true,
      );
    });

    expect(result.error ?? '').not.toMatch(/import\(\)|ServiceWorkerGlobalScope/i);
    expect(result.ok).toBe(true);
    expect(result.data?.answer ?? '').toMatch(/weather|°|F|C|sun|cloud|rain|clear|overcast|Austin/i);
    expect(result.data?.answer ?? '').not.toMatch(/could not extract deep links/i);
    expect(result.data?.source ?? '').toMatch(/wttr/i);

    const opened = philExtensionContext.pages().map((p) => {
      try {
        return p.url();
      } catch {
        return '';
      }
    });
    const weatherTabs = opened.filter((u) => /wttr\.in/i.test(u));
    const junkSearchTabs = opened.filter((u) =>
      /duckduckgo\.com\/\?q=.*buy|google\.com\/search\?q=What%20is%20the%20weather/i.test(u),
    );
    expect(weatherTabs.length).toBeGreaterThan(0);
    expect(junkSearchTabs.length).toBe(0);
  });
});
