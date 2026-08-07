/**
 * Morning briefing + evening recap compose (DAY-*, PRJ-EA, WF-19).
 * Template-based so Today works without the model.
 */
import type { FocusCategory, Goal, MorningBriefing } from '@/phil/types';
import {
  listGoals,
  listReminders,
  listTabActivitySince,
  localDateKey,
  startOfLocalDay,
  uid,
} from '@/storage/phil';
import { getActiveProject } from '@/storage/projects';

export type FocusSummary = {
  byCategory: Record<FocusCategory, number>;
  byDomain: Array<{ domain: string; ms: number; category: FocusCategory }>;
  totalMs: number;
};

async function focusSummaryToday(): Promise<FocusSummary> {
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

function mins(ms: number): number {
  return Math.round(ms / 60_000);
}

function formatClock(when: number): string {
  return new Date(when).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Goal-relative productive ms: dwell on allowedDomains, else category=productive. */
export async function goalRelativeFocus(focus?: FocusSummary): Promise<{
  towardGoalsMs: number;
  leisureMs: number;
  productiveMs: number;
  neutralMs: number;
  blockedMs: number;
  totalMs: number;
  topLeisureDomain?: string;
  insight: string;
}> {
  const summary = focus ?? (await focusSummaryToday());
  const goals = (await listGoals()).filter((g) => g.status === 'active');
  const since = startOfLocalDay();
  const sessions = await listTabActivitySince(since);

  let towardGoalsMs = 0;
  if (goals.some((g) => g.allowedDomains.length > 0)) {
    for (const s of sessions) {
      const hit = goals.some((g) =>
        g.allowedDomains.some((d) => s.domain === d || s.domain.endsWith(`.${d}`)),
      );
      if (hit) towardGoalsMs += s.ms;
    }
  } else {
    towardGoalsMs = summary.byCategory.productive;
  }

  const leisureMs = summary.byCategory.leisure + summary.byCategory.blocked;
  const topLeisure = summary.byDomain.find(
    (d) => d.category === 'leisure' || d.category === 'blocked',
  );

  let insight =
    'Keep logging browsing — I’ll turn time into actionable insight toward your goals.';
  if (summary.totalMs > 0) {
    const towardPct = Math.round((towardGoalsMs / Math.max(1, summary.totalMs)) * 100);
    if (towardGoalsMs >= leisureMs) {
      insight = `Solid day so far: ~${towardPct}% of browsing is toward goals. Protect a focus block for your top priority.`;
    } else {
      insight = `Leisure is outpacing goal-aligned time. Cut back on ${topLeisure?.domain ?? 'leisure sites'} and return to your active goal.`;
    }
  }

  return {
    towardGoalsMs,
    leisureMs,
    productiveMs: summary.byCategory.productive,
    neutralMs: summary.byCategory.neutral,
    blockedMs: summary.byCategory.blocked,
    totalMs: summary.totalMs,
    topLeisureDomain: topLeisure?.domain,
    insight,
  };
}

export function suggestPriorities(input: {
  goals: Goal[];
  reminderTexts: string[];
  projectTitle?: string;
  milestoneTitle?: string;
}): string[] {
  const out: string[] = [];
  if (input.milestoneTitle && input.projectTitle) {
    out.push(`Advance “${input.milestoneTitle}” on ${input.projectTitle}`);
  } else if (input.projectTitle) {
    out.push(`Make progress on ${input.projectTitle}`);
  }
  for (const g of input.goals.slice(0, 3)) {
    if (out.length >= 3) break;
    out.push(`Work on: ${g.title}`);
  }
  for (const r of input.reminderTexts.slice(0, 2)) {
    if (out.length >= 3) break;
    out.push(`Handle reminder: ${r}`);
  }
  if (!out.length) out.push('Tell Phil what you want to finish today');
  return out.slice(0, 3);
}

export type ComposedBriefing = {
  content: string;
  sources: MorningBriefing['sources'];
};

export async function composeBriefingContent(): Promise<ComposedBriefing> {
  const reminders = (await listReminders()).filter(
    (r) => r.status === 'scheduled' && r.when >= startOfLocalDay(),
  );
  const goals = await listGoals();
  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedToday = goals.filter(
    (g) => g.status === 'completed' && g.updatedAt >= startOfLocalDay(),
  );
  const focus = await focusSummaryToday();
  const relative = await goalRelativeFocus(focus);
  const activeProject = await getActiveProject();

  const todayMilestone = activeProject?.milestones.find(
    (m) => m.status === 'in_progress' || m.status === 'not_started',
  );
  const priorities = suggestPriorities({
    goals: activeGoals,
    reminderTexts: reminders.map((r) => r.text),
    projectTitle: activeProject?.status === 'active' ? activeProject.title : undefined,
    milestoneTitle: todayMilestone?.title,
  });

  const lines: string[] = ['Good morning — here’s what’s up today.', ''];

  if (activeProject && activeProject.status === 'active') {
    lines.push('**Active project**');
    lines.push(
      `- ${activeProject.title} (${activeProject.template})${
        todayMilestone ? ` — today’s focus: ${todayMilestone.title}` : ''
      }`,
    );
    if (activeProject.template === 'career') {
      const study =
        typeof activeProject.metrics.todayStudyTask === 'string'
          ? activeProject.metrics.todayStudyTask
          : 'Study task: system design practice';
      lines.push(`- ${study}`);
      if (activeProject.metrics.browseRelevance) {
        lines.push('- System design browse classified as productive toward this project');
      }
    }
    if (activeProject.template === 'life_move' && !activeProject.metrics.homePurchase) {
      const items = (activeProject.metrics.briefingItems as string[] | undefined) ?? [
        'Book flights this week',
        'Schedule visa appointment within two weeks',
        'Electricity providers not researched yet',
      ];
      lines.push('**Life Planner**');
      for (const item of items) lines.push(`- ${item}`);
    }
    if (activeProject.template === 'job_hunt') {
      const last = activeProject.metrics.lastJobSearch as { message?: string } | undefined;
      if (last?.message) {
        lines.push('**Job hunt — top matches**');
        for (const line of last.message.split('\n').slice(0, 5)) lines.push(line);
      }
    }
    if (activeProject.template === 'exec_day') {
      lines.push('- Exec day mode: I’ll help you stay productive today with light nudges.');
    }
    lines.push('');
  } else {
    lines.push('No active project yet — open Projects to start a long-horizon plan.');
    lines.push('');
  }

  lines.push("**Today’s plan**");
  for (const p of priorities) lines.push(`- ${p}`);
  lines.push('');

  if (activeGoals.length) {
    lines.push('**Active goals**');
    for (const g of activeGoals) lines.push(`- ${g.title}`);
    lines.push('');
  } else {
    lines.push('No active goals yet. Tell Phil what you want to finish today.');
    lines.push('');
  }

  if (completedToday.length) {
    lines.push('**Goals completed**');
    for (const g of completedToday) lines.push(`- ${g.title}`);
    lines.push('');
  } else {
    lines.push('**Goals completed** — none yet today.');
    lines.push('');
  }

  if (reminders.length) {
    lines.push('**Reminders**');
    for (const r of reminders.slice(0, 8)) {
      lines.push(`- ${formatClock(r.when)} — ${r.text}`);
    }
    lines.push('');
  } else {
    lines.push('No reminders scheduled for later today.');
    lines.push('');
  }

  lines.push('**Suggested priorities**');
  for (const p of priorities) lines.push(`- ${p}`);
  lines.push('');

  lines.push('**Focus so far**');
  lines.push(
    `- Toward goals: ${mins(relative.towardGoalsMs)}m · Leisure: ${mins(relative.leisureMs)}m · Other: ${mins(relative.neutralMs)}m`,
  );
  lines.push(
    `- Productive: ${mins(focus.byCategory.productive)}m · Leisure: ${mins(focus.byCategory.leisure)}m · Other: ${mins(focus.byCategory.neutral + focus.byCategory.blocked)}m`,
  );
  if (focus.byDomain[0]) {
    lines.push(
      `- Top site: ${focus.byDomain[0].domain} (${mins(focus.byDomain[0].ms)}m, ${focus.byDomain[0].category})`,
    );
  }
  lines.push(`- ${relative.insight}`);

  return {
    content: lines.join('\n'),
    sources: {
      reminderCount: reminders.length,
      activeGoalCount: activeGoals.length,
      completedGoalCount: completedToday.length,
      focusMs: { ...focus.byCategory },
      towardGoalsMs: relative.towardGoalsMs,
      suggestedPriorities: priorities,
    },
  };
}

export async function composeEveningRecap(): Promise<ComposedBriefing> {
  const reminders = await listReminders();
  const firedOrDone = reminders.filter(
    (r) =>
      (r.status === 'fired' || r.status === 'done') && r.updatedAt >= startOfLocalDay(),
  );
  const stillOpen = reminders.filter(
    (r) => r.status === 'scheduled' && r.when >= startOfLocalDay(),
  );
  const goals = await listGoals();
  const activeGoals = goals.filter((g) => g.status === 'active');
  const completedToday = goals.filter(
    (g) => g.status === 'completed' && g.updatedAt >= startOfLocalDay(),
  );
  const focus = await focusSummaryToday();
  const relative = await goalRelativeFocus(focus);
  const activeProject = await getActiveProject();
  const tomorrowPriorities = suggestPriorities({
    goals: activeGoals,
    reminderTexts: stillOpen.map((r) => r.text),
    projectTitle: activeProject?.status === 'active' ? activeProject.title : undefined,
  });

  const lines: string[] = [
    'Evening recap — here’s your evening summary.',
    '',
    '**Work completed**',
  ];

  if (completedToday.length) {
    for (const g of completedToday) lines.push(`- Completed goal: ${g.title}`);
  } else {
    lines.push('- No goals marked completed today.');
  }
  if (firedOrDone.length) {
    for (const r of firedOrDone.slice(0, 6)) lines.push(`- Reminder done: ${r.text}`);
  }
  if (activeProject?.status === 'active') {
    lines.push(
      `- Project advanced: ${activeProject.title}${
        activeProject.statusSummary ? ` — ${activeProject.statusSummary}` : ''
      }`,
    );
  }
  lines.push('');

  lines.push('**Time spent**');
  lines.push(
    `- Toward goals: ${mins(relative.towardGoalsMs)}m · Leisure / entertainment: ${mins(relative.leisureMs)}m`,
  );
  lines.push(
    `- Productive: ${mins(focus.byCategory.productive)}m · Neutral: ${mins(focus.byCategory.neutral)}m · Blocked: ${mins(focus.byCategory.blocked)}m`,
  );
  lines.push('');

  lines.push('**Biggest distractions**');
  const distractions = focus.byDomain
    .filter((d) => d.category === 'leisure' || d.category === 'blocked')
    .slice(0, 3);
  if (distractions.length) {
    for (const d of distractions) lines.push(`- ${d.domain} (${mins(d.ms)}m)`);
  } else {
    lines.push('- No major leisure distractions logged.');
  }
  lines.push('');

  lines.push('**Suggested priorities for tomorrow**');
  for (const p of tomorrowPriorities) lines.push(`- ${p}`);
  lines.push('');
  lines.push(`**Actionable insight** — ${relative.insight}`);

  return {
    content: lines.join('\n'),
    sources: {
      reminderCount: stillOpen.length,
      activeGoalCount: activeGoals.length,
      completedGoalCount: completedToday.length,
      focusMs: { ...focus.byCategory },
      towardGoalsMs: relative.towardGoalsMs,
      suggestedPriorities: tomorrowPriorities,
    },
  };
}

export async function buildEveningBriefingRecord(): Promise<MorningBriefing> {
  const composed = await composeEveningRecap();
  return {
    id: uid('erecap'),
    dateKey: localDateKey(),
    kind: 'evening',
    content: composed.content,
    createdAt: Date.now(),
    sources: composed.sources,
  };
}

export async function buildMorningBriefingRecord(): Promise<MorningBriefing> {
  const composed = await composeBriefingContent();
  return {
    id: uid('brief'),
    dateKey: localDateKey(),
    kind: 'morning',
    content: composed.content,
    createdAt: Date.now(),
    sources: composed.sources,
  };
}
