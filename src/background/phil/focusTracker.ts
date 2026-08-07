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
import { getActiveProject } from '@/storage/projects';

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
/** Alarm that wakes the SW so long single-tab dwells still flush to storage. */
export const FOCUS_CHECKPOINT_ALARM = 'phil-focus-checkpoint';
const CHECKPOINT_PERIOD_MINUTES = 1;
/** Flush a continuing dwell at least this often so SW death cannot erase minutes. */
const CHECKPOINT_MIN_MS = 15_000;

let active: ActiveDwell | null = null;
let lastNudgeAt = 0;
let leisureStreakMs = 0;
let leisureStreakGoalId: string | null = null;
let trackerRegistered = false;

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

/**
 * Restore in-memory dwell from session storage after SW sleep.
 * Without this, tabs.onActivated flushes nothing and overwrites live state,
 * discarding time the Focus UI was already showing.
 */
async function hydrateActiveFromLive(): Promise<void> {
  if (active) return;
  const live = await readFocusLive();
  if (!live) return;
  active = {
    tabId: live.tabId,
    url: live.url,
    domain: live.domain,
    startedAt: live.startedAt,
    category: live.category,
  };
}

function isTrackableUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (!/^https?:/i.test(url)) return false;
  if (
    url.startsWith('chrome') ||
    url.startsWith('devtools') ||
    url.startsWith('chrome-extension') ||
    url.startsWith('edge') ||
    url.startsWith('about:')
  ) {
    return false;
  }
  return true;
}

async function flushActive(now = Date.now()): Promise<void> {
  await hydrateActiveFromLive();
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

async function startDwell(
  tabId: number,
  hint?: { url?: string; title?: string },
): Promise<void> {
  const settings = await getPhilSettings();
  if (!settings.trackingEnabled) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    const url = hint?.url || tab.url;
    if (!isTrackableUrl(url)) {
      return;
    }
    const domain = domainFromUrl(url!);
    // Same tab+domain already counting — keep original startedAt.
    if (
      active &&
      active.tabId === tabId &&
      active.domain === domain &&
      Math.abs(Date.now() - active.startedAt) < 24 * 60 * 60_000
    ) {
      active.url = url!;
      if (hint?.title || tab.title) active.title = hint?.title || tab.title;
      await publishLive(active);
      return;
    }
    active = {
      tabId,
      url: url!,
      title: hint?.title || tab.title,
      domain,
      startedAt: Date.now(),
      category: categorizeDomain(url!, settings.categoryOverrides),
    };
    await publishLive(active);
  } catch {
    // tab gone
  }
}

/** Persist the current dwell and keep counting (survives SW sleeps better). */
export async function checkpointFocus(opts?: { force?: boolean }): Promise<void> {
  await hydrateActiveFromLive();
  if (!active) return;
  const elapsed = Date.now() - active.startedAt;
  // Avoid churning storage on every tick; still flush often enough for SW death.
  if (!opts?.force && elapsed < CHECKPOINT_MIN_MS) return;
  if (elapsed < 250) return;
  const tabId = active.tabId;
  const url = active.url;
  const title = active.title;
  await flushActive();
  await startDwell(tabId, { url, title });
}

async function ensureCheckpointAlarm(): Promise<void> {
  try {
    await chrome.alarms.create(FOCUS_CHECKPOINT_ALARM, {
      periodInMinutes: CHECKPOINT_PERIOD_MINUTES,
    });
  } catch {
    // alarms may be unavailable in some test environments
  }
}

/** Begin tracking the currently focused http(s) tab (call on SW boot). */
export async function resumeFocusTracking(): Promise<void> {
  await hydrateActiveFromLive();
  try {
    const activeTabs = await chrome.tabs.query({ active: true });
    const httpTab = activeTabs.find(
      (t) => t.id != null && typeof t.url === 'string' && /^https?:/i.test(t.url),
    );
    const focused =
      httpTab ??
      (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];

    if (focused?.id == null) {
      if (active) await flushActive();
      return;
    }

    // Still on the same live tab — keep counting from the stored startedAt.
    if (
      active &&
      active.tabId === focused.id &&
      focused.url &&
      domainFromUrl(focused.url) === active.domain
    ) {
      active.url = focused.url;
      active.title = focused.title ?? active.title;
      await publishLive(active);
      await ensureCheckpointAlarm();
      return;
    }

    // Focus moved while we were asleep — credit the orphaned dwell first.
    if (active) await flushActive();
    await startDwell(focused.id);
    await ensureCheckpointAlarm();
  } catch {
    // no focused window / tabs permission race
  }
}

/**
 * Content-script heartbeat: wakes the SW while a visible page stays open,
 * which is what MV3 needs for continuous single-tab dwell tracking.
 */
export async function handleFocusHeartbeat(input: {
  tabId?: number;
  url?: string;
  title?: string;
  visible?: boolean;
}): Promise<void> {
  const settings = await getPhilSettings();
  if (!settings.trackingEnabled) return;

  await hydrateActiveFromLive();

  if (input.visible === false) {
    if (input.tabId != null && active?.tabId === input.tabId) {
      await flushActive();
    }
    return;
  }

  const tabId = input.tabId;
  if (tabId == null || !isTrackableUrl(input.url)) return;

  // Only count the focused tab in its window (content scripts also run in background tabs).
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.active) return;
  } catch {
    return;
  }

  if (active && active.tabId !== tabId) {
    await flushActive();
  }

  if (
    active &&
    active.tabId === tabId &&
    input.url &&
    domainFromUrl(input.url) === active.domain
  ) {
    active.url = input.url;
    if (input.title) active.title = input.title;
    await publishLive(active);
    await checkpointFocus();
    await ensureCheckpointAlarm();
    return;
  }

  if (active) await flushActive();
  await startDwell(tabId, { url: input.url, title: input.title });
  await ensureCheckpointAlarm();
}

export function registerFocusTracker(): void {
  if (trackerRegistered) return;
  trackerRegistered = true;

  chrome.tabs.onActivated.addListener((info) => {
    void (async () => {
      await hydrateActiveFromLive();
      await flushActive();
      await startDwell(info.tabId);
      await ensureCheckpointAlarm();
    })();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' && !changeInfo.url) return;
    void (async () => {
      await hydrateActiveFromLive();
      if (active?.tabId === tabId) {
        await flushActive();
      }
      const [focused] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (focused?.id === tabId) {
        await startDwell(tabId);
      } else if (tab.active) {
        await startDwell(tabId);
      }
      await ensureCheckpointAlarm();
    })();
  });

  chrome.windows.onFocusChanged.addListener((windowId) => {
    void (async () => {
      await hydrateActiveFromLive();
      await flushActive();
      if (windowId === chrome.windows.WINDOW_ID_NONE) return;
      const [tab] = await chrome.tabs.query({ active: true, windowId });
      if (tab?.id != null) await startDwell(tab.id);
      await ensureCheckpointAlarm();
    })();
  });

  if (chrome.idle?.onStateChanged) {
    chrome.idle.onStateChanged.addListener((state) => {
      if (state !== 'active') {
        void (async () => {
          await hydrateActiveFromLive();
          await flushActive();
        })();
      }
    });
  }

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name !== FOCUS_CHECKPOINT_ALARM) return;
    void (async () => {
      await resumeFocusTracking();
      await checkpointFocus();
    })();
  });

  // Soft heartbeat while the SW stays awake (content script + alarms cover sleep).
  try {
    setInterval(() => {
      void checkpointFocus().catch(() => undefined);
    }, 15_000);
  } catch {
    // ignore
  }

  void ensureCheckpointAlarm();
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
export async function focusSnapshot(opts?: {
  checkpoint?: boolean;
  forceCheckpoint?: boolean;
}): Promise<FocusSnapshot> {
  await hydrateActiveFromLive();
  if (opts?.checkpoint) {
    await checkpointFocus({ force: opts.forceCheckpoint !== false });
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

  // PRJ-03: mention active Persistent Project when present.
  const activeProject = await getActiveProject();
  if (activeProject && activeProject.status === 'active') {
    const todayMilestone = activeProject.milestones.find(
      (m) => m.status === 'in_progress' || m.status === 'not_started',
    );
    lines.push('**Active project**');
    lines.push(
      `- ${activeProject.title} (${activeProject.template})${
        todayMilestone ? ` — today’s focus: ${todayMilestone.title}` : ''
      }`,
    );
    lines.push('');
  } else {
    lines.push('No active project yet — open Projects to start a long-horizon plan.');
    lines.push('');
  }

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
