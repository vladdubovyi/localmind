import { categorizeDomain, domainFromUrl } from '@/phil/categories';
import type { FocusCategory } from '@/phil/types';
import {
  getPhilSettings,
  listGoals,
  listReminders,
  listTabActivitySince,
  putTabActivity,
  startOfLocalDay,
  uid,
} from '@/storage/phil';

interface ActiveDwell {
  tabId: number;
  url: string;
  title?: string;
  domain: string;
  startedAt: number;
  category: FocusCategory;
}

export type FocusLiveState = {
  domain: string;
  category: FocusCategory;
  startedAt: number;
  url: string;
  tabId: number;
};

const LIVE_KEY = 'philFocusLive';

let active: ActiveDwell | null = null;
let lastNudgeAt = 0;
let leisureStreakMs = 0;
let leisureStreakGoalId: string | null = null;

async function publishLive(next: ActiveDwell | null): Promise<void> {
  try {
    if (!next) {
      await chrome.storage.session.remove(LIVE_KEY);
      return;
    }
    const live: FocusLiveState = {
      domain: next.domain,
      category: next.category,
      startedAt: next.startedAt,
      url: next.url,
      tabId: next.tabId,
    };
    await chrome.storage.session.set({ [LIVE_KEY]: live });
  } catch {
    // session storage may be unavailable in some test profiles
  }
}

export async function readFocusLive(): Promise<FocusLiveState | null> {
  try {
    const stored = await chrome.storage.session.get(LIVE_KEY);
    return (stored[LIVE_KEY] as FocusLiveState | undefined) ?? null;
  } catch {
    return null;
  }
}

async function flushActive(now = Date.now()): Promise<void> {
  if (!active) return;
  const settings = await getPhilSettings();
  if (!settings.trackingEnabled) {
    active = null;
    await publishLive(null);
    return;
  }
  const ms = Math.max(0, now - active.startedAt);
  // Ignore tiny flickers, but keep short real dwells so Focus counters move.
  if (ms < 250) {
    active = null;
    await publishLive(null);
    return;
  }
  await putTabActivity({
    id: uid('act'),
    domain: active.domain,
    url: active.url,
    title: active.title,
    startedAt: active.startedAt,
    endedAt: now,
    ms,
    category: active.category,
  });

  const session = active;
  active = null;
  await publishLive(null);
  void maybeNudge(session, ms, now).catch(() => undefined);
}

async function maybeNudge(session: ActiveDwell, ms: number, now: number): Promise<void> {
  const settings = await getPhilSettings();
  if (!settings.nudgesEnabled) return;

  const goals = (await listGoals()).filter((g) => g.status === 'active');
  if (!goals.length) {
    leisureStreakMs = 0;
    leisureStreakGoalId = null;
    return;
  }

  const isLeisure =
    session.category === 'leisure' ||
    session.category === 'blocked' ||
    goals.some((g) =>
      g.blockedDomains.some(
        (d) => session.domain === d || session.domain.endsWith(`.${d}`),
      ),
    );

  const relevantGoal =
    goals.find((g) =>
      g.blockedDomains.some(
        (d) => session.domain === d || session.domain.endsWith(`.${d}`),
      ),
    ) ?? goals[0];

  if (!isLeisure) {
    leisureStreakMs = 0;
    leisureStreakGoalId = null;
    return;
  }

  if (leisureStreakGoalId !== relevantGoal.id) {
    leisureStreakMs = ms;
    leisureStreakGoalId = relevantGoal.id;
  } else {
    leisureStreakMs += ms;
  }

  if (leisureStreakMs < settings.nudgeThresholdMs) return;
  if (now - lastNudgeAt < 10 * 60_000) return;

  lastNudgeAt = now;
  leisureStreakMs = 0;
  try {
    await chrome.notifications.create(`phil-nudge-${now}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: 'Phil — focus check',
      message: `You set out to: ${relevantGoal.title}. Time to get back to it?`,
      priority: 1,
    });
  } catch {
    // notifications permission may be missing
  }
}

async function startDwell(tabId: number): Promise<void> {
  const settings = await getPhilSettings();
  if (!settings.trackingEnabled) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (
      !tab.url ||
      tab.url.startsWith('chrome') ||
      tab.url.startsWith('devtools') ||
      tab.url.startsWith('chrome-extension') ||
      tab.url.startsWith('edge') ||
      tab.url.startsWith('about:')
    ) {
      return;
    }
    const domain = domainFromUrl(tab.url);
    active = {
      tabId,
      url: tab.url,
      title: tab.title,
      domain,
      startedAt: Date.now(),
      category: categorizeDomain(tab.url, settings.categoryOverrides),
    };
    await publishLive(active);
  } catch {
    // tab gone
  }
}

/** Persist the current dwell and keep counting (survives SW sleeps better). */
export async function checkpointFocus(): Promise<void> {
  if (!active) return;
  const tabId = active.tabId;
  await flushActive();
  await startDwell(tabId);
}

/** Begin tracking the currently focused http(s) tab (call on SW boot). */
export async function resumeFocusTracking(): Promise<void> {
  try {
    const activeTabs = await chrome.tabs.query({ active: true });
    const httpTab = activeTabs.find(
      (t) => t.id != null && typeof t.url === 'string' && /^https?:/i.test(t.url),
    );
    if (httpTab?.id != null) {
      await startDwell(httpTab.id);
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab?.id != null) await startDwell(tab.id);
  } catch {
    // no focused window / tabs permission race
  }
}

export function registerFocusTracker(): void {
  chrome.tabs.onActivated.addListener((info) => {
    void (async () => {
      await flushActive();
      await startDwell(info.tabId);
    })();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' && !changeInfo.url) return;
    void (async () => {
      if (active?.tabId === tabId) {
        await flushActive();
      }
      const [focused] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (focused?.id === tabId) {
        await startDwell(tabId);
      } else if (tab.active) {
        await startDwell(tabId);
      }
    })();
  });

  chrome.windows.onFocusChanged.addListener((windowId) => {
    void (async () => {
      await flushActive();
      if (windowId === chrome.windows.WINDOW_ID_NONE) return;
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab?.id != null) await startDwell(tab.id);
    })();
  });

  if (chrome.idle?.onStateChanged) {
    chrome.idle.onStateChanged.addListener((state) => {
      if (state !== 'active') {
        void flushActive();
      }
    });
  }

  // Soft heartbeat while the SW stays awake (Focus UI polling also checkpoints).
  try {
    setInterval(() => {
      void checkpointFocus().catch(() => undefined);
    }, 15_000);
  } catch {
    // ignore
  }
}

export type FocusSummary = {
  byCategory: Record<FocusCategory, number>;
  byDomain: Array<{ domain: string; ms: number; category: FocusCategory }>;
  totalMs: number;
};

export type FocusActiveLive = {
  domain: string;
  category: FocusCategory;
  startedAt: number;
  elapsedMs: number;
  url: string;
};

export type FocusSnapshot = FocusSummary & {
  active: FocusActiveLive | null;
};

export async function focusSummaryToday(): Promise<FocusSummary> {
  const since = startOfLocalDay();
  const sessions = await listTabActivitySince(since);
  const byCategory: Record<FocusCategory, number> = {
    productive: 0,
    leisure: 0,
    neutral: 0,
    blocked: 0,
  };
  const domainMap = new Map<string, { domain: string; ms: number; category: FocusCategory }>();
  let totalMs = 0;
  for (const s of sessions) {
    byCategory[s.category] += s.ms;
    totalMs += s.ms;
    const prev = domainMap.get(s.domain);
    if (prev) prev.ms += s.ms;
    else domainMap.set(s.domain, { domain: s.domain, ms: s.ms, category: s.category });
  }
  const byDomain = [...domainMap.values()].sort((a, b) => b.ms - a.ms).slice(0, 25);
  return { byCategory, byDomain, totalMs };
}

/**
 * Storage summary + live dwell from chrome.storage.session.
 * Safe to call from the sidebar (no SW IPC required).
 */
export async function focusSnapshotFromStorage(): Promise<FocusSnapshot> {
  const base = await focusSummaryToday();
  const liveState = await readFocusLive();
  if (!liveState) {
    return { ...base, active: null };
  }
  const elapsedMs = Math.max(0, Date.now() - liveState.startedAt);
  const live: FocusActiveLive = {
    domain: liveState.domain,
    category: liveState.category,
    startedAt: liveState.startedAt,
    elapsedMs,
    url: liveState.url,
  };

  const byCategory = { ...base.byCategory };
  byCategory[live.category] += elapsedMs;
  const totalMs = base.totalMs + elapsedMs;
  const domainMap = new Map(base.byDomain.map((d) => [d.domain, { ...d }]));
  const prev = domainMap.get(live.domain);
  if (prev) prev.ms += elapsedMs;
  else domainMap.set(live.domain, { domain: live.domain, ms: elapsedMs, category: live.category });
  const byDomain = [...domainMap.values()].sort((a, b) => b.ms - a.ms).slice(0, 25);

  return { byCategory, byDomain, totalMs, active: live };
}

/**
 * Storage summary + in-SW live dwell. Prefer focusSnapshotFromStorage in UI.
 */
export async function focusSnapshot(opts?: { checkpoint?: boolean }): Promise<FocusSnapshot> {
  if (opts?.checkpoint) {
    await checkpointFocus();
  }
  // Keep session mirror in sync for UI readers.
  await publishLive(active);
  return focusSnapshotFromStorage();
}

/** @deprecated Prefer assigning hooks from the service worker entry. */
export function installFocusTestHooks(): void {
  const g = globalThis as typeof globalThis & {
    __philFocus?: {
      resumeFocusTracking: typeof resumeFocusTracking;
      checkpointFocus: typeof checkpointFocus;
      focusSnapshot: typeof focusSnapshot;
    };
  };
  g.__philFocus = {
    resumeFocusTracking,
    checkpointFocus,
    focusSnapshot,
  };
}

export async function composeBriefingContent(): Promise<{
  content: string;
  sources: {
    reminderCount: number;
    activeGoalCount: number;
    focusMs: { productive: number; leisure: number; neutral: number; blocked: number };
  };
}> {
  const reminders = (await listReminders()).filter(
    (r) => r.status === 'scheduled' && r.when >= startOfLocalDay(),
  );
  const goals = (await listGoals()).filter((g) => g.status === 'active');
  const focus = await focusSummaryToday();

  const lines: string[] = ['Good morning — here’s what’s up today.', ''];

  if (goals.length) {
    lines.push('**Active goals**');
    for (const g of goals) lines.push(`- ${g.title}`);
    lines.push('');
  } else {
    lines.push('No active goals yet. Tell Phil what you want to finish today.');
    lines.push('');
  }

  if (reminders.length) {
    lines.push('**Reminders**');
    for (const r of reminders.slice(0, 8)) {
      const t = new Date(r.when);
      lines.push(
        `- ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${r.text}`,
      );
    }
    lines.push('');
  } else {
    lines.push('No reminders scheduled for later today.');
    lines.push('');
  }

  const mins = (ms: number) => Math.round(ms / 60_000);
  lines.push('**Focus so far**');
  lines.push(
    `- Productive: ${mins(focus.byCategory.productive)}m · Leisure: ${mins(focus.byCategory.leisure)}m · Other: ${mins(focus.byCategory.neutral + focus.byCategory.blocked)}m`,
  );
  if (focus.byDomain[0]) {
    lines.push(
      `- Top site: ${focus.byDomain[0].domain} (${mins(focus.byDomain[0].ms)}m, ${focus.byDomain[0].category})`,
    );
  }

  return {
    content: lines.join('\n'),
    sources: {
      reminderCount: reminders.length,
      activeGoalCount: goals.length,
      focusMs: { ...focus.byCategory },
    },
  };
}
