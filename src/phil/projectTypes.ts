/**
 * Persistent Project contracts (plan §16).
 * Storage/UI owned by B2; template skills by C1 — these shapes are the freeze.
 *
 * Timezone: scheduling always uses device/browser TZ. Optional `displayTimezone`
 * is display-only preference text and must not override system TZ.
 */

/** Project template union — locked in go-live plan §16. */
export type ProjectTemplate =
  | 'career'
  | 'job_hunt'
  | 'research'
  | 'exec_day'
  | 'life_move'
  | 'custom';

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export type MilestoneStatus = 'not_started' | 'in_progress' | 'done' | 'cancelled';

export type ProjectMilestone = {
  id: string;
  title: string;
  status: MilestoneStatus;
  /** Optional target (epoch ms); evaluated in device TZ. */
  targetDate?: number;
  notes?: string;
  /** Nested workstream / subproject id when Life Planner style. */
  parentMilestoneId?: string;
  updatedAt: number;
};

export type ProjectKnowledgeEntry = {
  id: string;
  url?: string;
  title: string;
  summary: string;
  tags: string[];
  capturedAt: number;
  /** Source page domain or 'user' / 'agent'. */
  source?: string;
};

/**
 * Template-specific metrics bag. Known keys are optional; pods may extend
 * via index signature without forking PersistentProject.
 */
export type ProjectMetrics = {
  /** Career: estimated weekly study hours. */
  weeklyStudyHours?: number;
  /** Job hunt: salary target (numeric, currency in salaryCurrency). */
  salaryTarget?: number;
  salaryCurrency?: string;
  /** Job hunt: location preference e.g. "remote". */
  locationPreference?: string;
  /** Job hunt / career: tech stack labels. */
  techStack?: string[];
  preferredCompanies?: string[];
  /** Progress ratio 0–1 when computed. */
  progressRatio?: number;
  [key: string]: unknown;
};

/**
 * First-class Persistent Project entity.
 * Goals, reminders, knowledge, browse, and briefings attach via linked ids / entries.
 */
export type PersistentProject = {
  id: string;
  title: string;
  template: ProjectTemplate;
  status: ProjectStatus;
  createdAt: number;
  updatedAt: number;
  /** Optional target / deadline (epoch ms), device TZ for display. */
  targetDate?: number;
  milestones: ProjectMilestone[];
  linkedGoalIds: string[];
  linkedReminderIds: string[];
  knowledgeEntries: ProjectKnowledgeEntry[];
  metrics: ProjectMetrics;
  lastProgressAt: number;
  /**
   * Optional human-readable TZ label only — never used for scheduling.
   * Scheduling always uses device/browser default (locked decision).
   */
  displayTimezone?: string;
  /** Parent project id for Life Planner subprojects / workstreams. */
  parentProjectId?: string;
  /** Short status blurb for UI / briefing slices. */
  statusSummary?: string;
};

/** Stub: memories may reference a project (B4 owns storage). */
export type ProjectScopedMemoryRef = {
  projectId?: string;
};

/** Stub: remind Goal/Reminder rows to carry optional projectId (B2/B5). */
export type ProjectLinkFields = {
  projectId?: string;
};

/** Active project selection for Agent turns (PRJ-04). */
export type ActiveProjectSelection = {
  activeProjectId: string | null;
  updatedAt: number;
};
