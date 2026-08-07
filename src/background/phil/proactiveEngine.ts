/**
 * Proactive suggestion engine (PRO-*, PRJ-EA-02, WF-07/20).
 *
 * ADR Q5 choice (Agent C2): **dedicated detectors** write ProactiveSuggestion
 * rows directly. We do NOT call router.route() with synthetic utterances and
 * do NOT change Router Factory internals.
 */
import {
  canDeliverNotification,
  proactiveAllowed,
} from '@/phil/notificationPolicy';
import type { ProactiveSuggestion, SuggestionKind } from '@/phil/types';
import { domainFromUrl } from '@/phil/categories';
import {
  countDeliveriesInWindow,
  getPhilSettings,
  listGoals,
  listSuggestions,
  listTabActivitySince,
  putSuggestion,
  recordNotificationDelivery,
  startOfLocalDay,
  uid,
} from '@/storage/phil';
import { getActiveProject } from '@/storage/projects';
import { getAgentSettings } from '@/storage/agentSettings';
import { createReminder } from '@/background/phil/reminders';

export const PROACTIVE_ALARM = 'phil-proactive-tick';
const PROACTIVE_PERIOD_MINUTES = 1;
const DISMISS_SUPPRESS_MS = 4 * 60 * 60_000;
const DEFAULT_SNOOZE_MS = 30 * 60_000;

const RESEARCH_HOST_HINTS = [
  'docs.',
  'developer.',
  'readthedocs',
  'wikipedia.org',
  'arxiv.org',
  'scholar.google',
  'medium.com',
  'stackoverflow.com',
  'github.com',
  'notion.so',
];

const PRODUCT_HOST_HINTS = [
  'amazon.',
  'bestbuy.',
  'wirecutter',
  'newegg.',
  'bhphotovideo',
  'walmart.',
  'ebay.',
  'producthunt',
  'gsmarena',
  'rtings.com',
];

const TRAVEL_HOST_HINTS = [
  'kayak.',
  'expedia.',
  'booking.',
  'skyscanner.',
  'google.com/travel',
  'flights.google',
  'airbnb.',
  'tripadvisor.',
];

function hostLooksLike(host: string, hints: string[]): boolean {
  const h = host.toLowerCase();
  return hints.some((hint) => h.includes(hint.replace(/\.$/, '')) || h.startsWith(hint));
}

function titleLooksProduct(title: string): boolean {
  return /\b(review|vs\.?|compare|best |price|buy|specs?)\b/i.test(title);
}

async function hasActiveOrSuppressed(detectorId: string, now: number): Promise<boolean> {
  const all = await listSuggestions();
  return all.some((s) => {
    if (s.detectorId !== detectorId) return false;
    if (s.status === 'active') return true;
    if (s.status === 'snoozed' && (s.snoozeUntil ?? 0) > now) return true;
    if (s.status === 'dismissed' && (s.dismissUntil ?? 0) > now) return true;
    if (s.status === 'accepted' && now - s.createdAt < 60 * 60_000) return true;
    return false;
  });
}

async function createSuggestion(input: {
  kind: SuggestionKind;
  detectorId: string;
  title: string;
  body: string;
  meta?: Record<string, unknown>;
  notify?: boolean;
}): Promise<ProactiveSuggestion | null> {
  const settings = await getPhilSettings();
  if (!proactiveAllowed(settings.notificationFrequency)) return null;

  const now = Date.now();
  if (await hasActiveOrSuppressed(input.detectorId, now)) return null;

  const delivered = await countDeliveriesInWindow();
  if (!canDeliverNotification(settings, { deliveredInWindow: delivered, now: new Date(now) })) {
    return null;
  }

  const suggestion: ProactiveSuggestion = {
    id: uid('sug'),
    kind: input.kind,
    detectorId: input.detectorId,
    title: input.title,
    body: input.body,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    meta: input.meta,
  };
  await putSuggestion(suggestion);

  if (input.notify !== false) {
    try {
      await chrome.notifications.create(`phil-proactive-${suggestion.id}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: suggestion.title,
        message: suggestion.body.slice(0, 120),
        priority: 1,
      });
      await recordNotificationDelivery(now);
    } catch {
      // optional
    }
  }

  return suggestion;
}

async function detectResearchWithoutNotes(): Promise<void> {
  const settings = await getPhilSettings();
  const sessions = await listTabActivitySince(startOfLocalDay());
  const researchMs = sessions
    .filter((s) => hostLooksLike(s.domain, RESEARCH_HOST_HINTS))
    .reduce((sum, s) => sum + s.ms, 0);
  const threshold = Math.max(settings.nudgeThresholdMs * 4, 8 * 60_000);
  if (researchMs < threshold) return;

  await createSuggestion({
    kind: 'research_summary',
    detectorId: 'research_without_notes',
    title: 'Phil noticed you’re researching',
    body: 'You’ve been researching for a while — want a summary? I can capture notes so this doesn’t get lost.',
    meta: { researchMs },
  });
}

async function detectSimilarProductTabs(): Promise<void> {
  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return;
  }
  const productTabs = tabs.filter((t) => {
    if (!t.url || !/^https?:/i.test(t.url)) return false;
    const host = domainFromUrl(t.url);
    return hostLooksLike(host, PRODUCT_HOST_HINTS) || titleLooksProduct(t.title ?? '');
  });
  if (productTabs.length < 3) return;

  await createSuggestion({
    kind: 'compare_tabs',
    detectorId: 'similar_product_tabs',
    title: 'Compare these product tabs?',
    body: `You have ${productTabs.length} similar product / review tabs open — I can help compare them.`,
    meta: {
      tabIds: productTabs.map((t) => t.id).filter((id): id is number => id != null),
    },
  });
}

async function detectLeisureVsGoal(): Promise<void> {
  const settings = await getPhilSettings();
  if (!settings.nudgesEnabled) return;
  const goals = (await listGoals()).filter((g) => g.status === 'active');
  if (!goals.length) return;

  const since = Date.now() - 30 * 60_000;
  const sessions = (await listTabActivitySince(startOfLocalDay())).filter(
    (s) => s.startedAt >= since,
  );
  const leisureMs = sessions
    .filter(
      (s) =>
        s.category === 'leisure' ||
        s.category === 'blocked' ||
        goals.some((g) =>
          g.blockedDomains.some((d) => s.domain === d || s.domain.endsWith(`.${d}`)),
        ),
    )
    .reduce((sum, s) => sum + s.ms, 0);

  if (leisureMs < settings.nudgeThresholdMs) return;
  const goal = goals[0];

  await createSuggestion({
    kind: 'leisure_refocus',
    detectorId: `leisure_refocus:${goal.id}`,
    title: 'Gentle nudge — refocus?',
    body: `You’ve been on leisure sites. Time to get back to your goal: ${goal.title}.`,
    meta: { goalId: goal.id, leisureMs },
  });
}

async function detectEmailTime(): Promise<void> {
  const hour = new Date().getHours();
  const emailWindow = (hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16);
  let force = false;
  try {
    const session = await chrome.storage.session.get('philForceEmailTime');
    force = Boolean(session.philForceEmailTime);
  } catch {
    // ignore
  }
  if (!emailWindow && !force) return;

  const agent = await getAgentSettings();
  let gmailTab = false;
  try {
    const tabs = await chrome.tabs.query({ url: ['*://mail.google.com/*', '*://gmail.com/*'] });
    gmailTab = tabs.length > 0;
  } catch {
    // ignore
  }
  if (!gmailTab && !agent.gmailClientId && agent.gmailMode !== 'session' && !force) return;

  await createSuggestion({
    kind: 'email_triage',
    detectorId: 'email_time_triage',
    title: 'Email time — unread to triage?',
    body: 'It’s a good window to triage email. I can help scan unread messages in Gmail.',
    meta: { gmailTab, force },
  });
}

async function detectTravelBrowseReminder(): Promise<void> {
  const sessions = await listTabActivitySince(startOfLocalDay());
  const travel = sessions.filter(
    (s) =>
      hostLooksLike(s.domain, TRAVEL_HOST_HINTS) ||
      /\b(flight|hotel|travel|japan|tokyo|osaka)\b/i.test(`${s.title ?? ''} ${s.url}`),
  );
  if (travel.length < 2 && travel.reduce((sum, s) => sum + s.ms, 0) < 3 * 60_000) return;

  await createSuggestion({
    kind: 'smart_reminder',
    detectorId: 'travel_book_reminder',
    title: 'Smart reminder suggestion',
    body: 'You’ve been researching travel — want a reminder to book before prices change?',
    meta: {
      acceptCreatesReminder: true,
      reminderText: 'Book flights / travel before prices change',
    },
  });
}

async function detectExecDayCoaching(): Promise<void> {
  const project = await getActiveProject();
  const goals = (await listGoals()).filter((g) => g.status === 'active');
  const thesisGoal = goals.find((g) => /\bthesis\b/i.test(g.title));
  const execMode =
    project?.template === 'exec_day' ||
    Boolean(thesisGoal) ||
    goals.some((g) => /\bstay (on track|productive|focused)\b/i.test(g.title));

  if (!execMode && !goals.length) return;

  const since = Date.now() - 45 * 60_000;
  const sessions = (await listTabActivitySince(startOfLocalDay())).filter(
    (s) => s.startedAt >= since,
  );
  const domains = new Set(sessions.map((s) => s.domain));
  const leisureMs = sessions
    .filter((s) => s.category === 'leisure' || s.category === 'blocked')
    .reduce((sum, s) => sum + s.ms, 0);
  const settings = await getPhilSettings();

  if (domains.size >= 5) {
    await createSuggestion({
      kind: 'context_switch',
      detectorId: 'context_switching',
      title: 'Context switching detected',
      body: 'Lots of tab hopping lately — suggest a focus session? I can help you stay on track today.',
      meta: { domainCount: domains.size },
    });
  }

  if (leisureMs >= settings.nudgeThresholdMs) {
    const label = thesisGoal?.title ?? goals[0]?.title ?? 'your work';
    await createSuggestion({
      kind: 'stay_on_track',
      detectorId: 'stay_on_track_coach',
      title: 'Stay on track — focus timer?',
      body: `Distraction detected while working on ${label}. Start a focus timer, or suggest a break if energy is fading.`,
      meta: { goalTitle: label, leisureMs, thesis: Boolean(thesisGoal) },
    });
  }

  if (leisureMs >= settings.nudgeThresholdMs * 2) {
    await createSuggestion({
      kind: 'focus_break',
      detectorId: 'suggest_break',
      title: 'Suggest a short break',
      body: 'Focus may be declining after prolonged distraction — a short break can help before the next focus session.',
    });
  }
}

/** E2E harness: seed inbox suggestions without waiting for dwell thresholds. */
export async function seedHarnessSuggestions(): Promise<ProactiveSuggestion[]> {
  const settings = await getPhilSettings();
  if (!proactiveAllowed(settings.notificationFrequency)) return [];

  const specs: Array<{
    kind: SuggestionKind;
    detectorId: string;
    title: string;
    body: string;
  }> = [
    {
      kind: 'research_summary',
      detectorId: 'harness:research',
      title: 'Phil noticed you’re researching',
      body: 'You’ve been researching — want a summary?',
    },
    {
      kind: 'compare_tabs',
      detectorId: 'harness:compare',
      title: 'Compare product tabs',
      body: 'I can help compare the similar product tabs you have open.',
    },
    {
      kind: 'leisure_refocus',
      detectorId: 'harness:refocus',
      title: 'Gentle nudge — refocus',
      body: 'Time to get back to your goal. This nudge respects your notification frequency.',
    },
    {
      kind: 'email_triage',
      detectorId: 'harness:email',
      title: 'Unread email to triage',
      body: 'You have unread mail worth triaging in Gmail.',
    },
    {
      kind: 'smart_reminder',
      detectorId: 'harness:travel',
      title: 'Smart reminder suggestion',
      body: 'Reminder to book before prices change? I can create that for you.',
    },
    {
      kind: 'stay_on_track',
      detectorId: 'harness:track',
      title: 'Stay on track today',
      body: 'Context switching spotted — try a focus session or focus timer to cut distraction.',
    },
    {
      kind: 'focus_session',
      detectorId: 'harness:thesis',
      title: 'Thesis focus session',
      body: 'Productivity coaching for your thesis — start a focus session. I’ll share a productivity summary when it ends.',
    },
  ];

  const now = Date.now();
  const created: ProactiveSuggestion[] = [];
  for (const spec of specs) {
    if (await hasActiveOrSuppressed(spec.detectorId, now)) continue;
    const suggestion: ProactiveSuggestion = {
      id: uid('sug'),
      kind: spec.kind,
      detectorId: spec.detectorId,
      title: spec.title,
      body: spec.body,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await putSuggestion(suggestion);
    created.push(suggestion);
  }
  return created;
}

export async function runProactiveEngine(opts?: { harness?: boolean }): Promise<{ created: number }> {
  const settings = await getPhilSettings();
  if (!proactiveAllowed(settings.notificationFrequency)) return { created: 0 };

  let harness = opts?.harness ?? false;
  if (!harness) {
    try {
      const session = await chrome.storage.session.get('philProactiveHarness');
      harness = Boolean(session.philProactiveHarness);
    } catch {
      // ignore
    }
  }

  if (harness) {
    const seeded = await seedHarnessSuggestions();
    return { created: seeded.length };
  }

  const before = (await listSuggestions()).filter((s) => s.status === 'active').length;
  await detectResearchWithoutNotes();
  await detectSimilarProductTabs();
  await detectLeisureVsGoal();
  await detectEmailTime();
  await detectTravelBrowseReminder();
  await detectExecDayCoaching();
  const after = (await listSuggestions()).filter((s) => s.status === 'active').length;
  return { created: Math.max(0, after - before) };
}

export async function dismissSuggestion(id: string): Promise<ProactiveSuggestion | undefined> {
  const existing = (await listSuggestions()).find((s) => s.id === id);
  if (!existing) return undefined;
  const now = Date.now();
  const next: ProactiveSuggestion = {
    ...existing,
    status: 'dismissed',
    dismissUntil: now + DISMISS_SUPPRESS_MS,
    updatedAt: now,
  };
  await putSuggestion(next);
  return next;
}

export async function snoozeSuggestion(
  id: string,
  ms = DEFAULT_SNOOZE_MS,
): Promise<ProactiveSuggestion | undefined> {
  const existing = (await listSuggestions()).find((s) => s.id === id);
  if (!existing) return undefined;
  const now = Date.now();
  const next: ProactiveSuggestion = {
    ...existing,
    status: 'snoozed',
    snoozeUntil: now + ms,
    updatedAt: now,
  };
  await putSuggestion(next);
  return next;
}

export async function acceptSuggestion(id: string): Promise<ProactiveSuggestion | undefined> {
  const existing = (await listSuggestions()).find((s) => s.id === id);
  if (!existing) return undefined;
  const now = Date.now();

  if (existing.kind === 'smart_reminder' || existing.meta?.acceptCreatesReminder) {
    const text =
      typeof existing.meta?.reminderText === 'string'
        ? existing.meta.reminderText
        : 'Book before prices change';
    await createReminder({ text, when: now + 24 * 60 * 60_000 });
  }

  const next: ProactiveSuggestion = {
    ...existing,
    status: 'accepted',
    updatedAt: now,
  };
  await putSuggestion(next);
  return next;
}

export async function scheduleProactiveAlarm(): Promise<void> {
  try {
    await chrome.alarms.create(PROACTIVE_ALARM, { periodInMinutes: PROACTIVE_PERIOD_MINUTES });
  } catch {
    // ignore
  }
}

export function registerProactiveEngine(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== PROACTIVE_ALARM) return;
    void runProactiveEngine().catch(() => undefined);
  });
  void scheduleProactiveAlarm();
  void runProactiveEngine().catch(() => undefined);
}
