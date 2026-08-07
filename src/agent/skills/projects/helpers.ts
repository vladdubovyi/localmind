/**
 * Shared helpers for project template skills (C1).
 */
import type { ToolCall } from '../../types';
import type { RouteContext, SkillExecuteArgs, SkillExecuteResult } from '../types';

export function goalOf(ctx: RouteContext): string {
  return (ctx.utterance ?? ctx.goal ?? '').trim();
}
export function call(name: string, args: Record<string, unknown> = {}): ToolCall {
  return { name, arguments: args };
}
export function okMessage(message: string, artifacts?: Record<string, unknown>): SkillExecuteResult {
  return { ok: true, message, artifacts };
}
export function exampleOverlap(ctx: RouteContext, examples: string[]): number {
  const g = goalOf(ctx).toLowerCase();
  if (!g) return 0;
  let hits = 0;
  for (const ex of examples) {
    const tokens = ex.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
    if (tokens.filter((t) => g.includes(t)).length >= Math.min(3, tokens.length)) hits += 1;
  }
  return examples.length ? hits / examples.length : 0;
}
export function parseProjectTitleFromGoal(goal: string): string {
  const g = goal.trim();
  if (/staff engineer/i.test(g)) return 'Staff Engineer Promotion';
  if (/remote backend job|job paying|job hunt/i.test(g)) return 'Job Hunt — remote backend';
  if (/electric car|ev purchase|buy an electric/i.test(g)) return 'EV purchase research';
  const move = g.match(/moving to\s+([^.?!]+)/i);
  if (move) return `Move to ${move[1]!.replace(/\s+in\s+.*/i, '').trim()}`;
  if (/buying (my )?first home|home purchase/i.test(g)) return 'Buying my first home';
  return g.slice(0, 80) || 'New project';
}
export function monthsFromUtterance(text: string, fallbackMonths: number): number {
  const m = text.match(/within\s+(\d+)\s+months?/i) || text.match(/in\s+(\d+)\s+months?/i);
  if (m) return Number(m[1]);
  if (/12 months|a year|one year/i.test(text)) return 12;
  if (/six months|6 months/i.test(text)) return 6;
  return fallbackMonths;
}
export async function executeCreateProject(
  args: SkillExecuteArgs,
  template: string,
  titleHint?: string,
): Promise<SkillExecuteResult> {
  const { createProjectFromUi } = await import('@/phil/clientActions');
  const utterance = args.utterance || args.context.goal || '';
  const title = titleHint || parseProjectTitleFromGoal(utterance);
  const { project, goal } = await createProjectFromUi({
    title,
    template: template as 'career' | 'job_hunt' | 'research' | 'exec_day' | 'life_move' | 'custom',
    utterance,
  });
  return okMessage(project.statusSummary ?? `I've set up your ${project.title} project.`, {
    projectId: project.id,
    goalId: goal.id,
    template: project.template,
  });
}
