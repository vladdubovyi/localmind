/**
 * Persistent Project storage via chrome.storage.local (same pattern as Phil PA).
 * Plan §16 / Agent B2 — core CRUD only; template playbooks are Wave 2 C1.
 */
import type {
  ActiveProjectSelection,
  PersistentProject,
  ProjectKnowledgeEntry,
  ProjectMilestone,
  ProjectStatus,
  ProjectTemplate,
} from '@/phil/projectTypes';
import { uid } from '@/storage/phil';
import { homeStandingSummary } from '@/storage/projectPlaybooks';

const KEYS = {
  projects: 'philProjects',
  active: 'philActiveProject',
} as const;

const TEMPLATES: ProjectTemplate[] = [
  'career',
  'job_hunt',
  'research',
  'exec_day',
  'life_move',
  'custom',
];

async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const stored = await chrome.storage.local.get(key);
  const value = stored[key];
  return (value as T | undefined) ?? fallback;
}

async function setLocal(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

export function isProjectTemplate(value: string): value is ProjectTemplate {
  return (TEMPLATES as string[]).includes(value);
}

/** Infer template from long-horizon NL (light heuristic; C1 owns full playbooks). */
export function inferProjectTemplate(text: string): ProjectTemplate {
  const t = text.toLowerCase();
  if (/\b(staff|principal|promo|promotion|career|engineer|manager)\b/.test(t)) return 'career';
  if (/\b(job|interview|resume|cv|hiring|apply|applications?)\b/.test(t)) return 'job_hunt';
  if (/\b(research|paper|study|learn|investigate)\b/.test(t)) return 'research';
  if (/\b(exec|calendar|day plan|schedule my day|eod)\b/.test(t)) return 'exec_day';
  if (/\b(move|relocat|spain|house|apartment|mortgage|visa)\b/.test(t)) return 'life_move';
  return 'custom';
}

export function templateLabel(template: ProjectTemplate): string {
  switch (template) {
    case 'career':
      return 'Career Accelerator';
    case 'job_hunt':
      return 'Job Hunt Copilot';
    case 'research':
      return 'Research';
    case 'exec_day':
      return 'Executive Day';
    case 'life_move':
      return 'Life Planner';
    default:
      return 'Custom';
  }
}

export async function listProjects(): Promise<PersistentProject[]> {
  const all = await getLocal<PersistentProject[]>(KEYS.projects, []);
  return [...all].sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<PersistentProject | undefined> {
  const all = await listProjects();
  return all.find((p) => p.id === id);
}

export async function putProject(project: PersistentProject): Promise<void> {
  const all = await listProjects();
  const idx = all.findIndex((p) => p.id === project.id);
  if (idx >= 0) all[idx] = project;
  else all.push(project);
  await setLocal(KEYS.projects, all);
}

export async function deleteProject(id: string): Promise<void> {
  const all = await listProjects();
  await setLocal(
    KEYS.projects,
    all.filter((p) => p.id !== id),
  );
  const active = await getActiveProjectSelection();
  if (active.activeProjectId === id) {
    await setActiveProjectId(null);
  }
}

export async function getActiveProjectSelection(): Promise<ActiveProjectSelection> {
  return getLocal<ActiveProjectSelection>(KEYS.active, {
    activeProjectId: null,
    updatedAt: 0,
  });
}

export async function getActiveProjectId(): Promise<string | null> {
  const sel = await getActiveProjectSelection();
  return sel.activeProjectId;
}

export async function getActiveProject(): Promise<PersistentProject | undefined> {
  const id = await getActiveProjectId();
  if (!id) return undefined;
  return getProject(id);
}

export async function setActiveProjectId(id: string | null): Promise<ActiveProjectSelection> {
  const next: ActiveProjectSelection = {
    activeProjectId: id,
    updatedAt: Date.now(),
  };
  await setLocal(KEYS.active, next);
  return next;
}

export type CreateProjectInput = {
  title: string;
  template?: ProjectTemplate;
  targetDate?: number;
  status?: ProjectStatus;
  milestoneTitles?: string[];
  milestones?: ProjectMilestone[];
  statusSummary?: string;
  metrics?: PersistentProject['metrics'];
  knowledgeEntries?: PersistentProject['knowledgeEntries'];
  utterance?: string;
  applyPlaybook?: boolean;
  makeActive?: boolean;
};

export async function createProject(input: CreateProjectInput): Promise<PersistentProject> {
  const now = Date.now();
  const title = input.title.trim();
  if (!title) throw new Error('title is required');
  const template = input.template ?? inferProjectTemplate(title);
  const { playbookForTemplate } = await import('@/storage/projectPlaybooks');
  const book = input.applyPlaybook === false ? null : playbookForTemplate(template, title, input.utterance ?? title, now);

  let milestones: ProjectMilestone[];
  if (input.milestones?.length) milestones = input.milestones;
  else if (input.milestoneTitles?.length) {
    milestones = input.milestoneTitles.map((mTitle, i) => ({
      id: uid('ms'), title: mTitle.trim() || `Milestone ${i + 1}`,
      status: (i === 0 ? 'in_progress' : 'not_started') as ProjectMilestone['status'], updatedAt: now,
    }));
  } else if (book) milestones = book.milestones;
  else {
    milestones = [{ id: uid('ms'), title: `Get started on ${title}`, status: 'in_progress', updatedAt: now }];
  }

  const metrics = { ...(book?.metrics ?? {}), ...(input.metrics ?? {}) };
  const statusSummary = input.statusSummary ?? book?.statusSummary ?? `I've set up your ${title} project — tracking milestones in project terms.`;
  const targetDate = input.targetDate ?? book?.targetDate;

  const project: PersistentProject = {
    id: uid('prj'), title, template, status: input.status ?? 'active',
    createdAt: now, updatedAt: now, targetDate, milestones,
    linkedGoalIds: [], linkedReminderIds: [], knowledgeEntries: input.knowledgeEntries ?? [],
    metrics, lastProgressAt: now, statusSummary,
  };
  await putProject(project);
  if (input.makeActive !== false) await setActiveProjectId(project.id);
  return project;
}

export async function updateProject(
  id: string,
  patch: Partial<
    Pick<
      PersistentProject,
      | 'title'
      | 'template'
      | 'status'
      | 'targetDate'
      | 'statusSummary'
      | 'metrics'
      | 'displayTimezone'
      | 'parentProjectId'
    >
  > & {
    milestones?: ProjectMilestone[];
  },
): Promise<PersistentProject | undefined> {
  const existing = await getProject(id);
  if (!existing) return undefined;
  const next: PersistentProject = {
    ...existing,
    ...patch,
    milestones: patch.milestones ?? existing.milestones,
    metrics: patch.metrics ? { ...existing.metrics, ...patch.metrics } : existing.metrics,
    updatedAt: Date.now(),
    lastProgressAt: Date.now(),
  };
  await putProject(next);
  return next;
}

export async function linkGoalToProject(
  projectId: string,
  goalId: string,
): Promise<PersistentProject | undefined> {
  const project = await getProject(projectId);
  if (!project) return undefined;
  if (project.linkedGoalIds.includes(goalId)) return project;
  const next: PersistentProject = {
    ...project,
    linkedGoalIds: [...project.linkedGoalIds, goalId],
    updatedAt: Date.now(),
    lastProgressAt: Date.now(),
  };
  await putProject(next);
  return next;
}

export async function linkReminderToProject(
  projectId: string,
  reminderId: string,
): Promise<PersistentProject | undefined> {
  const project = await getProject(projectId);
  if (!project) return undefined;
  if (project.linkedReminderIds.includes(reminderId)) return project;
  const next: PersistentProject = {
    ...project,
    linkedReminderIds: [...project.linkedReminderIds, reminderId],
    updatedAt: Date.now(),
    lastProgressAt: Date.now(),
  };
  await putProject(next);
  return next;
}

export async function addKnowledgeEntry(
  projectId: string,
  entry: Omit<ProjectKnowledgeEntry, 'id' | 'capturedAt'> & {
    id?: string;
    capturedAt?: number;
  },
): Promise<PersistentProject | undefined> {
  const project = await getProject(projectId);
  if (!project) return undefined;
  const knowledge: ProjectKnowledgeEntry = {
    id: entry.id ?? uid('know'),
    url: entry.url,
    title: entry.title,
    summary: entry.summary,
    tags: entry.tags ?? [],
    capturedAt: entry.capturedAt ?? Date.now(),
    source: entry.source,
  };
  const next: PersistentProject = {
    ...project,
    knowledgeEntries: [knowledge, ...project.knowledgeEntries].slice(0, 100),
    updatedAt: Date.now(),
    lastProgressAt: Date.now(),
  };
  await putProject(next);
  return next;
}

/** Progress blurb for “Where am I?” (PRJ-05 / PRJ-GA-03). */
export function formatProjectProgress(project: PersistentProject): string {
  const home = Boolean(project.metrics.homePurchase) || /\b(home|house|mortgage)\b/i.test(project.title);
  if (home && (project.metrics.banksCompared != null || Array.isArray(project.metrics.browseLog))) {
    if (typeof project.metrics.standingSummary === 'string' && project.metrics.standingSummary.trim()) {
      return String(project.metrics.standingSummary);
    }
    return homeStandingSummary(project);
  }
  const byStatus = { done: 0, in_progress: 0, not_started: 0, cancelled: 0 };
  for (const m of project.milestones) byStatus[m.status] += 1;
  const lines = [
    `Where am I on ${project.title}?`, '',
    `Template: ${templateLabel(project.template)} · status: ${project.status}`,
    `Workstreams — done: ${byStatus.done}, in progress: ${byStatus.in_progress}, not started: ${byStatus.not_started}`,
  ];
  if (project.milestones.length) {
    lines.push('', 'Milestones:');
    for (const m of project.milestones.slice(0, 12)) lines.push(`- [${m.status}] ${m.title}`);
  }
  if (project.knowledgeEntries.length) {
    lines.push('', `Knowledge: ${project.knowledgeEntries.length} entr${project.knowledgeEntries.length === 1 ? 'y' : 'ies'}`);
  }
  if (typeof project.metrics.progressReview === 'string') lines.push('', String(project.metrics.progressReview));
  if (typeof project.metrics.coachNudge === 'string') lines.push('', String(project.metrics.coachNudge));
  lines.push('', "Next-week action plan: finish the in-progress workstream, schedule one focused block, and capture one knowledge note.");
  return lines.join('\n');
}
