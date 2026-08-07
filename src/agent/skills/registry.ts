import type { ToolCall } from '../types';
import {
  isBriefingGoal,
  isFocusStatusGoal,
  isGoalSetupGoal,
  isLiveInfoGoal,
  isReminderGoal,
  isWeatherGoal,
  isWebResearchGoal,
  parseGoalTitle,
  parseReminderInMinutes,
  parseReminderText,
} from '../assistantIntent';
import { uid } from '../../utils';
import type { AgentSkill } from './types';

function call(name: string, args: Record<string, unknown> = {}): ToolCall {
  return { id: uid('call'), name, arguments: args };
}

/** True for asks that likely need external facts (not pure chat/opinion). */
export function isFactualLookupGoal(goal: string): boolean {
  const g = goal.trim();
  if (!g) return false;
  if (/\bgmail|inbox|email\b/i.test(g)) return false;
  if (isReminderGoal(g) || isGoalSetupGoal(g) || isBriefingGoal(g) || isFocusStatusGoal(g)) {
    return false;
  }
  // Opinions / writing help stay in chat unless they also look like live facts.
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
  if (
    /^(what|who|when|where|which|how|is|are|does|did|can|will|what's|whats)\b/i.test(g)
  ) {
    return true;
  }
  return /\b(how much|how many|latest|current|today|right now|price of|who (is|was|won)|what (is|are|was))\b/i.test(
    g,
  );
}

export const AGENT_SKILLS: AgentSkill[] = [
  {
    id: 'reminder',
    description: 'Create or manage reminders',
    score: (ctx) => (isReminderGoal(ctx.goal) ? 0.98 : 0),
    buildToolCall: (goal) =>
      call('reminder_create', {
        text: parseReminderText(goal),
        inMinutes: parseReminderInMinutes(goal) ?? 30,
      }),
    finalizeDirectAnswer: true,
    hints: (goal) => {
      const mins = parseReminderInMinutes(goal);
      return [
        'Call reminder_create with text and inMinutes (or when).',
        mins != null ? `Suggested inMinutes: ${mins}` : 'Infer inMinutes from the request.',
        `Suggested text: ${parseReminderText(goal)}`,
      ];
    },
  },
  {
    id: 'goal',
    description: 'Create or update focus goals',
    score: (ctx) => (isGoalSetupGoal(ctx.goal) ? 0.96 : 0),
    buildToolCall: (goal) => call('goal_create', { title: parseGoalTitle(goal) }),
    finalizeDirectAnswer: true,
    hints: (goal) => [
      'Call goal_create with a clear title from the user request.',
      `Suggested title: ${parseGoalTitle(goal)}`,
    ],
  },
  {
    id: 'focus',
    description: 'Summarize tracked focus / tab time',
    score: (ctx) => (isFocusStatusGoal(ctx.goal) ? 0.95 : 0),
    buildToolCall: () => call('focus_summary', {}),
    finalizeDirectAnswer: true,
    hints: () => ['Call focus_summary and summarize productive vs leisure time.'],
  },
  {
    id: 'briefing',
    description: 'Morning / today overview',
    score: (ctx) => (isBriefingGoal(ctx.goal) ? 0.94 : 0),
    buildToolCall: () => call('briefing_today', {}),
    finalizeDirectAnswer: true,
    hints: () => ['Call briefing_today and present the overview.'],
  },
  {
    id: 'gmail',
    description: 'Gmail list / read / draft / triage',
    score: (ctx) => {
      if (ctx.emailIntent && String(ctx.emailIntent).startsWith('email_')) return 0.99;
      if (/\bgmail|inbox|email\b/i.test(ctx.goal)) return 0.9;
      return 0;
    },
    // Email keeps the existing model+nudge loop; no single fast-path tool.
    actDontAsk: false,
    hints: () => [
      'Use Gmail tools (gmail_list / gmail_read / gmail_draft / …). Never invent inbox contents.',
    ],
  },
  {
    id: 'open_link',
    description: 'Open a concrete https URL',
    score: (ctx) => {
      if (ctx.emailIntent === 'open_link') return 0.93;
      if (/\bhttps?:\/\//i.test(ctx.goal) && /\b(open|go to|visit|navigate)\b/i.test(ctx.goal)) {
        return 0.9;
      }
      return 0;
    },
    buildToolCall: (goal) => {
      const url = goal.match(/https?:\/\/[^\s"'<>]+/i)?.[0];
      if (!url) return null;
      return call('tabs_create', { url, active: true });
    },
    actDontAsk: true,
    hints: () => ['Prefer tabs_create with the real https URL from context.'],
  },
  {
    id: 'browse_page',
    description: 'Open/read a named web page',
    score: (ctx) => {
      if (ctx.emailIntent === 'web_page') return 0.88;
      if (/\b(wikipedia|open .+ page|read .+ page|webgpu)\b/i.test(ctx.goal)) return 0.85;
      return 0;
    },
    actDontAsk: true,
    hints: () => ['Use tabs_create → page_read for the requested page, then answer.'],
  },
  {
    id: 'live_weather',
    description: 'Live weather / forecast via specialized research',
    score: (ctx) => (isWeatherGoal(ctx.goal) ? 0.97 : 0),
    buildToolCall: (goal) =>
      call('web_research', { query: goal.trim(), maxResults: 1, skill: 'live_weather' }),
    finalizeDirectAnswer: true,
    actDontAsk: true,
    hints: () => [
      'Call web_research for the weather query (do not ask permission).',
      'Answer from the returned forecast text.',
    ],
  },
  {
    id: 'web_lookup',
    description: 'General live facts / research on the web',
    score: (ctx) => {
      if (isWeatherGoal(ctx.goal)) return 0; // live_weather wins
      if (isLiveInfoGoal(ctx.goal) || isWebResearchGoal(ctx.goal)) return 0.86;
      if (isFactualLookupGoal(ctx.goal)) return 0.72;
      return 0;
    },
    buildToolCall: (goal) =>
      call('web_research', { query: goal.trim(), maxResults: 2, skill: 'web_lookup' }),
    finalizeDirectAnswer: true,
    actDontAsk: true,
    hints: () => [
      'Call web_research immediately (do not ask for permission).',
      'Answer from the returned answer/excerpt. Do not invent tab ids or loop tabs_list.',
    ],
  },
  {
    id: 'chat',
    description: 'Conversational reply without tools',
    score: () => 0.1, // always available as low-confidence fallback
    hints: () => ['Answer directly if no tool is needed. Stay on-topic.'],
  },
];

export function getSkill(id: string): AgentSkill | undefined {
  return AGENT_SKILLS.find((s) => s.id === id);
}
