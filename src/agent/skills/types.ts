import type { ToolCall } from '../types';
import type { PersistentProject, ProjectTemplate } from '../../phil/projectTypes';

/**
 * Stable legacy skill ids — keep this list; do not remove.
 * Canonical v1 ids use dotted namespaces (`reminder.create`) with these as aliases.
 */
export type SkillId =
  | 'reminder'
  | 'goal'
  | 'project'
  | 'focus'
  | 'briefing'
  | 'gmail'
  | 'open_link'
  | 'browse_page'
  | 'live_weather'
  | 'web_lookup'
  | 'memory'
  | 'chat';

/**
 * Confirmation policy for skill execution (SKL-02 / WF-05).
 * Maps roughly to ADR: none→none, confirm→notify/confirm, required→never_auto.
 */
export type ConfirmationLevel =
  /** Run without prompting (e.g. reminder_create, page summarize). */
  | 'none'
  /** Preview / soft confirm for moderate side effects (browse, drafts). */
  | 'confirm'
  /** Hard confirm before irreversible / outbound actions (email send, clear data). */
  | 'required';

export type RouteConfidence = 'high' | 'medium' | 'low';

export type RouteTrigger = 'chat' | 'chip' | 'context_menu' | 'proactive' | 'alarm';

/**
 * Router input context. `goal` remains the primary utterance field used by
 * today's AgentSkill.score path; `utterance` is an alias for the Wave-1
 * route(utterance, context) API.
 */
export type RouteContext = {
  goal: string;
  utterance?: string;
  utteranceNorm?: string;
  emailIntent?: string | null;
  activeProjectId?: string | null;
  activeProject?: PersistentProject | null;
  pageUrl?: string | null;
  pageTitle?: string | null;
  pageHasExtract?: boolean;
  selection?: string | null;
  modelReady?: boolean;
  localHour?: number;
  timeZone?: string;
  nowMs?: number;
  calendarConnected?: boolean;
  memoryEnabled?: boolean;
  /** History permission (or harness seed). */
  historyAvailable?: boolean;
  trigger?: RouteTrigger;
  priorPlan?: SkillPlan | null;
  correctionHint?: string | null;
  recentTurns?: Array<{ role: 'user' | 'assistant'; text: string }>;
  debugRouting?: boolean;
  testMode?: boolean;
};

export type AgentSkill = {
  id: SkillId;
  description: string;
  score: (ctx: RouteContext) => number;
  buildToolCall?: (goal: string) => ToolCall | null;
  finalizeDirectAnswer?: boolean;
  actDontAsk?: boolean;
  hints?: (goal: string) => string[];
  confirmationLevel?: ConfirmationLevel;
};

export type AgentRoute = {
  skill: AgentSkill;
  confidence: RouteConfidence;
  toolCall: ToolCall | null;
  hints: string[];
  actDontAsk: boolean;
  finalizeDirectAnswer: boolean;
  plan?: SkillPlan;
};

export type SkillPermission =
  | 'none'
  | 'tabs'
  | 'history'
  | 'gmail'
  | 'calendar'
  | 'notifications'
  | 'storage'
  | 'scripting'
  | 'identity_gmail'
  | 'storage_memory'
  | 'storage_projects';

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
  params?: Record<string, unknown>;
};

export type SkillExecuteResult = {
  ok: boolean;
  message?: string;
  toolCalls?: ToolCall[];
  artifacts?: Record<string, unknown>;
  error?: string;
};

/**
 * Forward-compatible Skill contract (ADR 0001).
 * Canonical ids use dotted namespaces; `aliases` keep flat legacy ids scoring.
 */
export type Skill = {
  id: string;
  description: string;
  examples?: string[];
  aliases?: string[];
  inputSchema?: SkillInputSchema;
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
    | 'settings_privacy'
    | 'browser'
    | 'browser_memory'
    | 'meta'
    | 'fallback'
    | 'chitchat'
    | 'other';
  projectTemplate?: ProjectTemplate;
  permissions?: SkillPermission[];
  confirmationLevel: ConfirmationLevel;
  priority?: number;
  canHandle?: (ctx: RouteContext) => boolean;
  routeScore: (ctx: RouteContext) => number;
  score?: (ctx: RouteContext) => number | { score: number; reasons?: string[] };
  extractArgs?: (ctx: RouteContext) => Record<string, unknown> | null;
  execute: (args: SkillExecuteArgs) => Promise<SkillExecuteResult> | SkillExecuteResult;
};

export type RegisteredSkill = Skill & {
  legacyId?: SkillId;
  buildToolCall?: AgentSkill['buildToolCall'];
  hints?: AgentSkill['hints'];
  actDontAsk?: boolean;
  finalizeDirectAnswer?: boolean;
};

export type SkillPlanStep = {
  skillId: string;
  params?: Record<string, unknown>;
  args?: Record<string, unknown>;
  confirmationLevel?: ConfirmationLevel;
  confidence?: RouteConfidence;
};

export type SkillPlan = {
  steps: SkillPlanStep[];
  confidence: RouteConfidence;
  lightweight?: boolean;
  shortCircuit?: boolean;
  clarification?: string | null;
  clarifyQuestion?: string;
  debug?: {
    skills: string[];
    scores?: Array<{ id: string; score: number }>;
    stage?: 'stage0' | 'stage1' | 'stage2' | 'clarify' | 'fallback';
    llmRouteCalls?: number;
    ranked?: Array<{ id: string; score: number }>;
  };
};

export type AgentSkillAsSkillMeta = Pick<AgentSkill, 'id' | 'description'> & {
  confirmationLevel: ConfirmationLevel;
  routeScore: AgentSkill['score'];
};
