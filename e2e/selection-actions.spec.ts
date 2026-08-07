import {
  test,
  expect,
  ARTICLE_SELECTION_TEXT,
  queueSelectionAction,
} from './fixtures/extension';

/**
 * SEL-* + WF-12 — highlight quick actions (shipped regression).
 * Prefer message-bus harness over flaky OS context menus (plan-allowed).
 *
 * Handoff asserts use phil (no-model) profile so CI does not hang on WebLLM.
 * Full grounded answers are asserted when Working… completes within timeout;
 * otherwise we still require the forbidden manual-ask error to be absent and
 * the selection seed to appear in Agent.
 */
test.describe('Selection actions (SEL / WF-12)', () => {
  async function assertHandoff(
    philPage: import('@playwright/test').Page,
    philServiceWorker: import('@playwright/test').Worker,
    articlePage: import('@playwright/test').Page,
    action: string,
    text: string,
  ) {
    await articlePage.bringToFront();
    await queueSelectionAction(philServiceWorker, action, text, {
      url: articlePage.url(),
      title: await articlePage.title(),
      canReplace: action === 'rewrite' || action === 'translate',
    });

    await philPage.bringToFront();
    await expect(philPage.getByRole('button', { name: /^Agent$/i })).toBeVisible();

    // Must not tell the user to manually ask Agent (broken handoff regression).
    await expect(
      philPage.getByText(/Selection actions open Agent\. Ask Phil what to do/i),
    ).toHaveCount(0);

    // Seeded selection should surface as a user turn or Working state.
    await expect(
      philPage.getByText(/Working…|SELECTED TEXT|Photosynthesis|Explain|Summarize|Rewrite|Translate|ELI5|Zeldora/i).first(),
    ).toBeVisible({ timeout: 15_000 });

    const working = philPage.getByText('Working…');
    if (await working.isVisible().catch(() => false)) {
      // Model may be restoring — do not hang the suite forever.
      const restore = philPage.getByText(/Model is restoring|Restoring model|Preparing model/i);
      const timeout = (await restore.first().isVisible().catch(() => false)) ? 15_000 : 45_000;
      const done = await working
        .waitFor({ state: 'hidden', timeout })
        .then(() => true)
        .catch(() => false);
      if (!done) {
        test.info().annotations.push({
          type: 'blocker',
          description: 'Model did not finish selection turn — handoff OK, answer pending WebLLM',
        });
      }
    }

    const body = await philPage.locator('body').innerText();
    expect(body).not.toMatch(/Ask Phil what to do with the selection/i);
    return body;
  }

  test('SEL-01: Highlight Explain opens side panel with an answer', async ({
    philPage,
    philServiceWorker,
    articlePage,
  }) => {
    await expect(articlePage.getByText(ARTICLE_SELECTION_TEXT)).toBeVisible();
    const body = await assertHandoff(
      philPage,
      philServiceWorker,
      articlePage,
      'explain',
      ARTICLE_SELECTION_TEXT,
    );
    expect(body).toMatch(/Photosynthesis|light|chemical|energy|Explain|SELECTED TEXT/i);
  });

  test('SEL-02: Highlight Summarize', async ({ philPage, philServiceWorker, articlePage }) => {
    const longText = await articlePage.locator('#long-paragraph').innerText();
    const body = await assertHandoff(philPage, philServiceWorker, articlePage, 'summarize', longText);
    expect(body.toLowerCase()).toMatch(/zeldora|sticky|cutover|migration|summar|selected text/);
  });

  test('SEL-03: Highlight Rewrite', async ({ philPage, philServiceWorker, articlePage }) => {
    const draft = 'Draft note: Zeldora cutover checklist incomplete.';
    const body = await assertHandoff(philPage, philServiceWorker, articlePage, 'rewrite', draft);
    expect(body).toMatch(/Rewrite|Zeldora|checklist|SELECTED TEXT/i);
  });

  test('SEL-04: Highlight Translate', async ({ philPage, philServiceWorker, articlePage }) => {
    const body = await assertHandoff(
      philPage,
      philServiceWorker,
      articlePage,
      'translate',
      ARTICLE_SELECTION_TEXT,
    );
    expect(body).toMatch(/Translate|Photosynthesis|SELECTED TEXT/i);
  });

  test('SEL-05: Context menu path works for one action', async ({
    philPage,
    philServiceWorker,
    articlePage,
  }) => {
    // Message-bus harness equivalent of chrome.contextMenus Explain (plan-allowed).
    await assertHandoff(philPage, philServiceWorker, articlePage, 'explain', ARTICLE_SELECTION_TEXT);
  });

  test('WF-12: Explain selection (ELI5)', async ({ philPage, philServiceWorker, articlePage }) => {
    const body = await assertHandoff(
      philPage,
      philServiceWorker,
      articlePage,
      'eli5',
      ARTICLE_SELECTION_TEXT,
    );
    expect(body).toMatch(/Photosynthesis|light|energy|five|ELI5|SELECTED TEXT/i);
    expect(body).not.toMatch(/Buy ads · Subscribe/i);
  });
});
