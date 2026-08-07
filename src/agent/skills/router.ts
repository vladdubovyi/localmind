import type {
  AgentRoute,
  AgentSkill,
  RegisteredSkill,
  RouteConfidence,
  RouteContext,
  SkillId,
  SkillPlan,
} from './types';
import { getDefaultRouter } from './defaultRouter';

const SCORE_THRESHOLD = 0.55;

function confidenceFor(score: number): RouteConfidence {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

function toAgentSkill(registered: RegisteredSkill): AgentSkill {
  const legacyId = (registered.legacyId ??
    (registered.category === 'email'
      ? 'gmail'
      : registered.category === 'research'
        ? 'web_lookup'
        : registered.category === 'focus'
          ? 'focus'
          : registered.category === 'reminder'
            ? 'reminder'
            : registered.category === 'goal'
              ? 'goal'
              : registered.category === 'planning'
                ? 'briefing'
                : registered.category === 'memory' || registered.category === 'browser_memory'
                  ? 'memory'
                  : 'chat')) as SkillId;
  return {
    id: legacyId,
    description: `${registered.id}: ${registered.description}`,
    score: (ctx) => registered.routeScore(ctx),
    buildToolCall: registered.buildToolCall,
    finalizeDirectAnswer: registered.finalizeDirectAnswer,
    actDontAsk: registered.actDontAsk,
    hints: registered.hints,
    confirmationLevel: registered.confirmationLevel,
  };
}

/**
 * Map a SkillPlan from the factory into the legacy AgentRoute used by useAgent.
 */
export function skillPlanToAgentRoute(plan: SkillPlan, goal: string): AgentRoute {
  const router = getDefaultRouter();
  const step = plan.steps[0];
  const skillId = step?.skillId ?? 'assistant.general';
  const registered = (router.getSkill(skillId) ??
    router.getSkill('assistant.general')) as RegisteredSkill | undefined;

  const fallbackChat: AgentSkill = {
    id: 'chat',
    description: 'Conversational reply without tools',
    score: () => 0.1,
    hints: () => ['Answer directly if no tool is needed. Stay on-topic.'],
    confirmationLevel: 'none',
  };

  const agentSkill = registered ? toAgentSkill(registered) : fallbackChat;
  const toolCall = registered?.buildToolCall?.(goal) ?? null;
  const topScore = plan.debug?.ranked?.[0]?.score ?? (plan.confidence === 'high' ? 0.95 : 0.6);

  return {
    skill: agentSkill,
    confidence: plan.confidence || confidenceFor(topScore),
    toolCall,
    hints: registered?.hints?.(goal) ?? agentSkill.hints?.(goal) ?? [],
    actDontAsk: Boolean(registered?.actDontAsk),
    finalizeDirectAnswer: Boolean(registered?.finalizeDirectAnswer),
    plan,
  };
}

/**
 * Pick the best skill for a goal via Router Factory (registry SoT).
 * High-precision skills win when they match; otherwise fallback / clarify.
 */
export function routeGoal(ctx: RouteContext): AgentRoute {
  const router = getDefaultRouter();
  const utterance = ctx.utterance ?? ctx.goal;
  const plan = router.routeSync(utterance, {
    ...ctx,
    goal: ctx.goal || utterance,
    utterance,
  });
  return skillPlanToAgentRoute(plan, utterance);
}

/** Debug / tests: ranked skill scores for a goal (factory registry). */
export function rankSkills(ctx: RouteContext): Array<{ id: string; score: number }> {
  const router = getDefaultRouter();
  const utterance = ctx.utterance ?? ctx.goal;
  const plan = router.routeSync(utterance, { ...ctx, goal: ctx.goal || utterance, utterance });
  return (plan.debug?.ranked ?? []).filter((r) => r.score > 0);
}

/** @deprecated Prefer factory routeSync; kept for SCORE_THRESHOLD consumers. */
export { SCORE_THRESHOLD };
