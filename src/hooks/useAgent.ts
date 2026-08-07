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
  isBriefingGoal,
  isFocusStatusGoal,
  isGoalSetupGoal,
  isReminderGoal,
  isWebResearchGoal,
  parseReminderInMinutes,
} from '@/agent/assistantIntent';
import { buildAgentSystemPrompt, parseToolCalls, stripToolCallMarkup } from '@/agent/parser';
import { getTool, toolsPromptBlock } from '@/agent/tools';
import type { AgentSettings, AgentStep, ToolCall, ToolResult } from '@/agent/types';
import { getAgentSettings } from '@/storage/agentSettings';
import { getSettings } from '@/storage/db';
import { uid } from '@/utils';

async function executeTool(call: ToolCall, confirmed = false): Promise<ToolResult> {
  return chrome.runtime.sendMessage({
    type: 'AGENT_EXECUTE_TOOL',
    call,
    confirmed,
  });
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
  if (/\b[a-z][a-z0-9_]+\s*\{/.test(text)) {
    const m = text.match(/\b([a-z][a-z0-9_]+)\s*\{/i);
    if (m && getTool(m[1])) return true;
  }
  return false;
}

/** Model said it would use a tool but didn't emit a call. */
function narratesToolUse(text: string): boolean {
  return /\b(gmail_list|gmail_read|gmail_draft|gmail_send|page_read|tabs_create|tabs_navigate|reminder_create|focus_summary|briefing_today|web_research|goal_create|use the \w+ tool|fetch the emails|call the tool)\b/i.test(
    text,
  );
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

function philIntentHints(goal: string): string[] {
  if (isReminderGoal(goal)) {
    const mins = parseReminderInMinutes(goal);
    return [
      'Call reminder_create with text and inMinutes (or when).',
      mins != null ? `Suggested inMinutes: ${mins}` : 'Infer inMinutes from the request.',
    ];
  }
  if (isGoalSetupGoal(goal)) {
    return ['Call goal_create with a clear title from the user request.'];
  }
  if (isFocusStatusGoal(goal)) {
    return ['Call focus_summary and summarize productive vs leisure time.'];
  }
  if (isBriefingGoal(goal)) {
    return ['Call briefing_today and present the overview.'];
  }
  if (isWebResearchGoal(goal)) {
    return [
      'Call web_research with the search query. Leave finding tabs open for the user.',
    ];
  }
  return [];
}

function buildUserTurn(goal: string, priorSteps: AgentStep[], priorContext: string): string {
  const philHints = philIntentHints(goal);
  if (!priorContext) {
    if (!philHints.length) return goal;
    return [goal, '', ...philHints].join('\n');
  }

  const intent = detectIntent(goal, priorSteps);
  const matched = resolveEmailTarget(goal, priorSteps);
  const lines = [
    'Earlier in this agent conversation (use for context — especially email ids/subjects/URLs):',
    priorContext,
    '',
    `New request: ${goal}`,
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
  } else if (intent === 'open_link') {
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

      pushStep({ kind: 'user', content: goal });

      try {
        const agentSettings = await getAgentSettings();
        if (!agentSettings.enabled) {
          throw new Error('Enable Agent mode in settings first.');
        }

        const appSettings = await getSettings();
        const provider = getAIProvider();
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
          { role: 'user', content: buildUserTurn(goal, priorSteps, priorContext) },
        ];

        let stepsLeft = agentSettings.maxSteps;
        let formatNudgesLeft = 2;
        let gotSuccessfulGmail = priorHasGmail(priorSteps);
        let gotSuccessfulTool = false;

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

            const shouldNudge =
              formatNudgesLeft > 0 &&
              (hallucinated ||
                needsEmailTool ||
                needsRead ||
                needsDraft ||
                looksLikeMalformedToolCall(reply) ||
                narratesToolUse(reply) ||
                ((isEmailGoal(goal) || isOpenLinkGoal(goal) || intent === 'email_draft') &&
                  !gotSuccessfulTool &&
                  stepsLeft > 0));

            if (shouldNudge) {
              formatNudgesLeft -= 1;
              pushStep({
                kind: 'thought',
                content: hallucinated
                  ? 'Refusing invented emails — requesting a real gmail tool call.'
                  : needsDraft
                    ? 'Need a real gmail_draft tool call to open Compose.'
                    : visible ||
                      'Model talked about a tool instead of calling it — requesting a real tool call.',
              });
              history.push({ role: 'assistant', content: reply });
              history.push({
                role: 'user',
                content: [
                  `Original goal: ${goal}`,
                  hallucinated
                    ? 'Those emails were invented. You MUST call a real tool. Never fabricate inbox contents.'
                    : needsDraft
                      ? 'Do not only write the reply in chat. Output ONLY a gmail_draft tool call now:'
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

          pushStep({
            kind: 'tool_call',
            content: toolCallLabel(call.name, call.arguments),
            toolCall: call,
          });

          let result = await executeTool(call, false);
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
