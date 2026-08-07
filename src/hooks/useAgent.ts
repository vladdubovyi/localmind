import { useCallback, useRef, useState } from 'react';
import { getAIProvider } from '@/ai/webllm';
import {
  formatToolResultContent,
  isJsonLookingFinal,
  toolCallLabel,
} from '@/agent/formatStep';
import {
  detectIntent,
  buildDraftArguments,
  inferMaxResults,
  isEmailGoal,
  isOpenLinkGoal,
  isSummarizeGoal,
  looksLikeHallucinatedEmails,
  matchEmailFromGoal,
  nudgeToolExample,
  priorHasGmail,
  resolveEmailTarget,
  rewriteToolCallForIntent,
} from '@/agent/goalIntent';
import {
  offersToActWithoutTools,
} from '@/agent/assistantIntent';
import { routeGoal, type AgentRoute, type RouteContext, type SkillPlan } from '@/agent/skills';
import { buildAgentSystemPrompt, parseToolCalls, stripToolCallMarkup } from '@/agent/parser';
import { getTool, toolsPromptBlock } from '@/agent/tools';
import type { AgentSettings, AgentStep, ToolCall, ToolResult } from '@/agent/types';
import { getAgentSettings } from '@/storage/agentSettings';
import { getSettings } from '@/storage/db';
import { uid } from '@/utils';

/** Last route plan for test-mode harness (RTE-*). */
let lastRoutePlan: SkillPlan | null = null;

export function getLastRoutePlan(): SkillPlan | null {
  return lastRoutePlan;
}

async function readActivePageMeta(): Promise<{
  pageUrl?: string;
  pageTitle?: string;
}> {
  try {
    const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    const tab = tabs.find((t) => t.url && /^https?:/i.test(t.url));
    if (!tab?.url) return {};
    return { pageUrl: tab.url, pageTitle: tab.title };
  } catch {
    return {};
  }
}

async function readActiveProjectMeta(): Promise<{
  activeProjectId?: string | null;
  activeProject?: RouteContext['activeProject'];
}> {
  try {
    const stored = await chrome.storage.local.get(['philActiveProject', 'activeProjectId']);
    const activeProjectId =
      (stored.activeProjectId as string | undefined) ??
      ((stored.philActiveProject as { id?: string } | undefined)?.id ?? null);
    const snap = stored.philActiveProject as RouteContext['activeProject'] | undefined;
    return {
      activeProjectId: activeProjectId ?? null,
      activeProject: snap ?? null,
    };
  } catch {
    return {};
  }
}

function recentTurnsFromSteps(steps: AgentStep[]): RouteContext['recentTurns'] {
  const turns: NonNullable<RouteContext['recentTurns']> = [];
  for (const s of steps.slice(-12)) {
    if (s.kind === 'user') turns.push({ role: 'user', text: s.content });
    else if (s.kind === 'final') turns.push({ role: 'assistant', text: s.content });
  }
  return turns;
}

async function resolveRoute(goal: string, priorSteps: AgentStep[]): Promise<AgentRoute> {
  const emailIntent = detectIntent(goal, priorSteps);
  const [{ pageUrl, pageTitle }, projectMeta, settings] = await Promise.all([
    readActivePageMeta(),
    readActiveProjectMeta(),
    getSettings().catch(() => null),
  ]);

  const testMode =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('philTest') ||
      Boolean((window as unknown as { __PHIL_TEST_MODE__?: boolean }).__PHIL_TEST_MODE__));

  const correctionHint = /\b(no,?\s*i meant|i meant set a reminder)\b/i.test(goal)
    ? goal
    : null;

  const ctx: RouteContext = {
    goal,
    utterance: goal,
    emailIntent,
    pageUrl: pageUrl ?? null,
    pageTitle: pageTitle ?? null,
    pageHasExtract: Boolean(pageUrl),
    ...projectMeta,
    modelReady: true,
    memoryEnabled: settings?.memoryEnabled !== false,
    historyAvailable: undefined,
    recentTurns: recentTurnsFromSteps(priorSteps),
    priorPlan: lastRoutePlan,
    correctionHint,
    testMode,
    debugRouting: testMode,
    trigger: 'chat',
  };

  try {
    const { hasHistoryPermission } = await import('@/storage/browserMemory');
    ctx.historyAvailable = await hasHistoryPermission();
  } catch {
    ctx.historyAvailable = false;
  }

  const route = routeGoal(ctx);
  lastRoutePlan = route.plan ?? null;

  if (testMode && typeof window !== 'undefined') {
    const w = window as unknown as {
      __PHIL_LAST_ROUTE__?: unknown;
    };
    w.__PHIL_LAST_ROUTE__ = {
      skills: route.plan?.debug?.skills ?? [],
      stage: route.plan?.debug?.stage,
      shortCircuit: route.plan?.shortCircuit ?? route.plan?.lightweight,
      confidence: route.confidence,
      clarification: route.plan?.clarification ?? null,
      llmRouteCalls: route.plan?.debug?.llmRouteCalls ?? 0,
      'route.skills': route.plan?.debug?.skills ?? [],
    };
  }

  return route;
}

async function executeTool(call: ToolCall, confirmed = false): Promise<ToolResult> {
  try {
    const result = (await chrome.runtime.sendMessage({
      type: 'AGENT_EXECUTE_TOOL',
      call,
      confirmed,
    })) as ToolResult | undefined;
    if (result && typeof result === 'object') {
      // Side-channel fallback if an older/broken SW rejects Phil tools.
      if (
        !result.ok &&
        typeof result.error === 'string' &&
        /unknown tool/i.test(result.error) &&
        (call.name === 'reminder_create' ||
          call.name === 'goal_create' ||
          call.name.startsWith('project_'))
      ) {
        return executePhilToolLocally(call);
      }
      return result;
    }
  } catch (err) {
    if (
      call.name === 'reminder_create' ||
      call.name === 'goal_create' ||
      call.name.startsWith('project_')
    ) {
      try {
        return await executePhilToolLocally(call);
      } catch {
        // fall through
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      toolCall: call,
    };
  }
  if (
    call.name === 'reminder_create' ||
    call.name === 'goal_create' ||
    call.name.startsWith('project_')
  ) {
    return executePhilToolLocally(call);
  }
  return {
    ok: false,
    error: 'No response from the background tool router. Try reloading the extension.',
    toolCall: call,
  };
}

/** UI-side Phil tool execution when the service worker router is unavailable. */
async function executePhilToolLocally(call: ToolCall): Promise<ToolResult> {
  if (call.name === 'reminder_create') {
    const { createReminderFromUi } = await import('@/phil/clientActions');
    const text = String(call.arguments.text ?? '').trim();
    const inMinutes = Number(call.arguments.inMinutes);
    const whenArg = Number(call.arguments.when);
    const when = Number.isFinite(whenArg)
      ? whenArg
      : Date.now() + (Number.isFinite(inMinutes) && inMinutes > 0 ? inMinutes : 30) * 60_000;
    if (!text) {
      return { ok: false, error: 'text is required', toolCall: call };
    }
    const reminder = await createReminderFromUi({ text, when });
    return { ok: true, data: reminder, toolCall: call };
  }
  if (call.name === 'goal_create') {
    const { createGoalFromUi } = await import('@/phil/clientActions');
    const title = String(call.arguments.title ?? '').trim();
    if (!title) {
      return { ok: false, error: 'title is required', toolCall: call };
    }
    const goal = await createGoalFromUi(title);
    return { ok: true, data: goal, toolCall: call };
  }
  if (call.name === 'project_create') {
    const { createProjectFromUi } = await import('@/phil/clientActions');
    const title = String(call.arguments.title ?? '').trim();
    if (!title) {
      return { ok: false, error: 'title is required', toolCall: call };
    }
    const templateRaw = String(call.arguments.template ?? '');
    const { project, goal } = await createProjectFromUi({
      title,
      template: (templateRaw || undefined) as
        | 'career'
        | 'job_hunt'
        | 'research'
        | 'exec_day'
        | 'life_move'
        | 'custom'
        | undefined,
    });
    return {
      ok: true,
      data: {
        project,
        goal,
        message: `I've set up your ${project.title} project.`,
      },
      toolCall: call,
    };
  }
  if (call.name === 'project_list') {
    const { listProjects, getActiveProjectId } = await import('@/storage/projects');
    const projects = await listProjects();
    const activeProjectId = await getActiveProjectId();
    return { ok: true, data: { projects, activeProjectId }, toolCall: call };
  }
  if (call.name === 'project_set_active') {
    const { getProject, setActiveProjectId } = await import('@/storage/projects');
    const id = String(call.arguments.id ?? call.arguments.projectId ?? '');
    const project = await getProject(id);
    if (!project) return { ok: false, error: `No project ${id}`, toolCall: call };
    const selection = await setActiveProjectId(id);
    return { ok: true, data: { selection, project }, toolCall: call };
  }
  if (call.name === 'project_get' || call.name === 'project_progress') {
    const { getProject, getActiveProject, formatProjectProgress } = await import(
      '@/storage/projects'
    );
    const id = String(call.arguments.id ?? call.arguments.projectId ?? '');
    const project = id ? await getProject(id) : await getActiveProject();
    if (!project) {
      return {
        ok: false,
        error: id ? `No project ${id}` : 'No active project',
        toolCall: call,
      };
    }
    return {
      ok: true,
      data: { project, progress: formatProjectProgress(project) },
      toolCall: call,
    };
  }

  if (call.name.startsWith('memory_')) {
    const { forgetMemory, listMemories, rememberMemory, searchMemories } = await import('@/storage/memory');
    const { getSettings } = await import('@/storage/db');
    if (call.name === 'memory_remember') {
      const settings = await getSettings();
      if (!settings.memoryEnabled) {
        return { ok: false, error: 'Memory is off. Enable Memory in Privacy / Settings to store new facts.', toolCall: call };
      }
      const text = String(call.arguments.text ?? '').trim();
      if (!text) return { ok: false, error: 'text is required', toolCall: call };
      const entry = await rememberMemory(text, { projectId: String(call.arguments.projectId ?? '') || undefined, source: 'tool' });
      return { ok: true, data: { ...entry, answer: `Got it — I’ll remember that: ${entry.text}` }, toolCall: call };
    }
    if (call.name === 'memory_forget') {
      const removed = await forgetMemory(String(call.arguments.id ?? call.arguments.text ?? '').trim());
      if (!removed) return { ok: false, error: 'No matching memory found to forget.', toolCall: call };
      return { ok: true, data: { removed, answer: `Forgotten: ${removed.text}` }, toolCall: call };
    }
    if (call.name === 'memory_search' || call.name === 'memory_list') {
      const query = String(call.arguments.query ?? '');
      const limit = Number(call.arguments.limit);
      const hits = call.name === 'memory_list'
        ? (await listMemories()).slice(0, Number.isFinite(limit) && limit > 0 ? limit : 20).map((m) => ({ ...m, score: 0 }))
        : await searchMemories(query, Number.isFinite(limit) ? limit : 10);
      const answer = hits.length
        ? hits.map((m, i) => `${i + 1}. ${m.text}`).join('\n')
        : query ? `No memories matched “${query}”.` : 'No memories stored yet.';
      return { ok: true, data: { memories: hits, answer }, toolCall: call };
    }
  }
  return { ok: false, error: `Unknown tool: ${call.name}`, toolCall: call };
}

function humanizeFinal(content: string): string {
  const trimmed = content.trim();
  if (!isJsonLookingFinal(trimmed)) return content;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (
      Array.isArray(parsed) &&
      parsed[0] &&
      typeof parsed[0] === 'object' &&
      'subject' in (parsed[0] as object)
    ) {
      return formatToolResultContent('gmail_list', { ok: true, data: parsed });
    }
  } catch {
    // not JSON — keep as-is
  }
  return content;
}

/** True only when the reply looks like a structured tool attempt, not mere tool-name chatter. */
function looksLikeMalformedToolCall(text: string): boolean {
  if (/<tool_call>[\s\S]*?<\/tool_call>/i.test(text)) return true;
  if (/TOOL_CALL:\s*\{/i.test(text)) return true;
  if (/```(?:tool|json)?[\s\S]*?"name"\s*:/i.test(text)) return true;
  if (/\{\s*"name"\s*:\s*"[a-z][a-z0-9_]+"/.test(text)) return true;
  if (/\b[a-z][a-z0-9_]+\s*\(\s*\{/.test(text)) {
    const m = text.match(/\b([a-z][a-z0-9_]+)\s*\(\s*\{/i);
    if (m && getTool(m[1])) return true;
  }
  // gmail_list(query: "…") without braces
  if (/\b[a-z][a-z0-9_]+\s*\(\s*[A-Za-z_]/.test(text)) {
    const m = text.match(/\b([a-z][a-z0-9_]+)\s*\(/i);
    if (m && getTool(m[1])) return true;
  }
  if (/\b[a-z][a-z0-9_]+\s*\{/.test(text)) {
    const m = text.match(/\b([a-z][a-z0-9_]+)\s*\{/i);
    if (m && getTool(m[1])) return true;
  }
  return false;
}

/** Model said it would use a tool but didn't emit a call. */
function narratesToolUse(text: string): boolean {
  return (
    /\b(gmail_list|gmail_read|gmail_draft|gmail_send|page_read|tabs_create|tabs_navigate|reminder_create|focus_summary|briefing_today|web_research|goal_create|use the \w+ tool|fetch the emails|call the tool)\b/i.test(
      text,
    ) || offersToActWithoutTools(text)
  );
}

/** Informational browse tools should not pause on Allow for lookup skills. */
function shouldAutoConfirmTool(route: AgentRoute, name: string): boolean {
  if (!route.actDontAsk) return false;
  return name === 'web_research' || name === 'tabs_create' || name === 'tabs_navigate';
}

function researchAnswerFromResult(result: ToolResult | undefined): string | null {
  if (!result?.ok || !result.data || typeof result.data !== 'object') return null;
  const answer = (result.data as { answer?: unknown }).answer;
  return typeof answer === 'string' && answer.trim() ? answer.trim() : null;
}

function latestResearchAnswer(steps: AgentStep[]): string | null {
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const s = steps[i];
    if (s.kind === 'tool_result' && s.toolCall?.name === 'web_research') {
      return researchAnswerFromResult(s.toolResult);
    }
  }
  return null;
}

/** Same tool spammed after research — stop instead of blowing the context window. */
function isStuckToolLoop(steps: AgentStep[], name: string): boolean {
  let streak = 0;
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const s = steps[i];
    if (s.kind !== 'tool_call' && s.kind !== 'tool_result' && s.kind !== 'error') break;
    if (s.toolCall?.name === name) streak += 1;
    else if (s.kind === 'tool_call' || s.kind === 'tool_result') break;
  }
  return streak >= 2;
}

/** Compact prior transcript so follow-up goals keep context. */
function priorConversationContext(steps: AgentStep[]): string {
  const parts: string[] = [];
  for (const s of steps.slice(-24)) {
    if (s.kind === 'user') parts.push(`User: ${s.content}`);
    else if (s.kind === 'final') parts.push(`Assistant: ${s.content}`);
    else if (s.kind === 'tool_result' && s.toolCall) {
      parts.push(`Tool ${s.toolCall.name} result:\n${s.content.slice(0, 1800)}`);
    }
  }
  return parts.join('\n\n').slice(0, 7000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildUserTurn(
  goal: string,
  priorSteps: AgentStep[],
  priorContext: string,
  route: AgentRoute,
): string {
  const philHints = route.hints;
  if (!priorContext) {
    if (!philHints.length) return goal;
    return [
      goal,
      '',
      `Routed skill: ${route.skill.id} (${route.confidence}) — ${route.skill.description}`,
      ...philHints,
    ].join('\n');
  }

  const intent = detectIntent(goal, priorSteps);
  const matched = resolveEmailTarget(goal, priorSteps);
  const lines = [
    'Earlier in this agent conversation (use for context — especially email ids/subjects/URLs):',
    priorContext,
    '',
    `New request: ${goal}`,
    `Routed skill: ${route.skill.id} (${route.confidence}) — ${route.skill.description}`,
  ];

  if (intent === 'email_draft') {
    const draft = buildDraftArguments(goal, priorSteps);
    lines.push(
      'The user wants a Gmail DRAFT opened (Compose), not just chat text.',
      'Call gmail_draft now with to/subject/body. Do NOT call gmail_read.',
      draft.to ? `Suggested to: ${draft.to}` : 'Pick to: from the earlier gmail_list From: field.',
      `Suggested subject: ${draft.subject}`,
      `Suggested body:\n${draft.body.slice(0, 500)}`,
      'Do NOT auto-send. Do NOT open Wikipedia/WebGPU.',
    );
  } else if (intent === 'email_read') {
    lines.push(
      'This is an email follow-up. Call gmail_read with the message id from gmail_list.',
      matched
        ? `Best matching message id: ${matched.id} (subject: ${matched.subject}).`
        : 'If you lack an id, call gmail_list first.',
      'Do NOT open Wikipedia, WebGPU, or Gmail atom/feed URLs.',
      'Do NOT invent email body text — only summarize tool results.',
    );
  } else if (intent === 'email_list') {
    lines.push(
      'Call gmail_list only. Do not navigate to atom feeds. Do not invent senders/subjects.',
    );
  } else if (intent === 'open_link' || route.skill.id === 'open_link') {
    lines.push('Prefer tabs_create with the real https URL from context.');
  } else if (philHints.length) {
    lines.push(...philHints);
  } else {
    lines.push('Execute tools only if needed for this request. Stay on-topic.');
  }

  return lines.join('\n');
}

function continueAfterToolPrompt(
  goal: string,
  priorSteps: AgentStep[],
  call: ToolCall,
  result: ToolResult,
): string {
  const intent = detectIntent(goal, priorSteps);
  const formatted = result.ok
    ? formatToolResultContent(call.name, result)
    : `ERROR: ${result.error}`;
  const lines = [
    `Original goal: ${goal}`,
    `Tool ${call.name} result (already fetched — use this data):`,
    formatted.slice(0, 4000),
    'Output ONLY one <tool_call> … </tool_call> OR the final markdown answer for the user.',
    'Do not invent fake emails, dialogues, or tool results.',
    'Do not dump raw JSON in the final answer.',
    'Do not open Wikipedia/WebGPU unless the user asked for that.',
  ];

  if (!result.ok) {
    if (intent === 'email_draft') {
      lines.push(
        'Draft failed. Call gmail_draft again with to, subject, and body. Do not call gmail_read.',
      );
    } else if (intent === 'email_list' || intent === 'email_read') {
      lines.push(
        'Stay on email tools. Prefer gmail_list or gmail_read. Never use Gmail atom/feed URLs.',
      );
    } else {
      lines.push(
        'That tool failed. Choose a different next step that still advances the original goal.',
        'Do not invent tab IDs.',
      );
    }
  } else if (call.name === 'gmail_draft' || call.name === 'gmail_send') {
    lines.push(
      'The Gmail compose draft is open. Tell the user briefly what was drafted (to/subject) and that they can click Send in Gmail.',
      'Do not call more tools. Do not claim the email was sent unless gmail_send API mode was used successfully.',
    );
  } else if (call.name === 'gmail_list') {
    if (intent === 'email_draft') {
      const draft = buildDraftArguments(goal, [
        ...priorSteps,
        {
          id: 'tmp',
          kind: 'tool_result',
          content: '',
          createdAt: Date.now(),
          toolCall: call,
          toolResult: result,
        },
      ]);
      lines.push(
        'You have the inbox list. Now open a draft with gmail_draft:',
        `to=${draft.to || '(from matching message)'} subject=${draft.subject}`,
        'Do NOT call gmail_read.',
      );
    } else if (intent === 'email_read' || isSummarizeGoal(goal)) {
      const list = Array.isArray(result.data)
        ? (result.data as import('@/agent/types').GmailMessageSummary[])
        : [];
      const matched =
        matchEmailFromGoal(goal, list) ||
        resolveEmailTarget(goal, [
          ...priorSteps,
          {
            id: 'tmp',
            kind: 'tool_result',
            content: '',
            createdAt: Date.now(),
            toolCall: call,
            toolResult: result,
          },
        ]);
      lines.push(
        matched
          ? `Next call gmail_read with {"id":"${matched.id}"} then summarize that email only.`
          : 'Next call gmail_read with the matching message id from the list, then summarize.',
        'Do NOT open unrelated tabs.',
      );
    } else {
      const max = Number(call.arguments.maxResults);
      const n = Number.isFinite(max) && max > 0 ? Math.floor(max) : inferMaxResults(goal);
      lines.push(
        n != null
          ? `You already have the inbox list. Write the FINAL answer now as a short numbered list of the ${n} emails.`
          : 'You already have the inbox list. Write the FINAL answer now as a short numbered list.',
        'Format each item as: **Subject** — From (short clean snippet). Include only real tool data.',
        'Do NOT call gmail_list again. Do NOT invent emails. Do NOT output JSON.',
      );
    }
  } else if (call.name === 'gmail_read') {
    if (intent === 'email_draft') {
      const draft = buildDraftArguments(goal, priorSteps);
      lines.push(
        'Wrong tool for drafting. Now call gmail_draft to open Compose with the reply text.',
        `Use to=${draft.to || 'sender from list'}, subject=${draft.subject}, body from the user/assistant draft text.`,
      );
    } else {
      lines.push(
        'Summarize this email for the user now in a few sentences. Do not call more tools. Do not open other pages.',
      );
    }
  } else if (call.name === 'tabs_create') {
    const id = (result.data as { id?: number } | undefined)?.id;
    if (intent === 'email_list' || intent === 'email_read' || intent === 'email_draft') {
      lines.push(
        intent === 'email_draft'
          ? 'Wrong tool. Call gmail_draft to open a Compose draft in Gmail.'
          : 'Wrong tool for email. Ignore this tab. Call gmail_list or gmail_read instead. Do not page_read Wikipedia.',
      );
    } else if (isOpenLinkGoal(goal) && !isSummarizeGoal(goal)) {
      lines.push(
        'The new tab is open. Give a brief final confirmation to the user.',
        'Do not call more tools unless they asked you to read or summarize the page.',
      );
    } else {
      lines.push(
        id != null
          ? `Next call page_read with {"tabId":${id}} (the tab just opened). Then summarize.`
          : 'Next call page_read (omit tabId if needed), then summarize.',
      );
    }
  } else if (call.name === 'tabs_navigate') {
    if (intent === 'email_list' || intent === 'email_read' || intent === 'email_draft') {
      lines.push(
        intent === 'email_draft'
          ? 'Wrong approach. Call gmail_draft.'
          : 'Wrong approach for email. Call gmail_list or gmail_read. Never use atom feeds.',
      );
    } else {
      lines.push(
        'Navigation completed. Confirm briefly for the user. Do not call more tools unless they asked for a page summary.',
      );
    }
  } else if (call.name === 'page_read' || call.name === 'page_query') {
    if (intent === 'email_list' || intent === 'email_read' || intent === 'email_draft') {
      lines.push(
        intent === 'email_draft'
          ? 'Unrelated page read. Call gmail_draft with the reply body.'
          : 'This page read is unrelated to the email goal. Call gmail_read (or gmail_list) and summarize the email only.',
      );
    } else {
      lines.push(
        'If you have enough page content, give the final answer now. Do not call more tools unless needed.',
      );
    }
  } else if (call.name === 'web_research') {
    const answer = researchAnswerFromResult(result);
    if (answer) {
      lines.push(
        'You already have the answer text above. Output the FINAL markdown answer now.',
        'Do NOT call tabs_list, page_read, tabs_create, or web_research again.',
        'Do NOT invent tab ids. Do NOT say you lack weather access.',
      );
    } else {
      lines.push(
        'Answer the user now from these research findings (plain language).',
        'Only if a finding includes a real tabId, you may page_read that id once — never invent tabId 1.',
        'Never call tabs_list in a loop.',
      );
    }
  } else {
    lines.push('Continue. Call another tool if needed, or give the final answer in markdown.');
  }

  return lines.join('\n');
}

export function useAgent() {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [running, setRunning] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<ToolCall | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const confirmResolver = useRef<((ok: boolean) => void) | null>(null);
  const stepsRef = useRef<AgentStep[]>([]);

  const pushStep = useCallback((step: Omit<AgentStep, 'id' | 'createdAt'>) => {
    const full: AgentStep = { ...step, id: uid('step'), createdAt: Date.now() };
    setSteps((prev) => {
      const next = [...prev, full];
      stepsRef.current = next;
      return next;
    });
    return full;
  }, []);

  const clearHistory = useCallback(() => {
    if (running) return;
    stepsRef.current = [];
    setSteps([]);
    setError(null);
  }, [running]);

  const waitForConfirm = useCallback((call: ToolCall) => {
    setPendingConfirm(call);
    return new Promise<boolean>((resolve) => {
      confirmResolver.current = resolve;
    });
  }, []);

  const resolveConfirm = useCallback((ok: boolean) => {
    setPendingConfirm(null);
    confirmResolver.current?.(ok);
    confirmResolver.current = null;
  }, []);

  const stop = useCallback(() => {
    abortRef.current = true;
    void getAIProvider().cancel();
    resolveConfirm(false);
    setRunning(false);
  }, [resolveConfirm]);

  const run = useCallback(
    async (goal: string) => {
      abortRef.current = false;
      setError(null);
      setRunning(true);

      const priorSteps = stepsRef.current;
      const priorContext = priorConversationContext(priorSteps);
      const intent = detectIntent(goal, priorSteps);
      const route = await resolveRoute(goal, priorSteps);

      pushStep({ kind: 'user', content: goal });

      try {
        const agentSettings = await getAgentSettings();
        if (!agentSettings.enabled) {
          throw new Error('Enable Agent mode in settings first.');
        }

        // Clarify short-circuit (RTE-03) — no durable artifacts.
        if (route.plan?.clarification || route.plan?.debug?.stage === 'clarify') {
          const q =
            route.plan.clarification ||
            route.plan.clarifyQuestion ||
            'Could you share a bit more context?';
          pushStep({
            kind: 'thought',
            content: 'Need a bit more context…',
          });
          if (route.plan?.debug) {
            pushStep({
              kind: 'thought',
              content: `route.skills = [${route.plan.debug.skills.join(', ')}] · stage=${route.plan.debug.stage}`,
            });
          }
          pushStep({ kind: 'final', content: q });
          return;
        }

        if (route.plan?.debug?.skills?.length) {
          const testMode =
            typeof window !== 'undefined' &&
            (new URLSearchParams(window.location.search).has('philTest') ||
              Boolean((window as unknown as { __PHIL_TEST_MODE__?: boolean }).__PHIL_TEST_MODE__));
          if (testMode) {
            pushStep({
              kind: 'thought',
              content: `route.skills = [${route.plan.debug.skills.join(', ')}] · stage=${route.plan.debug.stage}${
                route.plan.shortCircuit || route.plan.lightweight ? ' · short-circuit' : ''
              }`,
            });
          }
        }

        // Skill router: deterministic tools run before the LLM when possible.
        const fastCall = route.toolCall;
        let researchSeed:
          | { call: ToolCall; result: ToolResult }
          | null = null;

        if (fastCall && fastCall.name !== 'web_research' && route.finalizeDirectAnswer) {
          pushStep({
            kind: 'thought',
            content: `Skill: ${route.skill.id}…`,
          });
          pushStep({
            kind: 'tool_call',
            content: toolCallLabel(fastCall.name, fastCall.arguments),
            toolCall: fastCall,
          });
          let result = await executeTool(fastCall, shouldAutoConfirmTool(route, fastCall.name));
          if (!result || typeof result !== 'object') {
            result = {
              ok: false,
              error: 'No response from the background tool router. Try reloading the extension.',
              toolCall: fastCall,
            };
          }
          if (result.needsConfirm && result.toolCall) {
            pushStep({
              kind: 'confirm',
              content: `Confirm: ${getTool(fastCall.name)?.confirmLabel ?? fastCall.name}`,
              toolCall: fastCall,
            });
            const ok = await waitForConfirm(fastCall);
            if (!ok || abortRef.current) {
              pushStep({ kind: 'error', content: 'User cancelled the action.' });
              return;
            }
            result = await executeTool(fastCall, true);
          }
          pushStep({
            kind: result.ok ? 'tool_result' : 'error',
            content: result.ok
              ? formatToolResultContent(fastCall.name, result)
              : result.error || 'Tool failed',
            toolCall: fastCall,
            toolResult: result,
          });
          if (result.ok) {
            pushStep({
              kind: 'final',
              content: formatToolResultContent(fastCall.name, result),
            });
          } else if (
            (fastCall.name.startsWith('memory_') || fastCall.name.startsWith('browser_memory_')) &&
            result.error
          ) {
            pushStep({ kind: 'final', content: result.error });
          }
          return;
        }

        if (fastCall?.name === 'web_research') {
          pushStep({
            kind: 'thought',
            content: `Skill: ${route.skill.id} — looking that up…`,
          });
          pushStep({
            kind: 'tool_call',
            content: toolCallLabel(fastCall.name, fastCall.arguments),
            toolCall: fastCall,
          });
          let result = await executeTool(fastCall, shouldAutoConfirmTool(route, fastCall.name));
          if (!result || typeof result !== 'object') {
            result = {
              ok: false,
              error: 'No response from the background tool router. Try reloading the extension.',
              toolCall: fastCall,
            };
          }
          if (result.needsConfirm && result.toolCall) {
            pushStep({
              kind: 'confirm',
              content: `Confirm: ${getTool(fastCall.name)?.confirmLabel ?? fastCall.name}`,
              toolCall: fastCall,
            });
            const ok = await waitForConfirm(fastCall);
            if (!ok || abortRef.current) {
              pushStep({ kind: 'error', content: 'User cancelled the action.' });
              return;
            }
            result = await executeTool(fastCall, true);
          }
          pushStep({
            kind: result.ok ? 'tool_result' : 'error',
            content: result.ok
              ? formatToolResultContent(fastCall.name, result)
              : result.error || 'Tool failed',
            toolCall: fastCall,
            toolResult: result,
          });
          if (!result.ok) {
            pushStep({
              kind: 'error',
              content: result.error || 'Web research failed.',
            });
            return;
          }
          const directAnswer = researchAnswerFromResult(result);
          if (directAnswer && route.finalizeDirectAnswer) {
            pushStep({ kind: 'final', content: directAnswer });
            return;
          }
          researchSeed = { call: fastCall, result };
        }

        const provider = getAIProvider();
        if (!provider.isReady()) {
          pushStep({
            kind: 'thought',
            content: 'Thinking…',
          });
          // Model restores in the background — keep the chat interactive.
          const started = Date.now();
          while (!provider.isReady() && !abortRef.current) {
            if (Date.now() - started > 10 * 60_000) {
              throw new Error('Timed out waiting for the local model to load.');
            }
            await sleep(400);
          }
          if (abortRef.current) return;
        }

        const appSettings = await getSettings();
        if (!provider.isReady()) {
          throw new Error('Load the local model before running the agent.');
        }

        const system = [
          buildAgentSystemPrompt(appSettings.generation.systemPrompt),
          '',
          'Available tools:',
          toolsPromptBlock(),
        ].join('\n');

        const history: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: system },
          { role: 'user', content: buildUserTurn(goal, priorSteps, priorContext, route) },
        ];

        let stepsLeft = agentSettings.maxSteps;
        let formatNudgesLeft = 2;
        let gotSuccessfulGmail = priorHasGmail(priorSteps);
        let gotSuccessfulTool = Boolean(researchSeed);

        if (researchSeed) {
          history.push({
            role: 'assistant',
            content: `<tool_call>\n${JSON.stringify({ name: researchSeed.call.name, arguments: researchSeed.call.arguments })}\n</tool_call>`,
          });
          history.push({
            role: 'user',
            content: continueAfterToolPrompt(
              goal,
              stepsRef.current,
              researchSeed.call,
              researchSeed.result,
            ),
          });
        }

        while (stepsLeft > 0 && !abortRef.current) {
          stepsLeft -= 1;

          const reply = await provider.chat({
            messages: history,
            temperature: Math.min(appSettings.generation.temperature, 0.2),
            topP: appSettings.generation.topP,
            maxTokens: Math.min(appSettings.generation.maxTokens, 768),
            stream: false,
          });

          if (abortRef.current) break;

          const calls = parseToolCalls(reply);
          const visible = stripToolCallMarkup(reply);

          if (!calls.length) {
            const hallucinated =
              looksLikeHallucinatedEmails(visible || reply) && !gotSuccessfulGmail;
            const needsEmailTool =
              (intent === 'email_list' || intent === 'email_read') && !gotSuccessfulGmail;
            const needsRead =
              intent === 'email_read' &&
              gotSuccessfulGmail &&
              !stepsRef.current.some(
                (s) =>
                  s.kind === 'tool_result' && s.toolCall?.name === 'gmail_read' && s.toolResult?.ok,
              ) &&
              isSummarizeGoal(goal);
            const needsDraft =
              intent === 'email_draft' &&
              !stepsRef.current.some(
                (s) =>
                  s.kind === 'tool_result' &&
                  (s.toolCall?.name === 'gmail_draft' || s.toolCall?.name === 'gmail_send') &&
                  s.toolResult?.ok,
              );
            const needsPhilTool =
              Boolean(route.toolCall) &&
              route.skill.id !== 'gmail' &&
              route.skill.id !== 'chat' &&
              !gotSuccessfulTool;

            const offeredBrowse = offersToActWithoutTools(visible || reply);
            const shouldNudge =
              formatNudgesLeft > 0 &&
              (hallucinated ||
                needsEmailTool ||
                needsRead ||
                needsDraft ||
                needsPhilTool ||
                offeredBrowse ||
                looksLikeMalformedToolCall(reply) ||
                narratesToolUse(reply) ||
                ((isEmailGoal(goal) ||
                  isOpenLinkGoal(goal) ||
                  intent === 'email_draft' ||
                  route.actDontAsk) &&
                  !gotSuccessfulTool &&
                  stepsLeft > 0));

            if (shouldNudge) {
              formatNudgesLeft -= 1;

              // Prefer executing a concrete tool over asking the model again.
              const forcedPhil = route.toolCall;
              const forcedEmail =
                !forcedPhil && (needsEmailTool || narratesToolUse(reply)) && intent === 'email_list'
                  ? ({
                      id: uid('call'),
                      name: 'gmail_list',
                      arguments: {
                        query: 'newer_than:14d',
                        maxResults: inferMaxResults(goal) ?? 5,
                      },
                    } satisfies ToolCall)
                  : null;
              const forced = forcedPhil ?? forcedEmail;

              if (forced) {
                pushStep({
                  kind: 'thought',
                  content:
                    forced.name === 'web_research'
                      ? `Skill ${route.skill.id}: opening the web…`
                      : forcedPhil
                        ? `Skill ${route.skill.id}: running tool…`
                        : 'Calling gmail_list instead of narrating…',
                });
                pushStep({
                  kind: 'tool_call',
                  content: toolCallLabel(forced.name, forced.arguments),
                  toolCall: forced,
                });
                let okResult: ToolResult =
                  (await executeTool(forced, shouldAutoConfirmTool(route, forced.name))) ?? {
                    ok: false,
                    error: 'No response from the background tool router.',
                    toolCall: forced,
                  };
                if (typeof okResult !== 'object') {
                  okResult = {
                    ok: false,
                    error: 'No response from the background tool router.',
                    toolCall: forced,
                  };
                }
                if (okResult.needsConfirm && okResult.toolCall) {
                  pushStep({
                    kind: 'confirm',
                    content: `Confirm: ${getTool(forced.name)?.confirmLabel ?? forced.name}`,
                    toolCall: forced,
                  });
                  const ok = await waitForConfirm(forced);
                  if (!ok || abortRef.current) {
                    pushStep({ kind: 'error', content: 'User cancelled the action.' });
                    break;
                  }
                  okResult =
                    (await executeTool(forced, true)) ?? {
                      ok: false,
                      error: 'No response from the background tool router.',
                      toolCall: forced,
                    };
                }
                if (okResult.ok && forced.name === 'gmail_list') {
                  gotSuccessfulGmail = true;
                  gotSuccessfulTool = true;
                }
                if (okResult.ok) gotSuccessfulTool = true;
                pushStep({
                  kind: okResult.ok ? 'tool_result' : 'error',
                  content: okResult.ok
                    ? formatToolResultContent(forced.name, okResult)
                    : okResult.error || 'Tool failed',
                  toolCall: forced,
                  toolResult: okResult,
                });
                if (okResult.ok) {
                  // Instant Phil tools can finish; research/email need a model summary turn.
                  if (forcedPhil && forced.name !== 'web_research') {
                    pushStep({
                      kind: 'final',
                      content: formatToolResultContent(forced.name, okResult),
                    });
                    return;
                  }
                  const forcedAnswer = researchAnswerFromResult(okResult);
                  if (forcedAnswer && route.finalizeDirectAnswer) {
                    pushStep({ kind: 'final', content: forcedAnswer });
                    return;
                  }
                  history.push({ role: 'assistant', content: reply });
                  history.push({
                    role: 'user',
                    content: continueAfterToolPrompt(goal, stepsRef.current, forced, okResult),
                  });
                  continue;
                }
              }

              pushStep({
                kind: 'thought',
                content: hallucinated
                  ? 'Refusing invented emails — requesting a real gmail tool call.'
                  : needsDraft
                    ? 'Need a real gmail_draft tool call to open Compose.'
                    : offeredBrowse
                      ? 'Model offered to browse instead of calling a tool — forcing a tool call.'
                      : visible ||
                        'Model talked about a tool instead of calling it — requesting a real tool call.',
              });
              history.push({ role: 'assistant', content: reply });
              history.push({
                role: 'user',
                content: [
                  `Original goal: ${goal}`,
                  `Routed skill: ${route.skill.id}`,
                  hallucinated
                    ? 'Those emails were invented. You MUST call a real tool. Never fabricate inbox contents.'
                    : needsDraft
                      ? 'Do not only write the reply in chat. Output ONLY a gmail_draft tool call now:'
                      : offeredBrowse || route.actDontAsk
                        ? 'Do not ask for permission. Output ONLY a web_research (or tabs_create) tool call now:'
                        : 'Do not narrate. Output ONLY a valid tool call now:',
                  nudgeToolExample(goal, stepsRef.current.length ? stepsRef.current : priorSteps),
                ].join('\n'),
              });
              continue;
            }

            pushStep({ kind: 'final', content: humanizeFinal(visible || reply) });
            break;
          }

          if (visible) {
            pushStep({ kind: 'thought', content: visible });
          }

          const rawCall = calls[0];
          const call = rewriteToolCallForIntent(
            goal,
            stepsRef.current.length ? stepsRef.current : priorSteps,
            rawCall,
          );

          if (call.name !== rawCall.name) {
            pushStep({
              kind: 'thought',
              content: `Corrected ${rawCall.name} → ${call.name} for this goal.`,
            });
          }

          const knownAnswer = latestResearchAnswer(stepsRef.current);
          const junkAfterResearch =
            Boolean(knownAnswer) &&
            (call.arguments.__philSkipAfterResearch === true ||
              call.name === 'tabs_list' ||
              call.name === 'tabs_create' ||
              call.name === 'tabs_navigate' ||
              call.name === 'web_research' ||
              call.name === 'page_read');
          if (
            junkAfterResearch ||
            (call.name === 'tabs_list' && isStuckToolLoop(stepsRef.current, 'tabs_list'))
          ) {
            pushStep({
              kind: 'thought',
              content: 'Stopping extra tab tools — answering from research results.',
            });
            pushStep({
              kind: 'final',
              content: knownAnswer || humanizeFinal(visible || 'I looked it up but could not summarize further.'),
            });
            break;
          }

          pushStep({
            kind: 'tool_call',
            content: toolCallLabel(call.name, call.arguments),
            toolCall: call,
          });

          let result = await executeTool(call, shouldAutoConfirmTool(route, call.name));
          if (!result || typeof result !== 'object') {
            result = {
              ok: false,
              error: 'No response from the background tool router. Try reloading the extension.',
              toolCall: call,
            };
          }

          if (result.needsConfirm && result.toolCall) {
            pushStep({
              kind: 'confirm',
              content: `Confirm: ${getTool(call.name)?.confirmLabel ?? call.name}`,
              toolCall: call,
            });
            const ok = await waitForConfirm(call);
            if (!ok || abortRef.current) {
              pushStep({ kind: 'error', content: 'User cancelled the action.' });
              break;
            }
            result = await executeTool(call, true);
          }

          if (result.ok) {
            gotSuccessfulTool = true;
            if (call.name === 'gmail_list' || call.name === 'gmail_read') {
              gotSuccessfulGmail = true;
            }
            if (call.name === 'gmail_draft' || call.name === 'gmail_send') {
              gotSuccessfulGmail = true;
            }
          }

          pushStep({
            kind: result.ok ? 'tool_result' : 'error',
            content: result.ok
              ? formatToolResultContent(call.name, result)
              : result.error || 'Tool failed',
            toolCall: call,
            toolResult: result,
          });

          history.push({ role: 'assistant', content: reply });
          history.push({
            role: 'user',
            content: continueAfterToolPrompt(goal, stepsRef.current, call, result),
          });
        }

        if (stepsLeft <= 0 && !abortRef.current) {
          pushStep({
            kind: 'error',
            content: 'Reached max agent steps. Refine the goal or raise the limit in settings.',
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        pushStep({
          kind: 'error',
          content: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setRunning(false);
        setPendingConfirm(null);
      }
    },
    [pushStep, waitForConfirm],
  );

  return {
    steps,
    running,
    pendingConfirm,
    error,
    run,
    stop,
    resolveConfirm,
    clearHistory,
    setSteps,
  };
}

export type { AgentSettings };
