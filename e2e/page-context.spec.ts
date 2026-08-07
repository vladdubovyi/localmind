import {
  test,
  expect,
  ARTICLE_UNIQUE_PHRASE,
  ARTICLE_ROLLBACK_PHRASE,
} from './fixtures/extension';

const PAGE_TURN_MS = Number(process.env.E2E_PAGE_TURN_MS ?? 90_000);

/**
 * PAGE-* + WF-11/WF-13 — current page awareness (shipped regression for PAGE/WF-11).
 * Uses phil profile + article fixture to avoid 45m WebLLM hangs in scaffold CI.
 * Full grounded replies require a ready model; tests fail fast with a clear message.
 */
test.describe('Page context (PAGE / WF-11 / WF-13)', () => {
  async function openAgentWithArticle(
    philPage: import('@playwright/test').Page,
    articlePage: import('@playwright/test').Page,
  ) {
    await articlePage.bringToFront();
    await expect(articlePage.getByText(ARTICLE_UNIQUE_PHRASE).first()).toBeVisible();
    await philPage.bringToFront();
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const clearBtn = philPage.getByRole('button', { name: /^Clear$/i });
    if (await clearBtn.isEnabled().catch(() => false)) await clearBtn.click();
  }

  async function waitForTurnOrBlocker(philPage: import('@playwright/test').Page) {
    await expect(philPage.getByText('Working…')).toBeVisible({ timeout: 30_000 });
    const hidden = await philPage
      .getByText('Working…')
      .waitFor({ state: 'hidden', timeout: PAGE_TURN_MS })
      .then(() => true)
      .catch(() => false);
    if (!hidden) {
      throw new Error(
        `PAGE turn did not finish within ${PAGE_TURN_MS}ms — WebLLM/model blocker (handoff/chips OK)`,
      );
    }
  }

  test('PAGE-01: Summarize this page uses page content', async ({ philPage, articlePage }) => {
    await openAgentWithArticle(philPage, articlePage);
    await philPage.getByRole('button', { name: /Summarize this page/i }).click();
    await waitForTurnOrBlocker(philPage);
    const body = await philPage.locator('body').innerText();
    expect(body).not.toMatch(/Selection actions open Agent\. Ask Phil what to do/i);
    expect(body.toLowerCase()).toMatch(/zeldora|migration|rollback|runbook|cutover|blue cluster/i);
  });

  test('PAGE-02: Explain this page', async ({ philPage, articlePage }) => {
    await openAgentWithArticle(philPage, articlePage);
    await philPage.getByRole('button', { name: /Explain this page/i }).click();
    await waitForTurnOrBlocker(philPage);
    const body = await philPage.locator('body').innerText();
    expect(body.toLowerCase()).toMatch(/zeldora|migration|runbook|cutover|rollback/i);
  });

  test('PAGE-03: Ask a question about this page', async ({ philPage, articlePage }) => {
    await openAgentWithArticle(philPage, articlePage);
    const input = philPage.getByPlaceholder('Message the agent…');
    await expect(input).toBeEnabled();
    await input.fill('What is the rollback step on this page?');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await waitForTurnOrBlocker(philPage);
    const body = await philPage.locator('body').innerText();
    expect(body).not.toMatch(
      /cannot see (the )?page|don't have access to (the )?page|no page content/i,
    );
    expect(body.toLowerCase()).toMatch(
      new RegExp(
        `${ARTICLE_ROLLBACK_PHRASE.split(' ')[0].toLowerCase()}|rollback|blue cluster|8443`,
      ),
    );
  });

  test('PAGE-04: Empty Agent state advertises page actions', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const clearBtn = philPage.getByRole('button', { name: /^Clear$/i });
    if (await clearBtn.isEnabled().catch(() => false)) await clearBtn.click();

    await expect(philPage.getByRole('button', { name: /Summarize this page/i })).toBeVisible();
    await expect(philPage.getByRole('button', { name: /Explain this page/i })).toBeVisible();
    await expect(philPage.getByRole('button', { name: /Ask about this page/i })).toBeVisible();
  });

  test('WF-11: Context awareness (“Summarize this page”)', async ({ philPage, articlePage }) => {
    await openAgentWithArticle(philPage, articlePage);
    await philPage.getByRole('button', { name: /Summarize this page/i }).click();
    await waitForTurnOrBlocker(philPage);
    const body = await philPage.locator('body').innerText();
    expect(body.toLowerCase()).toMatch(
      /zeldora|migration|runbook|cutover|sticky sessions|rollback/i,
    );
    expect(body).not.toMatch(/Buy ads · Subscribe/i);
  });

  test('WF-13: Page research (counterarguments)', async ({ philPage, articlePage }) => {
    await articlePage.bringToFront();
    await philPage.bringToFront();
    await philPage.getByRole('button', { name: /^Agent$/i }).click();
    const input = philPage.getByPlaceholder(/Message the agent/i);
    await expect(input).toBeEnabled({ timeout: 15_000 });
    await input.fill('Find arguments against the claims made on this page.');
    await philPage.getByRole('button', { name: 'Send' }).click();
    await expect(
      philPage.getByText(/counterargument|arguments against|balanced counter/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });
});
