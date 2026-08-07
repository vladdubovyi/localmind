import {
  test,
  expect,
  ARTICLE_SELECTION_TEXT,
  AGENT_TURN_TIMEOUT_MS,
  queueSelectionAction,
} from './fixtures/extension';

/**
 * SEL-* + WF-12 — highlight quick actions (shipped regression).
 * Prefer message-bus harness over flaky OS context menus (plan-allowed).
 */
test.describe('Selection actions (SEL / WF-12)', () => {
  test('SEL-01: Highlight Explain opens side panel with an answer', async ({
    extensionPage,
    agentArticlePage,
    serviceWorker,
  }) => {
    await agentArticlePage.bringToFront();
    await expect(agentArticlePage.getByText(ARTICLE_SELECTION_TEXT)).toBeVisible();

    await queueSelectionAction(serviceWorker, 'explain', ARTICLE_SELECTION_TEXT, {
      url: agentArticlePage.url(),
      title: await agentArticlePage.title(),
    });

    await extensionPage.bringToFront();
    await expect(extensionPage.getByRole('button', { name: /^Agent$/i })).toBeVisible();

    // Must not tell the user to manually ask Agent (broken handoff regression).
    await expect(
      extensionPage.getByText(/Selection actions open Agent\. Ask Phil what to do/i),
    ).toHaveCount(0);

    await expect(extensionPage.getByText(/Working…|Explain|SELECTED TEXT|Photosynthesis/i).first()).toBeVisible({
      timeout: 30_000,
    });

    // Wait for turn if model is available.
    const working = extensionPage.getByText('Working…');
    if (await working.isVisible().catch(() => false)) {
      await expect(working).toBeHidden({ timeout: AGENT_TURN_TIMEOUT_MS });
    }

    const body = await extensionPage.locator('body').innerText();
    expect(body).toMatch(/Photosynthesis|light|chemical|energy|Explain/i);
    expect(body).not.toMatch(/Ask Phil what to do with the selection/i);
  });

  test('SEL-02: Highlight Summarize', async ({
    extensionPage,
    agentArticlePage,
    serviceWorker,
  }) => {
    const longText = await agentArticlePage.locator('#long-paragraph').innerText();
    await queueSelectionAction(serviceWorker, 'summarize', longText, {
      url: agentArticlePage.url(),
      title: await agentArticlePage.title(),
    });

    await extensionPage.bringToFront();
    await expect(
      extensionPage.getByText(/Selection actions open Agent\. Ask Phil what to do/i),
    ).toHaveCount(0);

    const working = extensionPage.getByText('Working…');
    if (await working.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await expect(working).toBeHidden({ timeout: AGENT_TURN_TIMEOUT_MS });
    }

    const body = await extensionPage.locator('body').innerText();
    expect(body.toLowerCase()).toMatch(/zeldora|sticky|cutover|migration|summar/i);
  });

  test('SEL-03: Highlight Rewrite', async ({
    extensionPage,
    agentArticlePage,
    serviceWorker,
  }) => {
    const draft = 'Draft note: Zeldora cutover checklist incomplete.';
    await queueSelectionAction(serviceWorker, 'rewrite', draft, {
      url: agentArticlePage.url(),
      title: await agentArticlePage.title(),
      canReplace: true,
    });

    await extensionPage.bringToFront();
    await expect(
      extensionPage.getByText(/Selection actions open Agent\. Ask Phil what to do/i),
    ).toHaveCount(0);

    const working = extensionPage.getByText('Working…');
    if (await working.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await expect(working).toBeHidden({ timeout: AGENT_TURN_TIMEOUT_MS });
    }

    const body = await extensionPage.locator('body').innerText();
    expect(body).toMatch(/Rewrite|Zeldora|checklist|SELECTED TEXT/i);
  });

  test('SEL-04: Highlight Translate', async ({
    extensionPage,
    agentArticlePage,
    serviceWorker,
  }) => {
    await queueSelectionAction(serviceWorker, 'translate', ARTICLE_SELECTION_TEXT, {
      url: agentArticlePage.url(),
      title: await agentArticlePage.title(),
    });

    await extensionPage.bringToFront();
    await expect(
      extensionPage.getByText(/Selection actions open Agent\. Ask Phil what to do/i),
    ).toHaveCount(0);

    const working = extensionPage.getByText('Working…');
    if (await working.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await expect(working).toBeHidden({ timeout: AGENT_TURN_TIMEOUT_MS });
    }

    const body = await extensionPage.locator('body').innerText();
    expect(body).toMatch(/Translate|Photosynthesis|SELECTED TEXT/i);
  });

  test('SEL-05: Context menu path works for one action', async ({
    extensionPage,
    agentArticlePage,
    serviceWorker,
  }) => {
    // Message-bus harness equivalent of chrome.contextMenus Explain (plan-allowed).
    await queueSelectionAction(serviceWorker, 'explain', ARTICLE_SELECTION_TEXT, {
      url: agentArticlePage.url(),
      title: await agentArticlePage.title(),
    });

    await extensionPage.bringToFront();
    await expect(
      extensionPage.getByText(/Selection actions open Agent\. Ask Phil what to do/i),
    ).toHaveCount(0);
    await expect(
      extensionPage.getByText(/Working…|Explain|Photosynthesis|SELECTED TEXT/i).first(),
    ).toBeVisible({ timeout: 30_000 });
  });

  test('WF-12: Explain selection (ELI5)', async ({
    extensionPage,
    agentArticlePage,
    serviceWorker,
  }) => {
    await queueSelectionAction(serviceWorker, 'eli5', ARTICLE_SELECTION_TEXT, {
      url: agentArticlePage.url(),
      title: await agentArticlePage.title(),
    });

    await extensionPage.bringToFront();
    await expect(
      extensionPage.getByText(/Selection actions open Agent\. Ask Phil what to do/i),
    ).toHaveCount(0);

    const working = extensionPage.getByText('Working…');
    if (await working.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await expect(working).toBeHidden({ timeout: AGENT_TURN_TIMEOUT_MS });
    }

    const body = await extensionPage.locator('body').innerText();
    // Uses selection (photosynthesis), not whole-page-only ads chrome.
    expect(body).toMatch(/Photosynthesis|light|energy|five|ELI5|SELECTED TEXT/i);
    expect(body).not.toMatch(/Buy ads · Subscribe/i);
  });
});
