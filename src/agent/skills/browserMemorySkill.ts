/**
 * Browser memory skill — find articles / pages from recent browse history.
 * Registers onto the Router Factory (does not edit coreSkills scoring).
 */

import type { ToolCall } from '../types';
import type { RegisteredSkill, RouteContext, SkillExecuteResult } from './types';
import type { RouterFactory } from '../router/types';
import { uid } from '../../utils';
import { extractBrowseSearchQuery } from '../../storage/browserMemoryQuery';

function goalOf(ctx: RouteContext): string {
  return (ctx.utterance ?? ctx.goal ?? '').trim();
}

function call(name: string, args: Record<string, unknown> = {}): ToolCall {
  return { id: uid('call'), name, arguments: args };
}

const EXAMPLES = [
  'Find that Kubernetes article I read last week.',
  'Find that article I read last week about operators.',
  'What was that page I visited about WebGPU?',
  'Find the React docs I opened yesterday.',
];

export function isBrowserMemoryFindGoal(goal: string): boolean {
  const g = goal.trim();
  if (!g) return false;
  if (
    /\b(find|show|locate|search|look\s*(up|for)|what was|where is)\b/i.test(g) &&
    /\b(article|page|post|link|site|tab|docs?|read|visited|opened|browsed)\b/i.test(g)
  ) {
    return true;
  }
  if (/\bi read (last week|yesterday|a week ago|recently)\b/i.test(g)) return true;
  if (/\b(browser memory|browse history|from my history)\b/i.test(g)) return true;
  return false;
}

export function buildBrowserMemorySkill(): RegisteredSkill {
  return {
    id: 'browser_memory.find',
    aliases: ['browser_memory_search', 'browser_memory'],
    description: 'Search indexed browser history / tab activity for pages you read recently',
    category: 'browser_memory',
    examples: EXAMPLES,
    confirmationLevel: 'none',
    priority: 11,
    permissions: ['history', 'storage'],
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
    routeScore: (ctx) => {
      const g = goalOf(ctx);
      if (isBrowserMemoryFindGoal(g)) return 0.97;
      const u = (ctx.utteranceNorm ?? g.toLowerCase()).replace(/[^\w\s]/g, ' ');
      const tokens = new Set(u.split(/\s+/).filter((t) => t.length > 2));
      let best = 0;
      for (const ex of EXAMPLES) {
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
      return best >= 0.45 ? best * 0.9 : 0;
    },
    extractArgs: (ctx) => {
      const goal = goalOf(ctx);
      return {
        query: extractBrowseSearchQuery(goal) || goal,
        limit: 5,
        utterance: goal,
      };
    },
    execute: (args): SkillExecuteResult => ({
      ok: true,
      message: `Searching browser memory for “${String(args.params?.query ?? args.utterance)}”…`,
      toolCalls: [
        call('browser_memory_search', {
          query: String(args.params?.utterance ?? args.params?.query ?? args.utterance),
          limit: Number(args.params?.limit ?? 5),
        }),
      ],
    }),
    finalizeDirectAnswer: true,
    actDontAsk: true,
    buildToolCall: (goal) =>
      call('browser_memory_search', {
        query: goal.trim(),
        limit: 5,
      }),
    hints: () => [
      'Call browser_memory_search with the user query (include “last week” etc.).',
      'If History is not granted, explain how to enable it in Privacy — do not pretend visits were empty.',
      'Offer an Open action for the top result URL.',
    ],
  };
}

export function registerBrowserMemorySkill(router: RouterFactory): void {
  router.registerSkill(buildBrowserMemorySkill(), { replace: true });
}
