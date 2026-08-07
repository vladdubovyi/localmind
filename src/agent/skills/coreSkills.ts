/**
 * Core + meta + project-template stub skills registered via Router Factory.
 * Canonical ids use dotted namespaces; aliases keep flat legacy ids scoring.
 */

import type { ToolCall } from '../types';
import {
  isBriefingGoal,
  isFocusStatusGoal,
  isGoalSetupGoal,
  isLiveInfoGoal,
  isProjectCreateGoal,
  isProjectListGoal,
  isProjectProgressGoal,
  isReminderGoal,
  isWeatherGoal,
  isWebResearchGoal,
  parseGoalTitle,
  parseProjectTitle,
  parseReminderInMinutes,
  parseReminderText,
} from '../assistantIntent';
import type { ProjectTemplate } from '../../phil/projectTypes';
import { uid } from '../../utils';

function inferProjectTemplate(text: string): ProjectTemplate {
  const t = text.toLowerCase();
  if (/\b(staff|principal|promo|promotion|career|engineer|manager)\b/.test(t)) return 'career';
  if (/\b(job|interview|resume|cv|hiring|apply|applications?)\b/.test(t)) return 'job_hunt';
  if (/\b(research|paper|study|learn|investigate)\b/.test(t)) return 'research';
  if (/\b(exec|calendar|day plan|schedule my day|eod)\b/.test(t)) return 'exec_day';
  if (/\b(move|relocat|spain|house|apartment|mortgage|visa)\b/.test(t)) return 'life_move';
  return 'custom';
}
import type {
  ConfirmationLevel,
  RegisteredSkill,
  RouteContext,
  SkillExecuteArgs,
  SkillExecuteResult,
  SkillId,
} from './types';
import type { RouterFactory } from '../router/types';
import { NotImplementedError } from '../router/types';

/** True for asks that likely need external facts (not pure chat/opinion). */
export function isFactualLookupGoal(goal: string): boolean {
  const g = goal.trim();
  if (!g) return false;
  if (/\bgmail|inbox|email\b/i.test(g)) return false;
  if (
    isReminderGoal(g) ||
    isGoalSetupGoal(g) ||
    isBriefingGoal(g) ||
    isFocusStatusGoal(g) ||
    isProjectCreateGoal(g) ||
    isProjectListGoal(g) ||
    isProjectProgressGoal(g)
  ) {
    return false;
  }
  if (
    /\b(should i|do you think|in your opinion|help me (write|rewrite|brainstorm)|roleplay)\b/i.test(
      g,
    ) &&
    !isLiveInfoGoal(g) &&
    !isWebResearchGoal(g)
  ) {
    return false;
  }
  if (isLiveInfoGoal(g) || isWebResearchGoal(g)) return true;
  if (/^(what|who|when|where|which|how|is|are|does|did|can|will|what's|whats)\b/i.test(g)) {
    return true;
  }
  return /\b(how much|how many|latest|current|today|right now|price of|who (is|was|won)|what (is|are|was))\b/i.test(
    g,
  );
}

function call(name: string, args: Record<string, unknown> = {}): ToolCall {
  return { id: uid('call'), name, arguments: args };
}

function goalOf(ctx: RouteContext): string {
  return (ctx.utterance ?? ctx.goal ?? '').trim();
}

function okMessage(message: string, artifacts?: Record<string, unknown>): SkillExecuteResult {
  return { ok: true, message, artifacts };
}

function stubExecute(label: string) {
  return (args: SkillExecuteArgs): SkillExecuteResult =>
    okMessage(`${label}: understood “${args.utterance.slice(0, 120)}”.`);
}

function exampleOverlap(ctx: RouteContext, examples: string[]): number {
  const u = (ctx.utteranceNorm ?? goalOf(ctx).toLowerCase()).replace(/[^\w\s]/g, ' ');
  const tokens = new Set(u.split(/\s+/).filter((t) => t.length > 2));
  if (!tokens.size || !examples.length) return 0;
  let best = 0;
  for (const ex of examples) {
    const et = ex
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2);
    if (!et.length) continue;
    let hit = 0;
    for (const t of et) if (tokens.has(t)) hit += 1;
    best = Math.max(best, hit / et.length);
  }
  return best;
}

function withBridge(
  skill: RegisteredSkill,
  bridge: {
    legacyId?: SkillId;
    buildToolCall?: RegisteredSkill['buildToolCall'];
    hints?: RegisteredSkill['hints'];
    actDontAsk?: boolean;
    finalizeDirectAnswer?: boolean;
  },
): RegisteredSkill {
  return { ...skill, ...bridge };
}

/** Legacy AGENT_SKILLS-compatible scoring for reminder / goal / … */
export function buildCoreSkills(): RegisteredSkill[] {
  const reminderExamples = [
    'Remind me to call my landlord next Tuesday at 3 PM.',
    'Remind me in 20 minutes to stretch',
    'Remind me every Friday to review my finances.',
  ];

  const reminder: RegisteredSkill = withBridge(
    {
      id: 'reminder.create',
      aliases: ['reminder'],
      description: 'Create or manage reminders',
      category: 'reminder',
      examples: reminderExamples,
      confirmationLevel: 'none',
      priority: 10,
      inputSchema: {
        type: 'object',
        properties: { text: { type: 'string' }, inMinutes: { type: 'number' } },
        required: ['text'],
      },
      routeScore: (ctx) => {
        if (isReminderGoal(goalOf(ctx))) return 0.98;
        return exampleOverlap(ctx, reminderExamples) * 0.7;
      },
      extractArgs: (ctx) => {
        const goal = goalOf(ctx);
        return {
          text: parseReminderText(goal),
          inMinutes: parseReminderInMinutes(goal) ?? 30,
        };
      },
      execute: async (args) => {
        const text = String(args.params?.text ?? parseReminderText(args.utterance));
        return okMessage(`Reminder set: ${text}`, { text });
      },
    },
    {
      legacyId: 'reminder',
      finalizeDirectAnswer: true,
      buildToolCall: (goal) =>
        call('reminder_create', {
          text: parseReminderText(goal),
          inMinutes: parseReminderInMinutes(goal) ?? 30,
        }),
      hints: (goal) => {
        const mins = parseReminderInMinutes(goal);
        return [
          'Call reminder_create with text and inMinutes (or when).',
          mins != null ? `Suggested inMinutes: ${mins}` : 'Infer inMinutes from the request.',
          `Suggested text: ${parseReminderText(goal)}`,
        ];
      },
    },
  );

  const goal: RegisteredSkill = withBridge(
    {
      id: 'goal.create',
      aliases: ['goal'],
      description: 'Create or update focus goals',
      category: 'goal',
      examples: ['Set a goal to finish the proposal', 'I want to learn Kubernetes.'],
      confirmationLevel: 'none',
      priority: 8,
      inputSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
      routeScore: (ctx) => {
        const g = goalOf(ctx);
        if (isProjectCreateGoal(g) || isProjectListGoal(g) || isProjectProgressGoal(g)) return 0;
        // Long-horizon → prefer project skills (lower score here)
        if (/\b(within|over|in)\s+(\d+|a|one|two|six|twelve)\s+(months?|years?)\b/i.test(g)) {
          return isGoalSetupGoal(g) ? 0.55 : 0;
        }
        if (/\b(staff engineer|job hunt|moving to|researching whether)\b/i.test(g)) return 0.2;
        if (isGoalSetupGoal(g)) return 0.96;
        if (/\bi want to (learn|finish|pass)\b/i.test(g) && !/\bmonths?\b/i.test(g)) return 0.7;
        return 0;
      },
      extractArgs: (ctx) => ({ title: parseGoalTitle(goalOf(ctx)) }),
      execute: async (args) =>
        okMessage(`Goal created: ${String(args.params?.title ?? parseGoalTitle(args.utterance))}`),
    },
    {
      legacyId: 'goal',
      finalizeDirectAnswer: true,
      buildToolCall: (g) => {
        if (isProjectCreateGoal(g)) return null;
        return call('goal_create', { title: parseGoalTitle(g) });
      },
      hints: (g) => [
        'Call goal_create with a clear title from the user request.',
        `Suggested title: ${parseGoalTitle(g)}`,
      ],
    },
  );

  const focusSummary: RegisteredSkill = withBridge(
    {
      id: 'focus.summary',
      aliases: ['focus'],
      description: 'Summarize tracked focus / tab time',
      category: 'focus',
      examples: ['How productive was I today?', 'How much productive time today?'],
      confirmationLevel: 'none',
      routeScore: (ctx) => {
        const g = goalOf(ctx);
        if (/\bstay (focused|on track|productive)\b/i.test(g)) return 0;
        return isFocusStatusGoal(g) ? 0.95 : 0;
      },
      execute: stubExecute('Focus summary'),
    },
    {
      legacyId: 'focus',
      finalizeDirectAnswer: true,
      buildToolCall: () => call('focus_summary', {}),
      hints: () => ['Call focus_summary and summarize productive vs leisure time.'],
    },
  );

  const focusCoach: RegisteredSkill = {
    id: 'focus.coach',
    description: 'Productivity coaching / stay focused session',
    category: 'focus',
    examples: [
      'Help me stay focused while I work on my thesis today.',
      'Help me stay on track today.',
    ],
    confirmationLevel: 'none',
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bstay (focused|on track|productive)\b/i.test(g)) return 0.92;
      if (/\bfocus(ed)? (session|coach|while)\b/i.test(g)) return 0.9;
      return exampleOverlap(ctx, [
        'Help me stay focused while I work on my thesis today.',
      ]) * 0.85;
    },
    execute: stubExecute('Focus coach'),
  };

  const briefing: RegisteredSkill = withBridge(
    {
      id: 'briefing.morning',
      aliases: ['briefing'],
      description: 'Morning / today overview',
      category: 'planning',
      examples: ["What's up today?", 'Give me my morning briefing'],
      confirmationLevel: 'none',
      routeScore: (ctx) => (isBriefingGoal(goalOf(ctx)) ? 0.94 : 0),
      execute: stubExecute('Morning briefing'),
    },
    {
      legacyId: 'briefing',
      finalizeDirectAnswer: true,
      buildToolCall: () => call('briefing_today', {}),
      hints: () => ['Call briefing_today and present the overview.'],
    },
  );

  const planningWorkday: RegisteredSkill = {
    id: 'planning.workday',
    description: 'Plan the workday from goals, reminders, and optional calendar',
    category: 'planning',
    examples: ['Plan my workday.', 'Help me plan today'],
    confirmationLevel: 'none',
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bplan (my )?workday\b/i.test(g) || /\bplan (my )?day\b/i.test(g)) return 0.93;
      return 0;
    },
    execute: (args) => {
      const cal = args.context.calendarConnected
        ? 'Including today’s calendar events.'
        : 'Calendar not connected — planning without inventing events.';
      return okMessage(`Workday plan ready. ${cal}`);
    },
  };

  const gmailList: RegisteredSkill = withBridge(
    {
      id: 'email.list',
      aliases: ['gmail'],
      description: 'Gmail list / read / triage',
      category: 'email',
      examples: ['List my last 5 emails', 'What emails did I get today?'],
      confirmationLevel: 'none',
      permissions: ['gmail', 'identity_gmail'],
      routeScore: (ctx) => {
        if (ctx.emailIntent && String(ctx.emailIntent).startsWith('email_')) return 0.99;
        if (/\b(list|show|check).{0,20}\b(email|inbox|gmail)\b/i.test(goalOf(ctx))) return 0.92;
        if (/\bgmail|inbox|email\b/i.test(goalOf(ctx)) && !/\breply|draft|send\b/i.test(goalOf(ctx)))
          return 0.88;
        return 0;
      },
      execute: stubExecute('Email list'),
    },
    {
      legacyId: 'gmail',
      actDontAsk: false,
      hints: () => [
        'Use Gmail tools (gmail_list / gmail_read / gmail_draft / …). Never invent inbox contents.',
      ],
    },
  );

  const emailReplyDraft: RegisteredSkill = {
    id: 'email.reply_draft',
    aliases: ['email_draft'],
    description: 'Draft a Gmail reply (preview; do not auto-send)',
    category: 'email',
    examples: [
      "Reply to John's last email saying I can meet Thursday afternoon.",
      'Draft a reply to that email',
    ],
    confirmationLevel: 'confirm',
    permissions: ['gmail', 'identity_gmail'],
    legacyId: 'gmail',
    routeScore: (ctx) => {
      if (ctx.emailIntent === 'email_draft') return 0.99;
      const g = goalOf(ctx);
      if (/\b(reply|draft).{0,40}\b(email|gmail|inbox)\b/i.test(g)) return 0.94;
      if (/\breply to\b/i.test(g) && /\bemail\b/i.test(g)) return 0.93;
      return 0;
    },
    execute: stubExecute('Email reply draft'),
    hints: () => [
      'Use gmail_draft for a reply preview. Never auto-send. Confirmation required before send.',
    ],
  };

  const emailSend: RegisteredSkill = {
    id: 'email.send',
    description: 'Send an email — confirmation required',
    category: 'email',
    examples: ['Send that email', 'Send the draft to John'],
    confirmationLevel: 'required',
    permissions: ['gmail', 'identity_gmail'],
    legacyId: 'gmail',
    routeScore: (ctx) => {
      if (ctx.emailIntent === 'email_send') return 0.99;
      const g = goalOf(ctx);
      if (/\bsend (the |that )?(email|draft|message)\b/i.test(g)) return 0.95;
      return 0;
    },
    execute: () => ({
      ok: false,
      error: 'confirmation required before email.send',
      message: 'Confirmation required before sending email.',
    }),
    hints: () => ['Call gmail_send only after explicit user confirmation.'],
  };

  const openLink: RegisteredSkill = withBridge(
    {
      id: 'tabs.open_url',
      aliases: ['open_link'],
      description: 'Open a concrete https URL',
      category: 'browser',
      examples: ['Open https://example.com in a new tab'],
      confirmationLevel: 'none',
      routeScore: (ctx) => {
        if (ctx.emailIntent === 'open_link') return 0.93;
        if (
          /\bhttps?:\/\//i.test(goalOf(ctx)) &&
          /\b(open|go to|visit|navigate)\b/i.test(goalOf(ctx))
        ) {
          return 0.9;
        }
        return 0;
      },
      extractArgs: (ctx) => {
        const url = goalOf(ctx).match(/https?:\/\/[^\s"'<>]+/i)?.[0];
        return url ? { url, active: true } : null;
      },
      execute: stubExecute('Open URL'),
    },
    {
      legacyId: 'open_link',
      actDontAsk: true,
      buildToolCall: (goal) => {
        const url = goal.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
        if (!url) return null;
        return call('tabs_create', { url, active: true });
      },
      hints: () => ['Prefer tabs_create with the real https URL from context.'],
    },
  );

  const browsePage: RegisteredSkill = withBridge(
    {
      id: 'research.browse',
      aliases: ['browse_page'],
      description: 'Open/read a named web page',
      category: 'research',
      examples: ['Open the Wikipedia WebGPU page'],
      confirmationLevel: 'none',
      routeScore: (ctx) => {
        if (ctx.emailIntent === 'web_page') return 0.88;
        if (/\b(wikipedia|open .+ page|read .+ page|webgpu)\b/i.test(goalOf(ctx))) return 0.85;
        return 0;
      },
      execute: stubExecute('Browse page'),
    },
    {
      legacyId: 'browse_page',
      actDontAsk: true,
      hints: () => ['Use tabs_create → page_read for the requested page, then answer.'],
    },
  );

  const liveWeather: RegisteredSkill = withBridge(
    {
      id: 'research.web.weather',
      aliases: ['live_weather'],
      description: 'Live weather / forecast via specialized research',
      category: 'research',
      examples: ['What is the weather today?', 'weather in Paris'],
      confirmationLevel: 'none',
      routeScore: (ctx) => (isWeatherGoal(goalOf(ctx)) ? 0.97 : 0),
      execute: stubExecute('Weather research'),
    },
    {
      legacyId: 'live_weather',
      finalizeDirectAnswer: true,
      actDontAsk: true,
      buildToolCall: (goal) =>
        call('web_research', { query: goal.trim(), maxResults: 1, skill: 'live_weather' }),
      hints: () => [
        'Call web_research for the weather query (do not ask permission).',
        'Answer from the returned forecast text.',
      ],
    },
  );

  const researchWeb: RegisteredSkill = withBridge(
    {
      id: 'research.web',
      aliases: ['web_lookup'],
      description: 'General live facts / research on the web (Google default)',
      category: 'research',
      examples: [
        'Research noise-cancelling headphones under $100',
        'Who won the election yesterday?',
        'Find the three best project management tools for startups.',
      ],
      confirmationLevel: 'none',
      routeScore: (ctx) => {
        const g = goalOf(ctx);
        if (isWeatherGoal(g)) return 0;
        if (/\bcompare\b/i.test(g) && /\brecommend\b/i.test(g)) return 0.4;
        if (ctx.pageUrl && /\bsummarize this\b/i.test(g)) return 0;
        if (isLiveInfoGoal(g) || isWebResearchGoal(g)) return 0.86;
        if (isFactualLookupGoal(g)) return 0.72;
        return 0;
      },
      execute: stubExecute('Web research (Google)'),
    },
    {
      legacyId: 'web_lookup',
      finalizeDirectAnswer: true,
      actDontAsk: true,
      buildToolCall: (goal) =>
        call('web_research', { query: goal.trim(), maxResults: 2, skill: 'web_lookup' }),
      hints: () => [
        'Call web_research immediately (do not ask for permission). Default engine: Google.',
        'Answer from the returned answer/excerpt. Do not invent tab ids or loop tabs_list.',
      ],
    },
  );

  const researchCompare: RegisteredSkill = {
    id: 'research.compare_decide',
    description: 'Compare options and recommend one (multi-skill research plan)',
    category: 'research',
    examples: [
      "I'm looking for a mechanical keyboard under $150 with hot-swappable switches. Compare the best options and recommend one.",
      'Compare the best options and recommend one.',
    ],
    confirmationLevel: 'none',
    priority: 5,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bcompare\b/i.test(g) && /\b(recommend|decide|best)\b/i.test(g)) return 0.94;
      if (/\bcompare\b/i.test(g) && /\boptions?\b/i.test(g)) return 0.88;
      return exampleOverlap(ctx, [
        'Compare the best options and recommend one',
        'mechanical keyboard under hot-swappable',
      ]) * 0.9;
    },
    execute: stubExecute('Research compare/decide'),
  };

  const pageSummarize: RegisteredSkill = {
    id: 'page.summarize',
    description: 'Summarize the active page (not generic web research)',
    category: 'page',
    examples: ['Summarize this page.', 'Summarize this'],
    confirmationLevel: 'none',
    priority: 12,
    canHandle: (ctx) => Boolean(ctx.pageUrl || ctx.pageHasExtract || ctx.trigger === 'chip'),
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      const hasPage = Boolean(ctx.pageUrl || ctx.pageHasExtract || ctx.pageTitle);
      if (!hasPage && ctx.trigger !== 'chip') return 0;
      if (/\bsummarize this( page)?\b/i.test(g)) return 0.99;
      if (/\bsummarize\b/i.test(g) && hasPage) return 0.95;
      return 0;
    },
    execute: stubExecute('Page summarize'),
    hints: () => [
      'Summarize the active page from page context / page_read. Do NOT call web_research.',
    ],
  };

  const pageCounterargue: RegisteredSkill = {
    id: 'page.counterargue',
    description: 'Find arguments against claims on the active page',
    category: 'page',
    examples: ['Find arguments against the claims made on this page.'],
    confirmationLevel: 'none',
    canHandle: (ctx) => Boolean(ctx.pageUrl || ctx.pageHasExtract),
    routeScore: (ctx) => {
      if (!ctx.pageUrl && !ctx.pageHasExtract) return 0;
      if (/\b(counterargue|arguments against|against the claims)\b/i.test(goalOf(ctx))) return 0.93;
      return 0;
    },
    execute: stubExecute('Page counterargue'),
  };

  const pageAsk: RegisteredSkill = {
    id: 'page.ask',
    description: 'Ask a question about the active page',
    category: 'page',
    examples: ['What is the rollback step on this page?'],
    confirmationLevel: 'none',
    canHandle: (ctx) => Boolean(ctx.pageUrl || ctx.pageHasExtract),
    routeScore: (ctx) => {
      if (!ctx.pageUrl && !ctx.pageHasExtract) return 0;
      const g = goalOf(ctx);
      if (/\bon this page\b/i.test(g) && /\?/.test(g)) return 0.9;
      if (/\b(what|where|how).{0,40}\bon this page\b/i.test(g)) return 0.88;
      return 0;
    },
    execute: stubExecute('Page ask'),
  };

  const memoryRemember: RegisteredSkill = {
    id: 'memory.remember',
    aliases: ['memory.save'],
    description: 'Remember a user preference or fact',
    category: 'memory',
    examples: ['Remember that I prefer morning briefings at 7.', 'Save this comparison'],
    confirmationLevel: 'none',
    permissions: ['storage_memory'],
    canHandle: (ctx) => ctx.memoryEnabled !== false,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bremember that\b/i.test(g) || /\bsave this\b/i.test(g)) return 0.9;
      return 0;
    },
    execute: stubExecute('Memory remember'),
  };

  const memoryRecall: RegisteredSkill = {
    id: 'memory.recall',
    description: 'Recall something previously remembered',
    category: 'memory',
    examples: ['What did I ask you to remember about briefings?'],
    confirmationLevel: 'none',
    routeScore: (ctx) =>
      /\b(what did i|remember about|did i ask you to remember)\b/i.test(goalOf(ctx)) ? 0.88 : 0,
    execute: stubExecute('Memory recall'),
  };

  const dataClear: RegisteredSkill = {
    id: 'data.clear',
    description: 'Clear chats / memories / local data — confirmation required',
    category: 'settings_privacy',
    examples: ['Clear all my memories', 'Delete all my data'],
    confirmationLevel: 'required',
    permissions: ['storage'],
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bclear (all )?(my )?(memories|data|chats)\b/i.test(g)) return 0.96;
      if (/\bdelete (all )?(my )?(memories|data)\b/i.test(g)) return 0.95;
      return 0;
    },
    execute: () => ({
      ok: false,
      error: 'confirmation required before data.clear',
      message: 'Confirmation required before clearing data.',
    }),
  };

  const metaClarify: RegisteredSkill = {
    id: 'meta.clarify',
    description: 'Ask a clarifying question when context is insufficient',
    category: 'meta',
    examples: ['Help me with that thing we discussed'],
    confirmationLevel: 'none',
    priority: -5,
    routeScore: () => 0.05, // selected explicitly by factory clarify stage
      execute: (args) => {
      const q =
        (typeof args.params?.question === 'string' && args.params.question) ||
        'Could you share a bit more context?';
      return okMessage(q);
    },
  };

  const assistantGeneral: RegisteredSkill = withBridge(
    {
      id: 'assistant.general',
      aliases: ['chat'],
      description: 'General assistant / agent fallback (tool-using chat)',
      category: 'fallback',
      examples: ['Do you think I should take the job?'],
      confirmationLevel: 'none',
      priority: -10,
      routeScore: () => 0.1,
      execute: stubExecute('General assistant'),
    },
    {
      legacyId: 'chat',
      hints: () => ['Answer directly if no tool is needed. Stay on-topic.'],
    },
  );

  // Project template stubs (SKL-01) — full execute owned by C1/B2
  const projectCareer: RegisteredSkill = {
    id: 'project.career_accelerator',
    description: 'Career Accelerator Persistent Project template',
    category: 'project',
    projectTemplate: 'career',
    examples: [
      'I want to become a Staff Engineer within 12 months.',
      "I'm preparing for a Staff Engineer interview next week.",
    ],
    confirmationLevel: 'none',
    priority: 6,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bstaff engineer\b/i.test(g) && /\b(12 months|within|career|promotion|interview)\b/i.test(g))
        return 0.97;
      if (/\bstaff engineer\b/i.test(g) && /\b(want|become|aim)\b/i.test(g)) return 0.94;
      if (/\bcareer accelerator\b/i.test(g)) return 0.95;
      return exampleOverlap(ctx, ['Staff Engineer within 12 months']) * 0.9;
    },
    execute: stubExecute('Career Accelerator project'),
  };

  const projectJobHunt: RegisteredSkill = {
    id: 'project.job_hunt',
    description: 'Job Hunt Persistent Project — daily search / constraints',
    category: 'project',
    projectTemplate: 'job_hunt',
    examples: [
      'I want a remote backend job paying at least €120k.',
      'Any new ones today?',
    ],
    confirmationLevel: 'none',
    priority: 6,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (ctx.activeProject?.template === 'job_hunt') {
        if (/\bany new ones\b/i.test(g) || /\bnew (roles|jobs|listings)\b/i.test(g)) return 0.98;
      }
      if (/\b(job hunt|job search|looking for (a )?job)\b/i.test(g)) return 0.9;
      if (/\b(remote|salary|€|\$)\b/i.test(g) && /\b(job|role|backend|engineer)\b/i.test(g))
        return 0.92;
      if (/\bany new ones today\b/i.test(g) && ctx.activeProject?.template === 'job_hunt') return 0.98;
      return 0;
    },
    execute: stubExecute('Job Hunt project'),
  };

  const projectResearch: RegisteredSkill = {
    id: 'project.research_manager',
    description: 'Research Manager Persistent Project template',
    category: 'project',
    projectTemplate: 'research',
    examples: ["I'm researching whether to buy an electric car this year."],
    confirmationLevel: 'none',
    priority: 5,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bresearching whether\b/i.test(g) || /\bresearch (project|manager)\b/i.test(g)) return 0.93;
      if (ctx.activeProject?.template === 'research' && /\brecommendation\b/i.test(g)) return 0.9;
      return 0;
    },
    execute: stubExecute('Research Manager project'),
  };

  const projectLife: RegisteredSkill = {
    id: 'project.life_planner',
    description: 'Life Planner Persistent Project template',
    category: 'project',
    projectTemplate: 'life_move',
    examples: ["I'm moving to Spain in six months."],
    confirmationLevel: 'none',
    priority: 5,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bmoving to\b/i.test(g) && /\b(months?|year)\b/i.test(g)) return 0.94;
      if (/\blife planner\b/i.test(g)) return 0.95;
      return 0;
    },
    execute: stubExecute('Life Planner project'),
  };

  const projectCreate: RegisteredSkill = withBridge(
    {
      id: 'project.create',
      aliases: ['project'],
      description: 'Create a Persistent Project (custom or inferred template)',
      category: 'project',
      projectTemplate: 'custom',
      examples: [
        "I'm buying my first home.",
        'Help me build a startup over the next six months.',
        'Create a project for my thesis.',
      ],
      confirmationLevel: 'none',
      priority: 9,
      routeScore: (ctx) => {
        const g = goalOf(ctx);
        if (isProjectCreateGoal(g)) return 0.97;
        if (/\b(buying|buy) (my )?(first )?home\b/i.test(g)) return 0.85;
        if (/\bbuild a startup\b/i.test(g) && /\bmonths?\b/i.test(g)) return 0.86;
        if (/\bcreate (a )?project\b/i.test(g)) return 0.9;
        return 0;
      },
      extractArgs: (ctx) => {
        const title = parseProjectTitle(goalOf(ctx));
        return { title, template: inferProjectTemplate(title) };
      },
      execute: async (args) =>
        okMessage(`I've set up your ${String(args.params?.title ?? 'new')} project.`),
    },
    {
      finalizeDirectAnswer: true,
      buildToolCall: (goal) => {
        if (isProjectListGoal(goal)) return call('project_list', {});
        if (isProjectProgressGoal(goal)) return call('project_progress', {});
        const title = parseProjectTitle(goal);
        return call('project_create', {
          title,
          template: inferProjectTemplate(title),
        });
      },
      hints: (goal) => {
        if (isProjectListGoal(goal)) {
          return ['Call project_list and summarize titles + status. Mention the active project.'];
        }
        if (isProjectProgressGoal(goal)) {
          return [
            'Call project_progress (or project_get) and answer in project terms with workstreams + next-week plan.',
          ];
        }
        return [
          'Call project_create with a clear title (not only goal_create).',
          `Suggested title: ${parseProjectTitle(goal)}`,
          "Reply like: I've set up your [title] project…",
        ];
      },
    },
  );

  const projectStatus: RegisteredSkill = withBridge(
    {
      id: 'project.status',
      description: 'Where am I on the active project?',
      category: 'project',
      examples: ['Where am I?', 'What projects am I working on?'],
      confirmationLevel: 'none',
      priority: 8,
      routeScore: (ctx) => {
        const g = goalOf(ctx);
        if (isProjectProgressGoal(g)) return 0.96;
        if (isProjectListGoal(g)) return 0.95;
        if (/\bwhere am i\b/i.test(g) && ctx.activeProjectId) return 0.9;
        if (/\bwhat projects\b/i.test(g)) return 0.88;
        return 0;
      },
      execute: async () => okMessage('Checking project progress…'),
    },
    {
      finalizeDirectAnswer: true,
      buildToolCall: (goal) => {
        if (isProjectListGoal(goal) || /\bwhat projects\b/i.test(goal)) {
          return call('project_list', {});
        }
        return call('project_progress', {});
      },
      hints: () => ['Call project_progress or project_list and answer in project terms.'],
    },
  );

  const projectExecDay: RegisteredSkill = {
    id: 'project.exec_day',
    description: 'Exec Day / stay productive today template',
    category: 'project',
    projectTemplate: 'exec_day',
    examples: ['Help me stay productive today.'],
    confirmationLevel: 'none',
    priority: 4,
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (/\bstay productive today\b/i.test(g)) return 0.96;
      if (/\bexec day\b/i.test(g)) return 0.94;
      return 0;
    },
    execute: stubExecute('Exec Day project'),
  };

  return [
    reminder,
    goal,
    focusSummary,
    focusCoach,
    briefing,
    planningWorkday,
    gmailList,
    emailReplyDraft,
    emailSend,
    openLink,
    browsePage,
    liveWeather,
    researchWeb,
    researchCompare,
    pageSummarize,
    pageCounterargue,
    pageAsk,
    memoryRemember,
    memoryRecall,
    dataClear,
    metaClarify,
    assistantGeneral,
    projectCareer,
    projectJobHunt,
    projectResearch,
    projectLife,
    projectCreate,
    projectStatus,
    projectExecDay,
  ];
}

/** Register all core + stub project skills onto a factory. */
export function registerCoreSkills(router: RouterFactory): void {
  for (const skill of buildCoreSkills()) {
    router.registerSkill(skill, { replace: true });
  }
}

/** ConfirmationLevel helper for SKL-02 assertions. */
export function confirmationRequired(level: ConfirmationLevel): boolean {
  return level === 'required';
}

/** Re-export for tests that expect NotImplementedError from skills. */
export { NotImplementedError };
