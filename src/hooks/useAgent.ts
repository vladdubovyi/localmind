import { useCallback, useRef, useState } from 'react';
import { getAIProvider } from '@/ai/webllm';
import { buildAgentSystemPrompt, parseToolCalls, stripToolCallMarkup } from '@/agent/parser';
import { toolsPromptBlock } from '@/agent/tools';
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

        while (stepsLeft > 0 && !abortRef.current) {
          stepsLeft -= 1;

          const reply = await provider.chat({
            messages: history,
            temperature: Math.min(appSettings.generation.temperature, 0.4),
            topP: appSettings.generation.topP,
            maxTokens: appSettings.generation.maxTokens,
            stream: false,
          });

          if (abortRef.current) break;

          const calls = parseToolCalls(reply);
          const visible = stripToolCallMarkup(reply);

          if (!calls.length) {
            pushStep({ kind: 'final', content: visible || reply });
            break;
          }

          if (visible) {
            pushStep({ kind: 'thought', content: visible });
          }

          // Execute first tool call only (keeps local models reliable)
          const call = calls[0];
          pushStep({ kind: 'tool_call', content: `${call.name}`, toolCall: call });

          let result = await executeTool(call, false);

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
            content: [
              `Tool ${call.name} result:`,
              result.ok
                ? JSON.stringify(result.data ?? { ok: true }).slice(0, 6000)
                : `ERROR: ${result.error}`,
              'Continue. Call another tool if needed, or give the final answer.',
            ].join('\n'),
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
