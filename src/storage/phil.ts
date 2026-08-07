import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  Goal,
  MorningBriefing,
  PhilAssistantSettings,
  Reminder,
  TabActivitySession,
} from '@/phil/types';
import { DEFAULT_PHIL_SETTINGS } from '@/phil/types';

interface PhilDB extends DBSchema {
  philSettings: {
    key: string;
    value: PhilAssistantSettings;
  };
  reminders: {
    key: string;
    value: Reminder;
    indexes: { 'by-when': number };
  };
  goals: {
    key: string;
    value: Goal;
    indexes: { 'by-updated': number };
  };
  tabActivity: {
    key: string;
    value: TabActivitySession;
    indexes: { 'by-started': number; 'by-domain': string };
  };
  briefings: {
    key: string;
    value: MorningBriefing;
    indexes: { 'by-date': string };
  };
}

const DB_NAME = 'phil';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<PhilDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<PhilDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('philSettings')) {
          db.createObjectStore('philSettings');
        }
        if (!db.objectStoreNames.contains('reminders')) {
          const store = db.createObjectStore('reminders', { keyPath: 'id' });
          store.createIndex('by-when', 'when');
        }
        if (!db.objectStoreNames.contains('goals')) {
          const store = db.createObjectStore('goals', { keyPath: 'id' });
          store.createIndex('by-updated', 'updatedAt');
        }
        if (!db.objectStoreNames.contains('tabActivity')) {
          const store = db.createObjectStore('tabActivity', { keyPath: 'id' });
          store.createIndex('by-started', 'startedAt');
          store.createIndex('by-domain', 'domain');
        }
        if (!db.objectStoreNames.contains('briefings')) {
          const store = db.createObjectStore('briefings', { keyPath: 'id' });
          store.createIndex('by-date', 'dateKey');
        }
      },
    });
  }
  return dbPromise;
}

export async function getPhilSettings(): Promise<PhilAssistantSettings> {
  const db = await getDb();
  const stored = await db.get('philSettings', 'app');
  return { ...DEFAULT_PHIL_SETTINGS, ...stored };
}

export async function savePhilSettings(
  partial: Partial<PhilAssistantSettings>,
): Promise<PhilAssistantSettings> {
  const current = await getPhilSettings();
  const next = {
    ...current,
    ...partial,
    categoryOverrides: {
      ...current.categoryOverrides,
      ...partial.categoryOverrides,
    },
  };
  const db = await getDb();
  await db.put('philSettings', next, 'app');
  await chrome.storage.local.set({ philSettings: next });
  return next;
}

export async function listReminders(): Promise<Reminder[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('reminders', 'by-when');
  return all;
}

export async function putReminder(reminder: Reminder): Promise<void> {
  const db = await getDb();
  await db.put('reminders', reminder);
}

export async function getReminder(id: string): Promise<Reminder | undefined> {
  const db = await getDb();
  return db.get('reminders', id);
}

export async function deleteReminder(id: string): Promise<void> {
  const db = await getDb();
  await db.delete('reminders', id);
}

export async function listGoals(): Promise<Goal[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('goals', 'by-updated');
  return all.reverse();
}

export async function putGoal(goal: Goal): Promise<void> {
  const db = await getDb();
  await db.put('goals', goal);
}

export async function getGoal(id: string): Promise<Goal | undefined> {
  const db = await getDb();
  return db.get('goals', id);
}

export async function putTabActivity(session: TabActivitySession): Promise<void> {
  const db = await getDb();
  await db.put('tabActivity', session);
}

export async function listTabActivitySince(sinceMs: number): Promise<TabActivitySession[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('tabActivity', 'by-started');
  return all.filter((s) => s.startedAt >= sinceMs);
}

export async function putBriefing(briefing: MorningBriefing): Promise<void> {
  const db = await getDb();
  await db.put('briefings', briefing);
}

export async function getBriefingByDate(dateKey: string): Promise<MorningBriefing | undefined> {
  const db = await getDb();
  const all = await db.getAllFromIndex('briefings', 'by-date', dateKey);
  return all.sort((a, b) => b.createdAt - a.createdAt)[0];
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfLocalDay(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}
