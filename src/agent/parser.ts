import type { ToolCall } from '@/agent/types';

function toolId(): string {
  return `tool_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Parse tool calls from model output.
 * Supports:
 *   <tool_call>{"name":"...","arguments":{...}}</tool_call>
 *   ```tool\n{...}\n```
 *   TOOL_CALL: {...}
 */
export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];

  const push = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as {
        name?: string;
        arguments?: Record<string, unknown>;
        args?: Record<string, unknown>;
      };
      if (!parsed?.name || typeof parsed.name !== 'string') return;
      calls.push({
        id: toolId(),
        name: parsed.name,
        arguments: parsed.arguments ?? parsed.args ?? {},
      });
    } catch {
      // ignore malformed
    }
  };

  const xml = [...text.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi)];
  for (const m of xml) push(m[1]);

  const fences = [...text.matchAll(/```(?:tool|json)\s*([\s\S]*?)```/gi)];
  for (const m of fences) {
    const body = m[1].trim();
    if (body.includes('"name"')) push(body);
  }

  const lines = [...text.matchAll(/TOOL_CALL:\s*(\{[\s\S]*?\})(?:\n|$)/gi)];
  for (const m of lines) push(m[1]);

  // Deduplicate by name+args
  const seen = new Set<string>();
  return calls.filter((c) => {
    const key = `${c.name}:${JSON.stringify(c.arguments)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function stripToolCallMarkup(text: string): string {
  return text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(/```(?:tool|json)\s*[\s\S]*?```/gi, '')
    .replace(/TOOL_CALL:\s*\{[\s\S]*?\}(?:\n|$)/gi, '')
    .trim();
}

export function buildAgentSystemPrompt(base?: string): string {
  return [
    base?.trim() ||
      "You are LocalMind Agent, a private on-device assistant that can control the user's Chrome browser via tools.",
    'Never invent tool results. Never ask for passwords or try to log into accounts.',
    'Use tools when needed. Prefer page_read / gmail_list before acting.',
    'When you need a tool, output ONLY a tool call in this exact format (you may call one tool per turn):',
    '<tool_call>',
    '{"name":"tool_name","arguments":{}}',
    '</tool_call>',
    'When finished, answer the user in markdown without a tool call.',
    'Do not send email unless the user explicitly asked you to send it.',
  ].join('\n');
}
