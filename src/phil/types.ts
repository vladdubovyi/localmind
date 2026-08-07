/** Phil personal-assistant domain types. */

export type {
  ActiveProjectSelection,
  MilestoneStatus,
  PersistentProject,
  ProjectKnowledgeEntry,
  ProjectLinkFields,
  ProjectMetrics,
  ProjectMilestone,
  ProjectScopedMemoryRef,
  ProjectStatus,
  ProjectTemplate,
} from './projectTypes';

export type FocusCategory = 'productive' | 'leisure' | 'neutral' | 'blocked';

export interface TabActivitySession {
  id: string;
  domain: string;
  url: string;
  title?: string;
  startedAt: number;
  endedAt: number;
  ms: number;
  category: FocusCategory;
}

export interface Reminder {
  id: string;
  text: string;
  when: number;
  /** Optional cron-ish repeat: none | daily | weekdays */
  repeat: 'none' | 'daily' | 'weekdays';
  status: 'scheduled' | 'fired' | 'done' | 'cancelled';
  createdAt: number;
  updatedAt: number;
  /** Optional Persistent Project link (plan §16 / Wave-0 freeze). */
  projectId?: string;
}

export interface Goal {
  id: string;
  title: string;
  /** End of local day deadline (epoch ms), optional. */
  deadline?: number;
  status: 'active' | 'completed' | 'cancelled';
  allowedDomains: string[];
  blockedDomains: string[];
  createdAt: number;
  updatedAt: number;
  /** Optional Persistent Project link (plan §16 / Wave-0 freeze). */
  projectId?: string;
}

export interface MorningBriefing {
  id: string;
  dateKey: string; // YYYY-MM-DD local
  content: string;
  createdAt: number;
  sources: {
    reminderCount: number;
    activeGoalCount: number;
    focusMs: { productive: number; leisure: number; neutral: number; blocked: number };
  };
}

export interface PhilAssistantSettings {
  fabEnabled: boolean;
  trackingEnabled: boolean;
  nudgesEnabled: boolean;
  briefingEnabled: boolean;
  /** Local hour 0–23 for morning briefing. */
  briefingHour: number;
  briefingMinute: number;
  /** Continuous leisure ms before a goal nudge. */
  nudgeThresholdMs: number;
  locality: string;
  categoryOverrides: Record<string, FocusCategory>;
}

export const DEFAULT_PHIL_SETTINGS: PhilAssistantSettings = {
  fabEnabled: true,
  trackingEnabled: true,
  nudgesEnabled: true,
  briefingEnabled: true,
  briefingHour: 8,
  briefingMinute: 0,
  nudgeThresholdMs: 2 * 60_000,
  locality: '',
  categoryOverrides: {},
};

export type PhilQuickIntentKind =
  | 'open_today'
  | 'open_focus'
  | 'open_goals'
  | 'open_reminders'
  | 'remind'
  | 'set_goal'
  | 'whats_up'
  | 'focus_status';

export interface PhilQuickIntent {
  kind: PhilQuickIntentKind;
  text?: string;
  createdAt: number;
}
