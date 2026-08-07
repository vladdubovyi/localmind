import type { AgentRoute, AgentSkill, RouteConfidence, RouteContext } from './types';
import { AGENT_SKILLS } from './registry';

const SCORE_THRESHOLD = 0.55;

function confidenceFor(score: number): RouteConfidence {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

/**
 * Pick the best skill for a goal.
 * High-precision skills (reminder, weather, gmail…) win when they match;
 * ambiguous factual questions fall through to web_lookup; otherwise chat.
 */
export function routeGoal(ctx: RouteContext): AgentRoute {
  let best: { skill: AgentSkill; score: number } | null = null;
  for (const skill of AGENT_SKILLS) {
    const score = skill.score(ctx);
    if (!best || score > best.score) best = { skill, score };
  }

  const skill =
    best && best.score >= SCORE_THRESHOLD
      ? best.skill
      : (AGENT_SKILLS.find((s) => s.id === 'chat') as AgentSkill);
  const score = best && skill.id === best.skill.id ? best.score : 0.1;
  const toolCall = skill.buildToolCall?.(ctx.goal) ?? null;

  return {
    skill,
    confidence: confidenceFor(score),
    toolCall,
    hints: skill.hints?.(ctx.goal) ?? [],
    actDontAsk: Boolean(skill.actDontAsk),
    finalizeDirectAnswer: Boolean(skill.finalizeDirectAnswer),
  };
}

/** Debug / tests: ranked skill scores for a goal. */
export function rankSkills(ctx: RouteContext): Array<{ id: string; score: number }> {
  return AGENT_SKILLS.map((skill) => ({ id: skill.id, score: skill.score(ctx) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);
}
