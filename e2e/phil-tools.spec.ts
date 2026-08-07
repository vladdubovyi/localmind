import { test, expect } from './fixtures/extension';

test.describe('Phil tools via service worker', () => {
  test('reminder_create / list / cancel', async ({ extensionPage }) => {
    const result = await extensionPage.evaluate(async () => {
      const call = {
        id: `e2e_${Date.now()}`,
        name: 'reminder_create',
        arguments: { text: 'E2E drink water', inMinutes: 60 },
      };
      return chrome.runtime.sendMessage({
        type: 'AGENT_EXECUTE_TOOL',
        call,
        confirmed: true,
      });
    });

    expect(result).toMatchObject({ ok: true });
    expect(result.data).toMatchObject({
      text: 'E2E drink water',
      status: 'scheduled',
    });

    const listed = await extensionPage.evaluate(async () => {
      return chrome.runtime.sendMessage({
        type: 'AGENT_EXECUTE_TOOL',
        call: { id: 'e2e_list', name: 'reminder_list', arguments: {} },
        confirmed: true,
      });
    });
    expect(listed.ok).toBe(true);
    expect(JSON.stringify(listed.data)).toContain('E2E drink water');

    const id = result.data.id as string;
    const cancelled = await extensionPage.evaluate(async (reminderId) => {
      return chrome.runtime.sendMessage({
        type: 'AGENT_EXECUTE_TOOL',
        call: {
          id: 'e2e_cancel',
          name: 'reminder_cancel',
          arguments: { id: reminderId },
        },
        confirmed: true,
      });
    }, id);
    expect(cancelled.ok).toBe(true);
  });

  test('goal_create and focus_summary', async ({ extensionPage }) => {
    const goal = await extensionPage.evaluate(async () => {
      return chrome.runtime.sendMessage({
        type: 'AGENT_EXECUTE_TOOL',
        call: {
          id: 'e2e_goal',
          name: 'goal_create',
          arguments: { title: 'E2E finish Phil tools' },
        },
        confirmed: true,
      });
    });
    expect(goal.ok).toBe(true);
    expect(goal.data.title).toBe('E2E finish Phil tools');

    const focus = await extensionPage.evaluate(async () => {
      return chrome.runtime.sendMessage({
        type: 'AGENT_EXECUTE_TOOL',
        call: { id: 'e2e_focus', name: 'focus_summary', arguments: {} },
        confirmed: true,
      });
    });
    expect(focus.ok).toBe(true);
    expect(focus.data).toHaveProperty('byCategory');
    expect(focus.data).toHaveProperty('totalMs');
  });

  test('briefing_today and phil_settings_get', async ({ extensionPage }) => {
    const briefing = await extensionPage.evaluate(async () => {
      return chrome.runtime.sendMessage({
        type: 'AGENT_EXECUTE_TOOL',
        call: { id: 'e2e_brief', name: 'briefing_today', arguments: {} },
        confirmed: true,
      });
    });
    expect(briefing.ok).toBe(true);
    expect(String(briefing.data.content)).toMatch(/Good morning|goals|Focus/i);

    const settings = await extensionPage.evaluate(async () => {
      return chrome.runtime.sendMessage({
        type: 'AGENT_EXECUTE_TOOL',
        call: { id: 'e2e_settings', name: 'phil_settings_get', arguments: {} },
        confirmed: true,
      });
    });
    expect(settings.ok).toBe(true);
    expect(settings.data.fabEnabled).toBe(true);
  });

  test('web_research opens search tabs', async ({ extensionPage, extensionContext }) => {
    // Host access is optional until Agent enable; request it for research.
    await extensionPage.evaluate(async () => {
      await chrome.permissions.request({
        origins: ['http://*/*', 'https://*/*'],
      });
    });

    const before = extensionContext.pages().length;
    const research = await extensionPage.evaluate(async () => {
      return chrome.runtime.sendMessage({
        type: 'AGENT_EXECUTE_TOOL',
        call: {
          id: 'e2e_research',
          name: 'web_research',
          arguments: { query: 'best noise cancelling headphones', maxResults: 2 },
        },
        confirmed: true,
      });
    });
    expect(research.ok).toBe(true);
    expect(research.data).toHaveProperty('serpUrl');
    await expect
      .poll(() => extensionContext.pages().length, { timeout: 20_000 })
      .toBeGreaterThan(before);
  });

  test('manifest reports Phil 1.0.0', async ({ serviceWorker }) => {
    const info = await serviceWorker.evaluate(async () => {
      const manifest = chrome.runtime.getManifest();
      return { name: manifest.name, version: manifest.version };
    });
    expect(info.name).toBe('Phil');
    expect(info.version).toBe('1.0.0');
  });
});
