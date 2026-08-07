import {
  test,
  expect,
  ARTICLE_UNIQUE_PHRASE,
  ARTICLE_ROLLBACK_PHRASE,
  AGENT_TURN_TIMEOUT_MS,
} from './fixtures/extension';

/**
 * PAGE-* + WF-11/WF-13 — current page awareness (shipped regression for PAGE/WF-11).
 */
test.describe('Page context (PAGE / WF-11 / WF-13)', () => {
  test('PAGE-01: Summarize this page uses page content', async ({
    extensionPage,
    agentArticlePage,
    serviceWorker,
  }) => {
    await agentArticlePage.bringToFront();
    await expect(agentArticlePage.getByText(ARTICLE_UNIQUE_PHRASE).first()).toBeVisible();

    // Ensure content script / extract path can see the article tab.
    await expect
      .poll(async () => {
        return serviceWorker.evaluate(async () => {
          const [tab] = await chrome.tabs.query({ url: 'https://phil.local/article*' });
          return tab?.id ?? null;
        });
      }, { timeout: 15_000 })
      .not.toBeNull();

    await extensionPage.bringToFront();
    await extensionPage.getByRole('button', { name: /^Agent$/i }).click();
    const clearBtn = extensionPage.getByRole('button', { name: /^Clear$/i });
    if (await clearBtn.isEnabled().catch(() => false)) await clearBtn.click();

    const summarize = extensionPage.getByRole('button', { name: /Summarize this page/i });
    await expect(summarize).toBeVisible({ timeout: 15_000 });
    await summarize.click();

    await expect(extensionPage.getByText('Working…')).toBeVisible({ timeout: 30_000 });
    await expect(extensionPage.getByText('Working…')).toBeHidden({
      timeout: AGENT_TURN_TIMEOUT_MS,
    });

    const body = await extensionPage.locator('body').innerText();
    expect(body).not.toMatch(/Selection actions open Agent\. Ask Phil what to do/i);
    expect(body.toLowerCase()).toMatch(/zeldora|migration|rollback|runbook|cutover|blue cluster/i);
  });

  test('PAGE-02: Explain this page', async ({ extensionPage, agentArticlePage }) => {
    await agentArticlePage.bringToFront();
    await extensionPage.bringToFront();
    await extensionPage.getByRole('button', { name: /^Agent$/i }).click();
    const clearBtn = extensionPage.getByRole('button', { name: /^Clear$/i });
    if (await clearBtn.isEnabled().catch(() => false)) await clearBtn.click();

    await extensionPage.getByRole('button', { name: /Explain this page/i }).click();
    await expect(extensionPage.getByText('Working…')).toBeVisible({ timeout: 30_000 });
    await expect(extensionPage.getByText('Working…')).toBeHidden({
      timeout: AGENT_TURN_TIMEOUT_MS,
    });

    const body = await extensionPage.locator('body').innerText();
    expect(body.toLowerCase()).toMatch(/zeldora|migration|runbook|cutover|rollback/i);
  });

  test('PAGE-03: Ask a question about this page', async ({
    extensionPage,
    agentArticlePage,
    sendAgentGoal,
  }) => {
    await agentArticlePage.bringToFront();
    await extensionPage.bringToFront();
    await extensionPage.getByRole('button', { name: /^Agent$/i }).click();
    // agentPage fixture pulls Gmail; here we use extensionPage + send via fill
    const clearBtn = extensionPage.getByRole('button', { name: /^Clear$/i });
    if (await clearBtn.isEnabled().catch(() => false)) await clearBtn.click();

    // Enable agent if needed
    const enableBtn = extensionPage.getByRole('button', {
      name: /Enable \+ grant permissions/i,
    });
    if (await enableBtn.isVisible().catch(() => false)) {
      await extensionPage.getByRole('button', { name: /^Settings$/ }).last().click();
      await enableBtn.click();
      await extensionPage.getByRole('button', { name: /Hide settings/i }).click();
    }

    const input = extensionPage.getByPlaceholder('Message the agent…');
    await input.fill('What is the rollback step on this page?');
    await extensionPage.getByRole('button', { name: 'Send' }).click();
    await expect(extensionPage.getByText('Working…')).toBeVisible({ timeout: 30_000 });
    await expect(extensionPage.getByText('Working…')).toBeHidden({
      timeout: AGENT_TURN_TIMEOUT_MS,
    });

    const body = await extensionPage.locator('body').innerText();
    expect(body).not.toMatch(/cannot see (the )?page|don't have access to (the )?page|no page content/i);
    expect(body.toLowerCase()).toMatch(
      new RegExp(ARTICLE_ROLLBACK_PHRASE.split(' ')[0].toLowerCase() + '|rollback|blue cluster|8443'),
    );
    void sendAgentGoal;
  });

  test('PAGE-04: Empty Agent state advertises page actions', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const clearBtn = philPage.getByRole('button', { name: /^Clear$/i });
    if (await clearBtn.isEnabled().catch(() => false)) await clearBtn.click();

    await expect(philPage.getByRole('button', { name: /Summarize this page/i })).toBeVisible();
    await expect(philPage.getByRole('button', { name: /Explain this page/i })).toBeVisible();
    await expect(philPage.getByRole('button', { name: /Ask about this page/i })).toBeVisible();
  });

  test('WF-11: Context awareness (“Summarize this page”)', async ({
    extensionPage,
    agentArticlePage,
  }) => {
    await agentArticlePage.bringToFront();
    await extensionPage.bringToFront();
    await extensionPage.getByRole('button', { name: /^Agent$/i }).click();
    const clearBtn = extensionPage.getByRole('button', { name: /^Clear$/i });
    if (await clearBtn.isEnabled().catch(() => false)) await clearBtn.click();

    await extensionPage.getByRole('button', { name: /Summarize this page/i }).click();
    await expect(extensionPage.getByText('Working…')).toBeVisible({ timeout: 30_000 });
    await expect(extensionPage.getByText('Working…')).toBeHidden({
      timeout: AGENT_TURN_TIMEOUT_MS,
    });

    const body = await extensionPage.locator('body').innerText();
    // Grounded in article body, not only ads chrome.
    expect(body.toLowerCase()).toMatch(/zeldora|migration|runbook|cutover|sticky sessions|rollback/i);
    expect(body).not.toMatch(/Buy ads · Subscribe/i);
  });

  test('WF-13: Page research (counterarguments)', async ({ philPage }) => {
    // Not shipped yet — fail on missing counterargument research UX / outcome.
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    await expect(
      philPage.getByText(/counterargument|arguments against|balanced counter/i),
    ).toBeVisible({ timeout: 3_000 });
  });
});
