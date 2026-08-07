import type { ToolCall } from '../types';

/** Stable skill ids — keep this list small; add modules, not one-off ifs. */
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

export type RouteConfidence = 'high' | 'medium' | 'low';

export type RouteContext = {
  goal: string;
  /** Prior email/open-link intent from goalIntent when available. */
  emailIntent?: string | null;
};

export type AgentSkill = {
  id: SkillId;
  /** One-line description for prompts / debugging. */
  description: string;
  /**
   * Score 0–1. Router picks the highest score above the threshold.
   * Prefer high precision; leave ambiguous factual asks to web_lookup.
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
};

export type AgentRoute = {
  skill: AgentSkill;
  confidence: RouteConfidence;
  toolCall: ToolCall | null;
  hints: string[];
  actDontAsk: boolean;
  finalizeDirectAnswer: boolean;
};
