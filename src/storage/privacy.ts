/**
 * Privacy-related helpers: permission inventory, clear-data, calendar/history status.
 */
import {
  getAgentPermissionState,
  revokeAgentPermissions,
  AGENT_OPTIONAL_PERMISSIONS,
} from '@/agent/permissions';
import { clearMemories } from '@/storage/memory';
import {
  clearBrowseIndex,
  hasHistoryPermission,
  requestHistoryPermission,
  revokeHistoryPermission,
} from '@/storage/browserMemory';
import { clearConversations, getSettings, saveSettings } from '@/storage/db';
import { getOnboardingState } from '@/storage/onboarding';

export type PermissionRow = {
  id: string;
  label: string;
  detail: string;
  granted: boolean;
  optional: boolean;
};

export type DataFlowRow = { label: string; detail: string };

const CALENDAR_KEY = 'philCalendar';

export type CalendarConnectState = { connected: boolean; connectedAt?: number };

export async function getCalendarConnectState(): Promise<CalendarConnectState> {
  const stored = await chrome.storage.local.get(CALENDAR_KEY);
  const value = stored[CALENDAR_KEY] as Partial<CalendarConnectState> | undefined;
  if (value?.connected) return { connected: true, connectedAt: value.connectedAt };
  const onboarding = await getOnboardingState();
  if ((onboarding as { grantedCalendar?: boolean }).grantedCalendar) return { connected: true };
  return { connected: false };
}

export async function setCalendarConnected(connected: boolean): Promise<CalendarConnectState> {
  const next: CalendarConnectState = connected
    ? { connected: true, connectedAt: Date.now() }
    : { connected: false };
  await chrome.storage.local.set({ [CALENDAR_KEY]: next });
  return next;
}

async function hasNotificationPermission(): Promise<boolean> {
  try {
    const all = await chrome.permissions.getAll();
    return (all.permissions ?? []).includes('notifications');
  } catch {
    return true;
  }
}

export async function getPermissionInventory(): Promise<PermissionRow[]> {
  const agent = await getAgentPermissionState();
  const history = await hasHistoryPermission();
  const notifications = await hasNotificationPermission();
  const calendar = await getCalendarConnectState();
  return [
    { id: 'tabs', label: 'tabs', detail: 'Focus tracking + Agent tab tools', granted: agent.tabs, optional: false },
    { id: 'scripting', label: 'scripting', detail: 'Page helpers for Ask this page / Agent', granted: true, optional: false },
    { id: 'notifications', label: 'notifications', detail: 'Reminder, nudge, and briefing alerts', granted: notifications, optional: false },
    { id: 'gmail', label: 'Gmail', detail: 'identity + Gmail hosts (optional)', granted: agent.identity, optional: true },
    { id: 'calendar', label: 'Calendar', detail: 'Google Calendar for daily planning (optional)', granted: calendar.connected, optional: true },
    { id: 'history', label: 'history', detail: 'Browser memory — index recent visits so Phil can find articles you read', granted: history, optional: true },
    { id: 'hosts', label: 'site access', detail: 'http(s) hosts for Agent page control + research', granted: agent.allUrls, optional: true },
  ];
}

export function localDataRows(calendarEnabled: boolean): DataFlowRow[] {
  const rows: DataFlowRow[] = [
    { label: 'Prompts & page text', detail: 'Processed on-device by the local model' },
    { label: 'Chats & conversations', detail: 'Stored in IndexedDB on this device' },
    { label: 'Goals & reminders', detail: 'chrome.storage.local only' },
    { label: 'Focus sessions', detail: 'Tab dwell stays on device' },
    { label: 'Memories', detail: 'Keyword memory store on this device' },
    { label: 'Browser memory', detail: 'Indexed visits (history + tab activity) stay on this device' },
    {
      label: 'Persistent Projects knowledge',
      detail: 'Project titles, workstreams, and knowledge notes stay on this device',
    },
    {
      label: 'Project browse auto-capture',
      detail:
        'When enabled, goal-aware browsing may silently attach visits to the active project (never leaves the device)',
    },
  ];
  if (calendarEnabled) {
    rows.push({ label: 'Calendar event summaries', detail: 'Cached locally after sync' });
  }
  return rows;
}

export function leavesDeviceRows(opts: { gmail: boolean; calendar: boolean }): DataFlowRow[] {
  return [
    { label: 'Model download / CDN', detail: 'WebLLM artifacts from Hugging Face / GitHub (then cached offline)' },
    { label: 'Google web research', detail: 'Search queries may leave the device when you run research' },
    {
      label: 'Gmail',
      detail: opts.gmail
        ? 'Enabled — Gmail API / mail.google.com traffic when you use email tools'
        : 'Disabled — connect in Agent settings to enable',
    },
    {
      label: 'Calendar sync',
      detail: opts.calendar
        ? 'Enabled — event sync may leave the device'
        : 'Disabled — connect Calendar to enable',
    },
  ];
}

export async function clearChats(): Promise<void> {
  await clearConversations();
}

export async function clearAllMemories(): Promise<number> {
  return clearMemories();
}

export async function clearFocusHistory(): Promise<void> {
  await chrome.storage.local.set({ philTabActivity: [] });
  try {
    await chrome.storage.session.remove('philFocusLive');
  } catch {
    /* ignore */
  }
}

export async function clearBrowserMemory(): Promise<number> {
  return clearBrowseIndex();
}

export async function enableHistoryFromPrivacy(): Promise<boolean> {
  return requestHistoryPermission();
}

export async function revokeOptionalPermission(
  id: 'gmail' | 'hosts' | 'calendar' | 'history',
): Promise<boolean> {
  if (id === 'calendar') {
    await setCalendarConnected(false);
    return true;
  }
  if (id === 'history') {
    await clearBrowseIndex();
    return revokeHistoryPermission();
  }
  if (id === 'gmail') {
    try {
      return await chrome.permissions.remove({
        permissions: [...AGENT_OPTIONAL_PERMISSIONS] as chrome.runtime.ManifestPermission[],
        origins: [
          'https://mail.google.com/*',
          'https://gmail.googleapis.com/*',
          'https://www.googleapis.com/*',
          'https://accounts.google.com/*',
        ],
      });
    } catch {
      return false;
    }
  }
  return revokeAgentPermissions();
}

export async function connectCalendarFromPrivacy(): Promise<CalendarConnectState> {
  return setCalendarConnected(true);
}

export async function ensurePrivacyDefaults(): Promise<void> {
  const settings = await getSettings();
  let dirty = false;
  const next = { ...settings };
  if (settings.analyticsEnabled === undefined) {
    next.analyticsEnabled = false;
    dirty = true;
  }
  if (settings.crashReportingEnabled === undefined) {
    next.crashReportingEnabled = false;
    dirty = true;
  }
  if (settings.projectBrowseCaptureEnabled === undefined) {
    next.projectBrowseCaptureEnabled = true;
    dirty = true;
  }
  if (dirty) await saveSettings(next);
}
