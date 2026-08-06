import { useCallback, useRef, useState } from 'react';
import { getAIProvider } from '@/ai/webllm';
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
  return false;
}

function continueAfterToolPrompt(goal: string, call: ToolCall, result: ToolResult): string {
  const lines = [
    `Original goal: ${goal}`,
    `Tool ${call.name} result:`,
    result.ok
      ? JSON.stringify(result.data ?? { ok: true }).slice(0, 6000)
      : `ERROR: ${result.error}`,
    'Output ONLY one <tool_call> … </tool_call> OR the final markdown answer.',
    'Do not invent fake user/assistant dialogue.',
  ];

  if (!result.ok) {
    lines.push(
      'That tool failed. Choose a different next step that still advances the original goal.',
      'Do not invent tab IDs. Prefer tabs_create, then page_read with the returned id (or omit tabId).',
      'Do not switch to unrelated tools (e.g. Gmail) unless the goal is about email.',
    );
  } else if (call.name === 'tabs_create') {
    const id = (result.data as { id?: number } | undefined)?.id;
    lines.push(
      id != null
        ? `Next call page_read with {"tabId":${id}} (the tab just opened). Then summarize.`
        : 'Next call page_read (omit tabId if needed), then summarize.',
    );
  } else if (call.name === 'page_read' || call.name === 'page_query') {
    lines.push('If you have enough page content, give the final answer now. Do not call more tools unless needed.');
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

  const pushStep = useCallback((step: Omit<AgentStep, 'id' | 'createdAt'>) => {
    const full: AgentStep = { ...step, id: uid('step'), createdAt: Date.now() };
    setSteps((prev) => [...prev, full]);
    return full;
  }, []);

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
      setSteps([]);
      setRunning(true);

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
          { role: 'user', content: goal },
        ];

        let stepsLeft = agentSettings.maxSteps;
        let formatNudgesLeft = 1;

        while (stepsLeft > 0 && !abortRef.current) {
          stepsLeft -= 1;

          const reply = await provider.chat({
            messages: history,
            temperature: Math.min(appSettings.generation.temperature, 0.3),
            topP: appSettings.generation.topP,
            maxTokens: Math.min(appSettings.generation.maxTokens, 768),
            stream: false,
          });

          if (abortRef.current) break;

          const calls = parseToolCalls(reply);
          const visible = stripToolCallMarkup(reply);

          if (!calls.length) {
            if (formatNudgesLeft > 0 && looksLikeMalformedToolCall(reply)) {
              formatNudgesLeft -= 1;
              pushStep({
                kind: 'thought',
                content:
                  visible ||
                  'Model attempted a tool call in the wrong format — asking once for the XML format.',
              });
              history.push({ role: 'assistant', content: reply });
              history.push({
                role: 'user',
                content: [
                  `Original goal: ${goal}`,
                  'Your last message was not a valid tool call.',
                  'Reply with ONLY this XML (no prose). Pick a tool that matches the goal:',
                  '<tool_call>',
                  '{"name":"tabs_create","arguments":{"url":"https://en.wikipedia.org/wiki/WebGPU"}}',
                  '</tool_call>',
                  'Or answer the user in markdown if you are done.',
                ].join('\n'),
              });
              continue;
            }

            pushStep({ kind: 'final', content: visible || reply });
            break;
          }

          if (visible) {
            pushStep({ kind: 'thought', content: visible });
          }

          // Execute first tool call only (keeps local models reliable)
          const call = calls[0];
          pushStep({
            kind: 'tool_call',
            content: `${call.name}(${JSON.stringify(call.arguments)})`,
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
              content: `Confirm: ${call.name}`,
              toolCall: call,
            });
            const ok = await waitForConfirm(call);
            if (!ok || abortRef.current) {
              pushStep({ kind: 'error', content: 'User cancelled the action.' });
              break;
            }
            result = await executeTool(call, true);
          }

          pushStep({
            kind: result.ok ? 'tool_result' : 'error',
            content: result.ok
              ? JSON.stringify(result.data ?? { ok: true }, null, 0).slice(0, 4000)
              : result.error || 'Tool failed',
            toolCall: call,
            toolResult: result,
          });

          history.push({ role: 'assistant', content: reply });
          history.push({
            role: 'user',
            content: continueAfterToolPrompt(goal, call, result),
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
    setSteps,
  };
}

export type { AgentSettings };
