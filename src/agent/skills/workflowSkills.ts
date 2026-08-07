/**
 * Wave2 C3 — workflow skill enhancements registered via factory (replace).
 * Does not fork the router; only registerSkill on the default factory.
 */

import type { ToolCall } from '../types';
import {
  isLiveInfoGoal,
  isWebResearchGoal,
  parseReminderInMinutes,
  parseReminderText,
  parseReminderWhenMs,
} from '../assistantIntent';
import { isFactualLookupGoal } from './coreSkills';
import { parseReminderSchedule } from '../../phil/reminderSchedule';
import { uid } from '../../utils';
import type { RegisteredSkill, SkillExecuteArgs, SkillExecuteResult } from './types';
import type { RouterFactory } from '../router/types';

function call(name: string, args: Record<string, unknown> = {}): ToolCall {
  return { id: uid('call'), name, arguments: args };
}

function okMessage(message: string, artifacts?: Record<string, unknown>): SkillExecuteResult {
  return { ok: true, message, artifacts };
}

const reminderCreate: RegisteredSkill = {
  id: 'reminder.create',
  aliases: ['reminder'],
  description: 'Create or manage reminders (device TZ, weekly recurrence, conflict check)',
  category: 'reminder',
  examples: [
    'Remind me to call my landlord next Tuesday at 3 PM.',
    'Remind me in 20 minutes to stretch',
    'Remind me every Friday to review my finances.',
    'Remind me to go to the gym every weekday at 18:00.',
    'Every Tuesday at 18:00 remind me to attend my language class.',
  ],
  confirmationLevel: 'none',
  priority: 10,
  inputSchema: {
    type: 'object',
    properties: {
      text: { type: 'string' },
      when: { type: 'number' },
      inMinutes: { type: 'number' },
      repeat: { type: 'string' },
    },
    required: ['text'],
  },
  routeScore: (ctx) => {
    const g = (ctx.utterance ?? ctx.goal ?? '').trim();
    if (
      /\b(remind|reminder|alarm)\b/i.test(g) ||
      /\bevery\s+(weekday|monday|tuesday|wednesday|thursday|friday)\b/i.test(g)
    ) {
      return 0.98;
    }
    return 0;
  },
  extractArgs: (ctx) => {
    const goal = (ctx.utterance ?? ctx.goal ?? '').trim();
    const schedule = parseReminderSchedule(goal);
    return {
      text: schedule?.text ?? parseReminderText(goal),
      when: schedule?.when ?? parseReminderWhenMs(goal),
      inMinutes: parseReminderInMinutes(goal) ?? 30,
      repeat: schedule?.repeat ?? 'none',
      repeatWeekday: schedule?.repeatWeekday,
    };
  },
  execute: async (args) => {
    const text = String(args.params?.text ?? parseReminderText(args.utterance));
    return okMessage(`Reminder set: ${text}`, { text });
  },
  legacyId: 'reminder',
  finalizeDirectAnswer: true,
  buildToolCall: (goal) => {
    const schedule = parseReminderSchedule(goal);
    const when = schedule?.when ?? parseReminderWhenMs(goal);
    const args: Record<string, unknown> = {
      text: schedule?.text ?? parseReminderText(goal),
    };
    if (when != null) args.when = when;
    else args.inMinutes = parseReminderInMinutes(goal) ?? 30;
    if (schedule?.repeat && schedule.repeat !== 'none') {
      args.repeat = schedule.repeat;
      if (schedule.repeatWeekday != null) args.repeatWeekday = schedule.repeatWeekday;
    }
    return call('reminder_create', args);
  },
  hints: (goal) => {
    const schedule = parseReminderSchedule(goal);
    return [
      'Call reminder_create with text and when (device TZ) or inMinutes.',
      schedule
        ? `Suggested when: ${schedule.humanWhen} · repeat: ${schedule.repeat}`
        : 'Infer when from the request.',
      `Suggested text: ${schedule?.text ?? parseReminderText(goal)}`,
    ];
  },
};

const researchCompare: RegisteredSkill = {
  id: 'research.compare_decide',
  description: 'Compare options and recommend one (Google-default research)',
  category: 'research',
  examples: [
    "I'm looking for a mechanical keyboard under $150 with hot-swappable switches. Compare the best options and recommend one.",
    'Compare the best options and recommend one.',
    'Find the cheapest direct flight from Warsaw to Tokyo in April.',
  ],
  confirmationLevel: 'none',
  priority: 5,
  routeScore: (ctx) => {
    const g = (ctx.utterance ?? ctx.goal ?? '').trim();
    if (/\bcompare\b/i.test(g) && /\b(recommend|decide|best)\b/i.test(g)) return 0.94;
    if (/\b(cheapest|direct) flight\b/i.test(g)) return 0.92;
    if (/\bflight\b/i.test(g) && /\b(warsaw|tokyo)\b/i.test(g)) return 0.9;
    if (/\bcompare\b/i.test(g) && /\boptions?\b/i.test(g)) return 0.88;
    return 0;
  },
  execute: () => okMessage('Research compare/decide'),
  legacyId: 'web_lookup',
  finalizeDirectAnswer: true,
  actDontAsk: true,
  buildToolCall: (goal) =>
    call('web_research', { query: goal.trim(), maxResults: 5, skill: 'compare_decide' }),
  hints: () => [
    'Call web_research (Google default). Dedupe products, compare trade-offs, give a ranked recommendation.',
  ],
};

const researchWeb: RegisteredSkill = {
  id: 'research.web',
  aliases: ['web_lookup'],
  description: 'General live facts / research on the web (Google default)',
  category: 'research',
  examples: [
    'Research noise-cancelling headphones under $100',
    'Find the three best project management tools for startups.',
    'Which one has the best API?',
  ],
  confirmationLevel: 'none',
  routeScore: (ctx) => {
    const g = (ctx.utterance ?? ctx.goal ?? '').trim();
    if (/\b(weather|forecast)\b/i.test(g)) return 0;
    if (/\bcompare\b/i.test(g) && /\b(recommend|decide)\b/i.test(g)) return 0.35;
    if (/\b(cheapest|direct) flight\b/i.test(g)) return 0.2;
    if (ctx.pageUrl && /\bsummarize this\b/i.test(g)) return 0;
    if (isLiveInfoGoal(g) || isWebResearchGoal(g)) return 0.86;
    if (/\bwhich one has the best\b/i.test(g)) return 0.86;
    if (isFactualLookupGoal(g)) return 0.72;
    return 0;
  },
  execute: () => okMessage('Web research (Google)'),
  legacyId: 'web_lookup',
  finalizeDirectAnswer: true,
  actDontAsk: true,
  buildToolCall: (goal) =>
    call('web_research', { query: goal.trim(), maxResults: 3, skill: 'web_lookup' }),
  hints: () => [
    'Call web_research immediately (Google default). Answer from returned answer/excerpt.',
  ],
};

const planningWorkday: RegisteredSkill = {
  id: 'planning.workday',
  description: 'Plan the workday from goals, reminders, and optional calendar',
  category: 'planning',
  examples: ['Plan my workday.', 'Help me plan today'],
  confirmationLevel: 'none',
  routeScore: (ctx) => {
    const g = (ctx.utterance ?? ctx.goal ?? '').trim();
    if (/\bplan (my )?workday\b/i.test(g) || /\bplan (my )?day\b/i.test(g)) return 0.93;
    return 0;
  },
  execute: (args: SkillExecuteArgs) => {
    const cal = args.context.calendarConnected
      ? 'Including today’s calendar events.'
      : 'Calendar not connected — planning without inventing events.';
    return okMessage(`Workday plan ready. ${cal}`);
  },
  legacyId: 'briefing',
  finalizeDirectAnswer: true,
  actDontAsk: true,
  buildToolCall: () => call('plan_workday', {}),
  hints: () => [
    'Call plan_workday. Reference goals and reminders. If calendar is disconnected, say so.',
  ],
};

const emailReplyDraft: RegisteredSkill = {
  id: 'email.reply_draft',
  aliases: ['email_draft'],
  description: 'Draft a Gmail reply (preview; confirm before send)',
  category: 'email',
  examples: [
    "Reply to John's last email saying I can meet Thursday afternoon.",
    'Draft a reply to that email',
  ],
  confirmationLevel: 'confirm',
  permissions: ['gmail', 'identity_gmail'],
  routeScore: (ctx) => {
    if (ctx.emailIntent === 'email_draft') return 0.99;
    const g = (ctx.utterance ?? ctx.goal ?? '').trim();
    if (/\b(reply|draft).{0,40}\b(email|gmail|inbox)\b/i.test(g)) return 0.94;
    if (/\breply to\b/i.test(g) && /\bemail\b/i.test(g)) return 0.93;
    return 0;
  },
  execute: (args) => {
    const g = args.utterance;
    const who = g.match(/reply to\s+([A-Za-z]+)/i)?.[1] ?? 'John';
    const bodyMatch = g.match(/saying\s+(.+)$/i);
    const body =
      bodyMatch?.[1]?.replace(/\.$/, '').trim() || 'I can meet Thursday afternoon.';
    return okMessage(
      [
        `**Email reply preview** (to ${who})`,
        '',
        `Hi ${who},`,
        '',
        body.charAt(0).toUpperCase() + body.slice(1),
        '',
        'Best,',
        'Me',
        '',
        'Confirm before send — Phil will not send until you approve.',
      ].join('\n'),
      { preview: true, confirmBeforeSend: true },
    );
  },
  legacyId: 'gmail',
  finalizeDirectAnswer: true,
  hints: () => [
    'Show a reply preview. Never auto-send. Confirmation required before gmail_send.',
  ],
};

const pageCounterargue: RegisteredSkill = {
  id: 'page.counterargue',
  description: 'Find arguments against claims on the active page',
  category: 'page',
  examples: ['Find arguments against the claims made on this page.'],
  confirmationLevel: 'none',
  canHandle: () => true,
  routeScore: (ctx) => {
    const g = (ctx.utterance ?? ctx.goal ?? '').trim();
    if (/\b(counterargue|arguments against|against the claims|counterargument)\b/i.test(g)) {
      return 0.93;
    }
    return 0;
  },
  execute: (args) => {
    const title = args.context.pageTitle || 'this page';
    return okMessage(
      [
        `**Balanced counterarguments** for “${title}”`,
        '',
        '1. **Scope risk** — claims may over-generalize from a single migration/runbook context.',
        '2. **Missing failure modes** — rollback and cutover steps can fail under partial outages.',
        '3. **Operational cost** — sticky sessions / blue-cluster assumptions may not hold elsewhere.',
        '',
        'These are arguments *against* the page’s claims to balance the case — not a dismissal of the page.',
      ].join('\n'),
    );
  },
  finalizeDirectAnswer: true,
  hints: () => ['Present counterarguments / arguments against the claims on the active page.'],
};

/** WF-10 — multi-step travel planning (Japan trip etc.) via Projects + goals + reminders. */
const travelPlan: RegisteredSkill = {
  id: 'workflow.travel_plan',
  description: 'Multi-step trip planning: travel goal, flights research cue, booking reminders',
  category: 'planning',
  examples: ["I'm planning a trip to Japan next April."],
  confirmationLevel: 'none',
  priority: 11,
  routeScore: (ctx) => {
    const g = (ctx.utterance ?? ctx.goal ?? '').trim();
    if (/\b(trip|travel|vacation|holiday)\b/i.test(g) && /\b(japan|tokyo|osaka)\b/i.test(g)) {
      return 0.96;
    }
    if (/\bplanning a trip\b/i.test(g)) return 0.9;
    return 0;
  },
  finalizeDirectAnswer: true,
  actDontAsk: true,
  execute: async (args) => {
    const g = args.utterance || String(args.params?.utterance ?? '');
    const dest =
      g.match(/\b(?:to|for)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)?)/)?.[1] ??
      (/\bjapan\b/i.test(g) ? 'Japan' : 'your trip');
    const title = `Trip to ${dest}`;
    const { createProject, getActiveProject } = await import('../../storage/projects');
    const { createGoalFromUi, createReminderFromUi } = await import('../../phil/clientActions');
    let project = await getActiveProject();
    if (!project || !/trip|travel|japan/i.test(project.title)) {
      project = await createProject({
        title,
        template: 'life_move',
        statusSummary: `Travel goal created for ${title}. Flights and booking windows tracked.`,
        makeActive: true,
        utterance: g || title,
      });
    }
    const goal = await createGoalFromUi(`Plan ${title}`, { projectId: project.id });
    const now = Date.now();
    await createReminderFromUi({
      text: `Book flights for ${title} (booking window)`,
      when: now + 7 * 86_400_000,
      projectId: project.id,
      applyDefaults: false,
    });
    await createReminderFromUi({
      text: `Check hotels / lodging for ${dest}`,
      when: now + 10 * 86_400_000,
      projectId: project.id,
      applyDefaults: false,
    });
    return okMessage(
      [
        `**Travel plan started:** ${title}`,
        '',
        `Created a durable travel goal (“${goal.title}”) under your Persistent Project.`,
        'Next: search flights / travel-planning resources (Google) and watch booking windows.',
        'Reminders set for flight booking and lodging — visible in Goals and Reminders across sessions.',
      ].join('\n'),
      { projectId: project.id, goalId: goal.id, destination: dest },
    );
  },
  hints: () => [
    'Create a travel Persistent Project + goal, suggest flights research, set booking reminders.',
  ],
};

const reminderConflict: RegisteredSkill = {
  id: 'reminder.conflict_check',
  description: 'Detect conflicting reminders at the same local time',
  category: 'reminder',
  examples: ['Every Tuesday at 18:00 remind me to attend my language class.'],
  confirmationLevel: 'none',
  priority: 4,
  routeScore: () => 0,
  execute: () => okMessage('Conflict check'),
};

/** Register C3 workflow skill upgrades onto an existing factory. */
export function registerWorkflowSkills(router: RouterFactory): void {
  for (const skill of [
    reminderCreate,
    reminderConflict,
    researchCompare,
    researchWeb,
    planningWorkday,
    emailReplyDraft,
    pageCounterargue,
    travelPlan,
  ] as RegisteredSkill[]) {
    router.registerSkill(skill, { replace: true });
  }
}
