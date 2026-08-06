/**
 * Browser agent types — tool-calling local agent that controls Chrome.
 */

export type ToolRisk = 'safe' | 'moderate' | 'dangerous';

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  risk: ToolRisk;
  /** Human label shown in confirm UI */
  confirmLabel?: string;
  parameters: Record<string, ToolParameter>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  /** When true, UI must ask the user before executing */
  needsConfirm?: boolean;
  toolCall?: ToolCall;
}

export interface AgentStep {
  id: string;
  kind: 'user' | 'thought' | 'tool_call' | 'tool_result' | 'confirm' | 'final' | 'error';
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  createdAt: number;
}

export interface AgentSettings {
  enabled: boolean;
  maxSteps: number;
  /** Require confirm for moderate-risk tools too */
  confirmModerate: boolean;
  /** Allow chrome.debugger advanced tools */
  allowDebugger: boolean;
  /** Gmail OAuth client ID (Google Cloud console) */
  gmailClientId: string;
  /** Prefer Gmail API when OAuth is configured; else session DOM */
  gmailMode: 'auto' | 'api' | 'session';
}

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  enabled: false,
  maxSteps: 8,
  confirmModerate: true,
  allowDebugger: false,
  gmailClientId: '',
  /** Session (open Gmail tab) by default — no OAuth client ID required. */
  gmailMode: 'session',
};

export type AgentRuntimeMessage =
  | {
      type: 'AGENT_EXECUTE_TOOL';
      call: ToolCall;
      /** Set when user already confirmed a dangerous/moderate tool */
      confirmed?: boolean;
    }
  | { type: 'AGENT_TOOL_RESULT'; result: ToolResult }
  | { type: 'AGENT_REQUEST_PERMISSIONS'; scopes: string[] }
  | { type: 'AGENT_PERMISSIONS_RESULT'; granted: boolean }
  | { type: 'AGENT_GET_STATUS' }
  | {
      type: 'AGENT_STATUS';
      agentEnabled: boolean;
      permissions: {
        tabs: boolean;
        identity: boolean;
        debugger: boolean;
        allUrls: boolean;
      };
    }
  | {
      type: 'PAGE_ACTION';
      action: 'click' | 'type' | 'fill' | 'submit' | 'highlight' | 'banner' | 'query';
      selector?: string;
      text?: string;
      value?: string;
      fields?: Record<string, string>;
      clear?: boolean;
      limit?: number;
      showBanner?: boolean;
      message?: string;
    }
  | { type: 'PAGE_ACTION_RESULT'; ok: boolean; data?: unknown; error?: string }
  | { type: 'GMAIL_SESSION'; action: 'list' | 'read' | 'compose'; query?: string; id?: string; draft?: GmailDraft }
  | { type: 'GMAIL_SESSION_RESULT'; ok: boolean; data?: unknown; error?: string };

export interface GmailDraft {
  to: string;
  subject: string;
  body: string;
}

export interface GmailMessageSummary {
  id: string;
  threadId?: string;
  from: string;
  subject: string;
  snippet: string;
  date?: string;
}
