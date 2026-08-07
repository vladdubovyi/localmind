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
  /** Optional cron-ish repeat: none | daily | weekdays | weekly (WF-09) */
  repeat: 'none' | 'daily' | 'weekdays' | 'weekly';
  /** 0=Sun … 6=Sat when repeat is weekly (device TZ). */
  repeatWeekday?: number;
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

/** Proactive / nudge delivery frequency (SET-02/03). */
export type NotificationFrequency = 'off' | 'low' | 'normal' | 'high';

export interface PhilAssistantSettings {
  fabEnabled: boolean;
  trackingEnabled: boolean;
  nudgesEnabled: boolean;
  briefingEnabled: boolean;
  /** Local hour 0–23 for morning briefing. */
  briefingHour: number;
  briefingMinute: number;
  /** Continuous leisure ms before a goal nudge (SET-04 sensitivity). */
  nudgeThresholdMs: number;
  /** Caps proactive + nudge notifications (SET-02/03). */
  notificationFrequency: NotificationFrequency;
  /** Default lead time when creating a reminder without an explicit when (SET-05). */
  reminderDefaultLeadMinutes: number;
  /** Default repeat applied to new reminders when not overridden (SET-05). */
  reminderDefaultRepeat: Reminder['repeat'];
  /** Suppress Chrome notifications during this local-hour window (SET-06). */
  quietHoursEnabled: boolean;
  /** Inclusive start hour 0–23 in device TZ. */
  quietHoursStartHour: number;
  /** Exclusive end hour 0–23 in device TZ (may wrap past midnight). */
  quietHoursEndHour: number;
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
  notificationFrequency: 'normal',
  reminderDefaultLeadMinutes: 30,
  reminderDefaultRepeat: 'none',
  quietHoursEnabled: false,
  quietHoursStartHour: 22,
  quietHoursEndHour: 7,
  locality: '',
  categoryOverrides: {},
};

export type PhilQuickIntentKind =
  | 'open_today'
  | 'open_focus'
  | 'open_goals'
  | 'open_reminders'
  | 'open_agent'
  | 'open_privacy'
  | 'open_phil_settings'
  | 'summarize_page'
  | 'remind'
  | 'set_goal'
  | 'whats_up'
  | 'focus_status';

export interface PhilQuickIntent {
  kind: PhilQuickIntentKind;
  text?: string;
  createdAt: number;
}
