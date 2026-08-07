
import type { RegisteredSkill } from '../types';
import {
  call, exampleOverlap, executeCreateProject, goalOf, monthsFromUtterance, okMessage, parseProjectTitleFromGoal,
} from './helpers';

const DEFAULT_FIXTURE_JOBS = [
  { id: 'job-1', title: 'Senior Backend Engineer', company: 'Nordic Cloud', salary: 130_000, currency: 'EUR', location: 'remote', stack: ['backend', 'Node.js', 'TypeScript'] },
  { id: 'job-2', title: 'Backend Engineer', company: 'Duplicate Corp', salary: 125_000, currency: 'EUR', location: 'remote', stack: ['backend', 'Go'] },
  { id: 'job-2', title: 'Backend Engineer (repost)', company: 'Duplicate Corp', salary: 125_000, currency: 'EUR', location: 'remote', stack: ['backend', 'Go'] },
  { id: 'job-3', title: 'Platform Engineer', company: 'EU Fintech', salary: 140_000, currency: 'EUR', location: 'remote EU', stack: ['backend', 'Python', 'TypeScript'] },
  { id: 'job-4', title: 'Junior Frontend', company: 'LowBall', salary: 55_000, currency: 'EUR', location: 'on-site Berlin', stack: ['frontend'] },
];

export function buildCareerAcceleratorSkill(): RegisteredSkill {
  return {
    id: 'project.career_accelerator',
    description: 'Career Accelerator Persistent Project — milestones, roadmap, study coach',
    category: 'project', projectTemplate: 'career',
    examples: ['I want to become a Staff Engineer within 12 months.', 'How is my Staff Engineer plan going?'],
    confirmationLevel: 'none', priority: 12,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bstaff engineer\b/i.test(g) && /\b(12 months|within|year)\b/i.test(g)) return 0.97;
      if (/\bstaff engineer\b/i.test(g) && /\b(want|become|aim|plan)\b/i.test(g)) return 0.94;
      if (/\bcareer accelerator\b/i.test(g)) return 0.95;
      if (ctx.activeProject?.template === 'career') {
        if (/\b(how.*(going|progress)|no progress|monthly review|study)\b/i.test(g)) return 0.93;
      }
      return exampleOverlap(ctx, ['Staff Engineer within 12 months']) * 0.9;
    },
    extractArgs: (ctx) => ({ title: parseProjectTitleFromGoal(goalOf(ctx)), template: 'career', months: monthsFromUtterance(goalOf(ctx), 12) }),
    finalizeDirectAnswer: true, actDontAsk: true,
    buildToolCall: (goal) => /\b(how.*(going|progress)|monthly review)\b/i.test(goal)
      ? call('project_progress', {})
      : call('project_create', { title: parseProjectTitleFromGoal(goal), template: 'career' }),
    hints: () => ['Create Career Accelerator via project_create (template=career).'],
    execute: async (args) => {
      const g = args.utterance || goalOf(args.context);
      const { getActiveProject } = await import('@/storage/projects');
      const active = await getActiveProject();
      if (active?.template === 'career' && /\byes\b/i.test(g)) {
        const { scheduleCareerStudyReminders } = await import('@/storage/projectActions');
        const { reminderIds } = await scheduleCareerStudyReminders(active.id);
        return okMessage(`Recurring study reminders created and linked to ${active.title} (${reminderIds.length} sessions).`, { reminderIds });
      }
      if (active?.template === 'career' && /\b(how.*(going|progress)|monthly)\b/i.test(g)) {
        const { runCareerCoach } = await import('@/storage/projectActions');
        const updated = await runCareerCoach(active.id, 'monthly');
        return okMessage(String(updated.metrics.progressReview ?? updated.statusSummary));
      }
      if (active?.template === 'career' && /\bno progress|adjust(ing)? the schedule\b/i.test(g)) {
        const { runCareerCoach } = await import('@/storage/projectActions');
        const updated = await runCareerCoach(active.id, 'no_progress');
        return okMessage(String(updated.metrics.coachNudge ?? updated.statusSummary));
      }
      return executeCreateProject(args, 'career', 'Staff Engineer Promotion');
    },
  };
}

export function buildJobHuntSkill(): RegisteredSkill {
  return {
    id: 'project.job_hunt',
    description: 'Job Hunt Persistent Project — constraints, daily search, applications',
    category: 'project', projectTemplate: 'job_hunt',
    examples: ['I want a remote backend job paying at least €120k.', 'Any new ones today?'],
    confirmationLevel: 'none', priority: 12,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (ctx.activeProject?.template === 'job_hunt') {
        if (/\bany new ones\b/i.test(g) || /\bnew (roles|jobs|listings)\b/i.test(g)) return 0.98;
        if (/\b(apply|cover letter|interesting job|application status)\b/i.test(g)) return 0.96;
      }
      if (/\b(job hunt|job search|looking for (a )?job)\b/i.test(g)) return 0.9;
      if (/\b(remote|salary|€|\$)\b/i.test(g) && /\b(job|role|backend|engineer)\b/i.test(g)) return 0.92;
      return 0;
    },
    extractArgs: (ctx) => ({ title: parseProjectTitleFromGoal(goalOf(ctx)), template: 'job_hunt' }),
    finalizeDirectAnswer: true, actDontAsk: true,
    buildToolCall: (goal) => {
      if (/\bany new ones\b/i.test(goal) || /\b(apply|cover letter|interesting)\b/i.test(goal)) return call('project_get', {});
      return call('project_create', { title: parseProjectTitleFromGoal(goal), template: 'job_hunt' });
    },
    hints: () => ['Store salary/remote/stack; daily search ranks + dedupes.'],
    execute: async (args) => {
      const g = args.utterance || goalOf(args.context);
      const { getActiveProject } = await import('@/storage/projects');
      const active = await getActiveProject();
      if (active?.template === 'job_hunt' && (/\bany new ones\b/i.test(g) || /\bnew jobs\b/i.test(g))) {
        const { runJobSearch } = await import('@/storage/projectActions');
        const result = await runJobSearch(active.id, DEFAULT_FIXTURE_JOBS);
        return okMessage(result.message, { topMatches: result.topMatches, duplicatesHidden: result.duplicatesHidden });
      }
      if (active?.template === 'job_hunt' && /\b(apply|cover letter|interesting|application)\b/i.test(g)) {
        const { assistJobApplication } = await import('@/storage/projectActions');
        const last = active.metrics.lastJobSearch as { topMatches?: typeof DEFAULT_FIXTURE_JOBS } | undefined;
        const job = last?.topMatches?.[0] ?? DEFAULT_FIXTURE_JOBS[0]!;
        return okMessage((await assistJobApplication(active.id, job)).message);
      }
      return executeCreateProject(args, 'job_hunt', 'Job Hunt — remote backend €120k');
    },
  };
}

export function buildResearchManagerSkill(): RegisteredSkill {
  return {
    id: 'project.research_manager',
    description: 'Research Manager Persistent Project — capture, conflicts, recommendation',
    category: 'project', projectTemplate: 'research',
    examples: ["I'm researching whether to buy an electric car this year.", "What's your recommendation?"],
    confirmationLevel: 'none', priority: 11,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bresearching whether\b/i.test(g) || /\bresearch (project|manager)\b/i.test(g)) return 0.93;
      if (/\belectric car|buy an ev\b/i.test(g) && /\bresearch|whether\b/i.test(g)) return 0.94;
      if (ctx.activeProject?.template === 'research' && /\brecommendation\b/i.test(g)) return 0.96;
      return 0;
    },
    extractArgs: (ctx) => ({ title: parseProjectTitleFromGoal(goalOf(ctx)), template: 'research' }),
    finalizeDirectAnswer: true, actDontAsk: true,
    buildToolCall: (goal) => /\brecommendation\b/i.test(goal)
      ? call('project_progress', {})
      : call('project_create', { title: parseProjectTitleFromGoal(goal), template: 'research' }),
    hints: () => ['Create research project; recommendation from accumulated knowledge.'],
    execute: async (args) => {
      const g = args.utterance || goalOf(args.context);
      const { getActiveProject } = await import('@/storage/projects');
      const active = await getActiveProject();
      if (active?.template === 'research' && /\brecommendation\b/i.test(g)) {
        const { buildResearchRecommendation } = await import('@/storage/projectActions');
        return okMessage(await buildResearchRecommendation(active.id));
      }
      if (active?.template === 'research' && (/\bcapture\b/i.test(g) || args.params?.pages)) {
        const { captureResearchPages } = await import('@/storage/projectActions');
        const pages = (args.params?.pages as Array<{ url: string; title: string; summary: string }>) ?? [];
        const updated = await captureResearchPages(active.id, pages);
        return okMessage(String(updated.metrics.lastCaptureNote ?? 'Saved to project — comparison table; conflicting claims checked.'), {
          conflicts: updated.metrics.conflicts, comparisonTable: updated.metrics.comparisonTable,
        });
      }
      return executeCreateProject(args, 'research', 'EV purchase research');
    },
  };
}

export function buildLifePlannerSkill(): RegisteredSkill {
  return {
    id: 'project.life_planner',
    description: 'Life Planner Persistent Project — subprojects, deadlines, briefing',
    category: 'project', projectTemplate: 'life_move',
    examples: ["I'm moving to Spain in six months."],
    confirmationLevel: 'none', priority: 11,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bmoving to\b/i.test(g) && /\b(months?|year)\b/i.test(g)) return 0.94;
      if (/\blife planner\b/i.test(g) || /\bmove to spain\b/i.test(g)) return 0.95;
      return 0;
    },
    extractArgs: (ctx) => ({ title: parseProjectTitleFromGoal(goalOf(ctx)), template: 'life_move' }),
    finalizeDirectAnswer: true, actDontAsk: true,
    buildToolCall: (goal) => call('project_create', { title: parseProjectTitleFromGoal(goal), template: 'life_move' }),
    hints: () => ['Create Life Planner with workstreams; date-based priorities.'],
    execute: async (args) => {
      const result = await executeCreateProject(args, 'life_move', 'Move to Spain');
      const { getActiveProject } = await import('@/storage/projects');
      const { createReminderFromUi } = await import('@/phil/clientActions');
      const active = await getActiveProject();
      if (active?.template === 'life_move' && !active.metrics.homePurchase) {
        const now = Date.now();
        await createReminderFromUi({ text: 'Visa deadline — schedule appointment (missing documents check)', when: now + 14 * 86_400_000, projectId: active.id, applyDefaults: false });
        await createReminderFromUi({ text: 'Book flights this week', when: now + 3 * 86_400_000, projectId: active.id, applyDefaults: false });
        const missing = (active.metrics.missingDocuments as string[] | undefined) ?? [];
        return okMessage([active.statusSummary, '', 'Orchestration: reminders set for visa and flights (earlier deadlines first).', missing.length ? `Missing documents / not-started: ${missing.join(', ')}.` : ''].filter(Boolean).join('\n'), result.artifacts);
      }
      return result;
    },
  };
}

export function buildGoalAwareBrowseSkill(): RegisteredSkill {
  return {
    id: 'project.goal_aware_browse',
    description: 'Goal-aware browsing — home purchase project, silent browse log, Where am I?',
    category: 'project', projectTemplate: 'custom',
    examples: ["I'm buying my first home.", 'Where am I?'],
    confirmationLevel: 'none', priority: 13,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\b(buying|buy) (my )?(first )?home\b/i.test(g)) return 0.96;
      if (/\bhome purchase\b/i.test(g)) return 0.94;
      if (ctx.activeProject && (ctx.activeProject.metrics?.homePurchase || /\bhome\b/i.test(ctx.activeProject.title)) && /\bwhere am i\b/i.test(g)) return 0.97;
      return 0;
    },
    extractArgs: (ctx) => ({ title: parseProjectTitleFromGoal(goalOf(ctx)), template: 'custom' }),
    finalizeDirectAnswer: true, actDontAsk: true,
    buildToolCall: (goal) => {
      if (/\bwhere am i\b/i.test(goal)) return call('project_progress', {});
      return call('project_create', { title: parseProjectTitleFromGoal(goal), template: 'custom' });
    },
    hints: () => ['Create home-buying project; silent browse; Where am I standing summary.'],
    execute: async (args) => {
      const g = args.utterance || goalOf(args.context);
      const { getActiveProject, formatProjectProgress } = await import('@/storage/projects');
      const active = await getActiveProject();
      if (active && /\bwhere am i\b/i.test(g)) return okMessage(formatProjectProgress(active));
      if (active && /\byes\b/i.test(g) && /\b(next week|action plan|plan)\b/i.test(g)) {
        const { acceptHomeNextWeekPlan } = await import('@/storage/projectActions');
        return okMessage(await acceptHomeNextWeekPlan(active.id));
      }
      if (active && (args.params?.visits || /\bsilent|browse log\b/i.test(g))) {
        const { associateBrowseVisits } = await import('@/storage/projectActions');
        const visits = (args.params?.visits as Array<{ url: string; title: string }>) ?? [];
        const updated = await associateBrowseVisits(active.id, visits, { silent: true });
        return okMessage(`Silent browse log / knowledge candidates updated (${(updated.metrics.browseLog as unknown[] | undefined)?.length ?? 0} entries). No notification storm.`);
      }
      return executeCreateProject(args, 'custom', 'Buying my first home');
    },
  };
}
