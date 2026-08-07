/**
 * Template-specific project actions (C1).
 */
import type { PersistentProject } from '@/phil/projectTypes';
import { createReminderFromUi } from '@/phil/clientActions';
import {
  type BrowseLogEntry,
  type JobApplication,
  type JobListingFixture,
  buildEvComparisonTable,
  careerNoProgressNudge,
  careerProgressReview,
  detectResearchConflicts,
  homeNextWeekPlan,
  homeStandingSummary,
  lifePlannerBriefingSlice,
  rankJobListings,
  researchRecommendation,
} from '@/storage/projectPlaybooks';
import {
  addKnowledgeEntry,
  getActiveProject,
  getProject,
  putProject,
  updateProject,
} from '@/storage/projects';

export async function scheduleCareerStudyReminders(projectId: string) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);
  const ids: string[] = [];
  const base = Date.now() + 24 * 60 * 60_000;
  for (let i = 0; i < 3; i++) {
    const rem = await createReminderFromUi({
      text: `Recurring study: Staff Engineer roadmap (${project.title})`,
      when: base + i * 2 * 24 * 60 * 60_000,
      repeat: 'weekdays',
      projectId,
      applyDefaults: false,
    });
    ids.push(rem.id);
  }
  await updateProject(projectId, {
    metrics: { ...project.metrics, studyAskPending: false, studyRemindersScheduled: true },
    statusSummary: `${project.statusSummary ?? ''} Recurring study reminders linked.`,
  });
  return { reminderIds: ids };
}

export async function runCareerCoach(projectId: string, mode: 'no_progress' | 'monthly', now = Date.now()) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);
  if (mode === 'no_progress') {
    const nudge = careerNoProgressNudge(project, now);
    return (await updateProject(projectId, { metrics: { ...project.metrics, coachNudge: nudge }, statusSummary: nudge })) ?? project;
  }
  const review = careerProgressReview(project, now);
  return (await updateProject(projectId, { metrics: { ...project.metrics, progressReview: review }, statusSummary: review })) ?? project;
}

export async function markCareerBrowseRelevant(projectId: string, page: { url: string; title?: string }) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);
  const note = `Relevant to Career Accelerator: ${page.title ?? page.url} — system design / staff-eng content classified as productive toward this project.`;
  await addKnowledgeEntry(projectId, { title: page.title ?? 'Career browse', summary: note, url: page.url, tags: ['browse', 'productive', 'system-design'], source: 'agent' });
  return (await updateProject(projectId, { metrics: { ...project.metrics, browseRelevance: note } })) ?? project;
}

export async function runJobSearch(projectId: string, listings: JobListingFixture[]) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);
  const { topMatches, duplicatesHidden, ranked } = rankJobListings(listings, project.metrics);
  const seen = new Set((project.metrics.seenJobIds as string[] | undefined) ?? []);
  for (const j of ranked) seen.add(j.id);
  const message = [
    'Any new jobs — top matches (duplicates hidden):',
    ...topMatches.map((j, i) => `${i + 1}. ${j.title} @ ${j.company} — ${j.currency === 'EUR' ? '€' : '$'}${Math.round(j.salary / 1000)}k · ${j.location} (${j.reason})`),
    duplicatesHidden ? `Hidden ${duplicatesHidden} duplicate(s) vs previous listings.` : 'No duplicates this run.',
  ].join('\n');
  const next = await updateProject(projectId, {
    metrics: { ...project.metrics, seenJobIds: [...seen], lastJobSearch: { at: Date.now(), topMatches, duplicatesHidden, message } },
    statusSummary: message,
  });
  return { project: next ?? project, message, topMatches, duplicatesHidden };
}

export async function assistJobApplication(projectId: string, job: JobListingFixture) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);
  const stack = (project.metrics.techStack as string[] | undefined) ?? [];
  const salaryOk = job.salary >= Number(project.metrics.salaryTarget ?? 0);
  const remoteOk = String(project.metrics.locationPreference ?? '').toLowerCase().includes('remote') && /remote/i.test(job.location);
  const coverLetterPreview = [`Dear ${job.company} hiring team,`, '', `I'm excited to apply for ${job.title}. My background in ${stack.join(', ') || 'backend'} aligns with this remote role`, salaryOk ? 'and the compensation band matches my €120k+ target.' : 'though compensation may need discussion.', '', 'Best regards'].join('\n');
  const cvNotes = ['CV improvements:', `- Lead with ${stack[0] ?? 'backend'} impact metrics`, remoteOk ? '- Emphasize remote collaboration experience' : '- Clarify location preference', '- Add a Staff/senior scope bullet matching the JD'].join('\n');
  const app: JobApplication = { jobId: job.id, title: job.title, company: job.company, status: 'drafted', coverLetterPreview, cvNotes, updatedAt: Date.now() };
  const apps = [...((project.metrics.applications as JobApplication[] | undefined) ?? [])];
  const idx = apps.findIndex((a) => a.jobId === job.id);
  if (idx >= 0) apps[idx] = app; else apps.push(app);
  const message = [`Application assistance for ${job.title} @ ${job.company}`, `Fit: salary ${salaryOk ? 'ok' : 'stretch'}, remote ${remoteOk ? 'ok' : 'check'}.`, cvNotes, '', 'Cover letter preview:', coverLetterPreview, '', 'Application status: drafted (saved → drafted → applied → follow-up).'].join('\n');
  const next = await updateProject(projectId, { metrics: { ...project.metrics, applications: apps }, statusSummary: message });
  return { project: next ?? project, message };
}

export async function captureResearchPages(projectId: string, pages: Array<{ url: string; title: string; summary: string; tags?: string[] }>) {
  let project = await getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);
  const existingTitles = new Set(project.knowledgeEntries.map((k) => k.title.toLowerCase()));
  for (const page of pages) {
    if (existingTitles.has(page.title.toLowerCase())) continue;
    project = (await addKnowledgeEntry(projectId, { title: page.title, summary: page.summary, url: page.url, tags: page.tags ?? ['research', 'ev'], source: 'browse' })) ?? project;
    existingTitles.add(page.title.toLowerCase());
  }
  project = (await getProject(projectId))!;
  const conflicts = detectResearchConflicts(project.knowledgeEntries);
  const comparisonTable = buildEvComparisonTable(project.knowledgeEntries);
  return (await updateProject(projectId, {
    metrics: { ...project.metrics, conflicts, comparisonTable, lastCaptureNote: 'Saved to project with comparison table; conflicting claims detected.' },
    statusSummary: `Research updated — comparison table ready; ${conflicts.length ? 'conflicting claims noted' : 'no conflicts yet'}.`,
  })) ?? project;
}

export async function buildResearchRecommendation(projectId: string) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);
  const text = researchRecommendation(project);
  await updateProject(projectId, { metrics: { ...project.metrics, recommendation: text }, statusSummary: text.split('\n')[0] ?? text });
  return text;
}

export async function associateBrowseVisits(projectId: string, visits: Array<{ url: string; title: string; tags?: string[] }>, opts?: { silent?: boolean }) {
  const { getSettings } = await import('@/storage/db');
  const settings = await getSettings();
  const project = await getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);
  if (settings.projectBrowseCaptureEnabled === false) {
    return project;
  }
  const silent = opts?.silent !== false;
  const log = [...((project.metrics.browseLog as BrowseLogEntry[] | undefined) ?? [])];
  const now = Date.now();
  for (const v of visits) {
    log.push({ url: v.url, title: v.title, associatedAt: now, silent, tags: v.tags });
    await addKnowledgeEntry(projectId, { title: `Browse: ${v.title}`, summary: `Silent knowledge candidate from ${v.url}`, url: v.url, tags: ['browse-log', 'knowledge-candidate', ...(v.tags ?? [])], source: 'browse' });
  }
  let banksCompared = Number(project.metrics.banksCompared ?? 0);
  let apartmentsViewed = Number(project.metrics.apartmentsViewed ?? 0);
  let apartmentsShortlisted = Number(project.metrics.apartmentsShortlisted ?? 0);
  let taxesEstimated = Boolean(project.metrics.taxesEstimated);
  let insuranceResearched = Boolean(project.metrics.insuranceResearched);
  let lawyerSelected = Boolean(project.metrics.lawyerSelected);
  for (const v of visits) {
    const blob = `${v.url} ${v.title}`.toLowerCase();
    if (/mortgage|bank/.test(blob)) banksCompared += 1;
    if (/apartment|listing|zillow|idealista/.test(blob)) apartmentsViewed += 1;
    if (/shortlist/.test(blob)) apartmentsShortlisted += 1;
    if (/tax/.test(blob)) taxesEstimated = true;
    if (/insurance/.test(blob)) insuranceResearched = true;
    if (/lawyer|attorney|solicitor/.test(blob)) lawyerSelected = true;
  }
  const patch = { ...project.metrics, browseLog: log, banksCompared, apartmentsViewed, apartmentsShortlisted, taxesEstimated, insuranceResearched, lawyerSelected, silentCapture: true };
  const standing = homeStandingSummary({ ...project, metrics: patch });
  return (await updateProject(projectId, {
    metrics: { ...patch, standingSummary: standing },
    statusSummary: silent ? 'Silent browse log updated (knowledge candidates; no notification storm).' : standing,
  })) ?? project;
}

export async function seedHomeStanding(projectId: string, seed: Record<string, unknown>) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);
  const metrics = { ...project.metrics, ...seed };
  const standing = homeStandingSummary({ ...project, metrics });
  return (await updateProject(projectId, { metrics: { ...metrics, standingSummary: standing }, statusSummary: standing })) ?? project;
}

export async function acceptHomeNextWeekPlan(projectId: string) {
  const project = await getProject(projectId);
  if (!project) throw new Error(`No project ${projectId}`);
  const plan = homeNextWeekPlan(project);
  await updateProject(projectId, { metrics: { ...project.metrics, nextWeekPlan: plan }, statusSummary: plan });
  await addKnowledgeEntry(projectId, { title: "Next week's action plan", summary: plan, tags: ['plan', 'next-week'], source: 'agent' });
  return plan;
}

export async function lifePlannerBriefingForActive() {
  const project = await getActiveProject();
  if (!project || project.template !== 'life_move' || project.metrics.homePurchase) return null;
  return lifePlannerBriefingSlice(project);
}

export async function replaceProject(project: PersistentProject) {
  await putProject(project);
}
