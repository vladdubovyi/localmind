/**
 * Router Factory contracts (plan §17 Wave-0 freeze).
 * Implementation owned by B1; A1 freezes importable shapes only.
 *
 * Existing runtime entrypoint remains `routeGoal` in `../skills/router.ts`
 * returning `AgentRoute`. New pods should target `route() → SkillPlan`.
 */

import type {
  AgentRoute,
  RouteContext,
  RouteConfidence,
  Skill,
  SkillPlan,
} from '../skills/types';

export type {
  AgentRoute,
  ConfirmationLevel,
  RouteConfidence,
  RouteContext,
  Skill,
  SkillId,
  SkillPlan,
  SkillPlanStep,
  SkillExecuteArgs,
  SkillExecuteResult,
  SkillInputSchema,
  SkillPermission,
} from '../skills/types';

/** Registration options when adding a skill to the factory. */
export type RegisterSkillOptions = {
  /** Replace an existing skill with the same id (tests / hot reload). */
  replace?: boolean;
};

/**
 * Router Factory surface. Methods may throw / return stubs until B1 lands.
 */
export type RouterFactory = {
  registerSkill: (skill: Skill, options?: RegisterSkillOptions) => void;
  unregisterSkill?: (skillId: string) => void;
  listSkills: () => readonly Skill[];
  getSkill: (skillId: string) => Skill | undefined;
  /**
   * Primary routing API (Wave-1+).
   * `utterance` may duplicate `context.utterance` / `context.goal`.
   */
  route: (utterance: string, context: RouteContext) => SkillPlan | Promise<SkillPlan>;
};

/**
 * Bridge from legacy routeGoal → SkillPlan so pods can depend on one shape.
 * Pure type helper; runtime conversion lives in B1.
 */
export type AgentRouteToSkillPlan = (route: AgentRoute) => SkillPlan;

/** Test-mode debug payload attached to SkillPlan.debug. */
export type RouteDebugInfo = NonNullable<SkillPlan['debug']>;

/** Confidence helper alias for telemetry. */
export type RouterConfidence = RouteConfidence;

/**
 * Placeholder: calling execute on an unmigrated skill.
 * Prefer throwing this (or returning { ok: false }) over inventing behavior.
 */
export class NotImplementedError extends Error {
  readonly code = 'NOT_IMPLEMENTED' as const;
  constructor(message = 'Not implemented (Wave 0 contract stub)') {
    super(message);
    this.name = 'NotImplementedError';
  }
}
