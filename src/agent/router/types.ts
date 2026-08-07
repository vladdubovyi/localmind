/**
 * Router Factory contracts (ADR 0001 / plan §17).
 * Implementation owned by B1.
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
  RegisteredSkill,
} from '../skills/types';

export type RegisterSkillOptions = {
  replace?: boolean;
};

export type CreateRouterFactoryOptions = {
  shortCircuitThreshold?: number;
  minAcceptThreshold?: number;
  scoreMargin?: number;
  /**
   * Stage-2 WebLLM structured router. Disabled in Wave 1 by default
   * (JSON reliability + latency). Pass enableStage2: true to opt in.
   */
  llmRouter?: {
    route: (input: {
      utterance: string;
      context: RouteContext;
      catalog: Array<Pick<Skill, 'id' | 'description' | 'examples' | 'inputSchema'>>;
    }) => Promise<{
      skillIds: string[];
      argsBySkill?: Record<string, Record<string, unknown>>;
      clarify?: string;
      confidence: number;
    }>;
  };
  enableStage2?: boolean;
  defaultSearchEngine?: 'google';
};

export type RouterFactory = {
  registerSkill: (skill: Skill, options?: RegisterSkillOptions) => void;
  unregisterSkill: (skillId: string) => void;
  listSkills: () => readonly Skill[];
  getSkill: (skillId: string) => Skill | undefined;
  route: (utterance: string, context?: Partial<RouteContext> | RouteContext) => Promise<SkillPlan>;
  routeSync: (utterance: string, context?: Partial<RouteContext> | RouteContext) => SkillPlan;
};

export type AgentRouteToSkillPlan = (route: AgentRoute) => SkillPlan;
export type RouteDebugInfo = NonNullable<SkillPlan['debug']>;
export type RouterConfidence = RouteConfidence;

export class NotImplementedError extends Error {
  readonly code = 'NOT_IMPLEMENTED' as const;
  constructor(message = 'Not implemented (Wave 0 contract stub)') {
    super(message);
    this.name = 'NotImplementedError';
  }
}
