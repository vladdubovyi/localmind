import type { AgentSkill } from './types';
import { buildCoreSkills } from './coreSkills';

export { isFactualLookupGoal } from './coreSkills';

/**
 * Legacy AgentSkill array — derived from registered core skills that have a legacyId.
 * Prefer Router Factory `listSkills()` / dotted ids for new code.
 */
export const AGENT_SKILLS: AgentSkill[] = buildCoreSkills()
  .filter((s) => s.legacyId)
  .map((s) => ({
    id: s.legacyId!,
    description: s.description,
    score: (ctx) => s.routeScore(ctx),
    buildToolCall: s.buildToolCall,
    finalizeDirectAnswer: s.finalizeDirectAnswer,
    actDontAsk: s.actDontAsk,
    hints: s.hints,
    confirmationLevel: s.confirmationLevel,
  }));

export function getSkill(id: string): AgentSkill | undefined {
  return AGENT_SKILLS.find((s) => s.id === id);
}

