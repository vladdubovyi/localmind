import type { ToolCall } from '../types';
import type { PersistentProject, ProjectTemplate } from '../../phil/projectTypes';

/**
 * Stable skill ids — keep this list small; add modules, not one-off ifs.
 * Existing registry values must not be removed. Forward-compatible dotted ids
 * (e.g. `reminder.create`) may appear as Skill.id strings alongside these.
 */
export type SkillId =
  | 'reminder'
  | 'goal'
  | 'focus'
  | 'briefing'
  | 'gmail'
  | 'open_link'
  | 'browse_page'
  | 'live_weather'
  | 'web_lookup'
  | 'chat';

/**
 * Confirmation policy for skill execution (SKL-02 / WF-05).
 * Use string unions (erasableSyntaxOnly — no TS enums).
 */
export type ConfirmationLevel =
  /** Run without prompting (e.g. reminder_create, page summarize). */
  | 'none'
  /** Preview / soft confirm for moderate side effects (browse, drafts). */
  | 'confirm'
  /** Hard confirm before irreversible / outbound actions (email send, clear data). */
  | 'required';

export type RouteConfidence = 'high' | 'medium' | 'low';

/**
 * Router input context. `goal` remains the primary utterance field used by
 * today's AgentSkill.score path; `utterance` is an alias for the Wave-1
 * route(utterance, context) API.
 */
export type RouteContext = {
  /**
   * User utterance / goal text — required by shipped AgentSkill.score / routeGoal.
   * When building context for Router Factory, also set `utterance` (may equal `goal`).
   */
  goal: string;
  /** Canonical utterance for Router Factory `route(utterance, context)`. */
  utterance?: string;
  /** Prior email/open-link intent from goalIntent when available. */
  emailIntent?: string | null;
  /** Active Persistent Project for this turn (PRJ-04 / RTE-06). */
  activeProjectId?: string | null;
  /** Optional hydrated project snapshot when already loaded. */
  activeProject?: PersistentProject | null;
  /** Current page URL when side panel / content script has one (RTE-05). */
  pageUrl?: string | null;
  /** Current page title when available. */
  pageTitle?: string | null;
  /** Highlighted selection text (SEL-*, WF-12). */
  selection?: string | null;
  /** Whether WebLLM (or stub) is ready for LLM-backed routing/execution. */
  modelReady?: boolean;
  /** Local hour 0–23 for time-of-day routing features (device TZ). */
  localHour?: number;
  /** Test-mode: expose route debug on SkillPlan (RTE-* harness). */
  debugRouting?: boolean;
};

/**
 * Shipped scoring skill used by registry.ts / routeGoal.
 * Wave-1 Skill is the richer contract; AgentSkill remains the runtime shape
 * until B1 migrates registry entries.
 */
export type AgentSkill = {
  id: SkillId;
  /** One-line description for prompts / debugging. */
  description: string;
  /**
   * Score 0–1. Router picks the highest score above the threshold.
   * Prefer high precision; leave ambiguous factual asks to web_lookup.
   * Maps to Skill.routeScore in the forward-compatible Skill contract.
   */
  score: (ctx: RouteContext) => number;
  /** Optional deterministic tool call (fast-path; do not wait for the LLM). */
  buildToolCall?: (goal: string) => ToolCall | null;
  /** If tool returns `data.answer`, finish immediately without more tools. */
  finalizeDirectAnswer?: boolean;
  /** Auto-confirm moderate browse tools for this skill. */
  actDontAsk?: boolean;
  /** Hints injected into the user turn / nudges. */
  hints?: (goal: string) => string[];
  /**
   * Optional confirmation metadata (additive). When absent, infer from
   * actDontAsk / skill id during migration.
   */
  confirmationLevel?: ConfirmationLevel;
};

/** Result of today's routeGoal() — single winning skill + fast-path tool. */
export type AgentRoute = {
  skill: AgentSkill;
  confidence: RouteConfidence;
  toolCall: ToolCall | null;
  hints: string[];
  actDontAsk: boolean;
  finalizeDirectAnswer: boolean;
};

/** Permissions a skill may require before execute (stub for B1/B3/B4). */
export type SkillPermission =
  | 'none'
  | 'tabs'
  | 'history'
  | 'gmail'
  | 'calendar'
  | 'notifications'
  | 'storage';

/**
 * JSON-schema-ish input description for skill parameters.
 * Kept loose so pods can refine without breaking imports.
 */
export type SkillInputSchema = {
  type?: 'object' | 'string' | 'null';
  properties?: Record<string, unknown>;
  required?: string[];
  description?: string;
  [key: string]: unknown;
};

export type SkillExecuteArgs = {
  utterance: string;
  context: RouteContext;
  /** Parameters proposed by the router / prior plan step. */
  params?: Record<string, unknown>;
};

export type SkillExecuteResult = {
  ok: boolean;
  /** User-visible summary when the skill short-circuits. */
  message?: string;
  /** Tool calls to enqueue when the skill defers to the agent loop. */
  toolCalls?: ToolCall[];
  /** Artifacts created (project ids, reminder ids, …). */
  artifacts?: Record<string, unknown>;
  error?: string;
};

/**
 * Forward-compatible Skill contract (plan §17 / Wave-0 freeze).
 * B1 implements registry + execute; A1 only freezes the shape.
 *
 * Mapping from AgentSkill → Skill:
 * - id: SkillId ⊂ string (dotted ids allowed on Skill)
 * - description: same
 * - score(ctx) ↔ routeScore(ctx) / canHandle(ctx)
 * - buildToolCall / hints / finalizeDirectAnswer / actDontAsk → execute impl detail
 * - confirmationLevel ← actDontAsk ? 'none' : skill-specific
 */
export type Skill = {
  /** Stable id; prefer dotted names for new skills (`reminder.create`). */
  id: string;
  description: string;
  /** Few-shot / routing examples (RTE-07 extensibility). */
  examples?: string[];
  inputSchema?: SkillInputSchema;
  /** Coarse category for taxonomy / telemetry. */
  category?:
    | 'reminder'
    | 'goal'
    | 'project'
    | 'research'
    | 'email'
    | 'page'
    | 'selection'
    | 'planning'
    | 'focus'
    | 'memory'
    | 'settings'
    | 'browser'
    | 'fallback'
    | 'other';
  /** Project template this skill owns, when applicable. */
  projectTemplate?: ProjectTemplate;
  permissions?: SkillPermission[];
  confirmationLevel: ConfirmationLevel;
  /** Cheap boolean gate before scoring (optional). */
  canHandle?: (ctx: RouteContext) => boolean;
  /** Score 0–1; mirrors AgentSkill.score. */
  routeScore: (ctx: RouteContext) => number;
  /**
   * Execute the skill. Stub OK until B1/C* implement.
   * Implementations may throw NotImplementedError during Wave 0.
   */
  execute: (args: SkillExecuteArgs) => Promise<SkillExecuteResult> | SkillExecuteResult;
};

/** One step in a SkillPlan (ordered invocations). */
export type SkillPlanStep = {
  skillId: string;
  params?: Record<string, unknown>;
  /** Confidence for this step alone. */
  confidence?: RouteConfidence;
};

/**
 * Ordered skill invocations produced by Router Factory:
 * `route(utterance, context) → SkillPlan`
 */
export type SkillPlan = {
  steps: SkillPlanStep[];
  /** Overall plan confidence. */
  confidence: RouteConfidence;
  /** When true, use lightweight / short-circuit path (RTE-09). */
  lightweight?: boolean;
  /** Clarifying question instead of executing (RTE-03). */
  clarification?: string | null;
  /**
   * Test-mode route debug (RTE-* harness). Populated when
   * RouteContext.debugRouting is true.
   */
  debug?: {
    skills: string[];
    scores?: Array<{ id: string; score: number }>;
  };
};

/** Adapter helper type: promote a shipped AgentSkill toward Skill metadata. */
export type AgentSkillAsSkillMeta = Pick<AgentSkill, 'id' | 'description'> & {
  confirmationLevel: ConfirmationLevel;
  routeScore: AgentSkill['score'];
};
