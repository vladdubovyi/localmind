import { parseJsonLenient, repairToolJson } from './jsonRepair';
import { getTool } from './tools';
import type { ToolCall } from './types';

function toolId(): string {
  return `tool_${Math.random().toString(36).slice(2, 10)}`;
}

/** Extract top-level JSON objects with string-aware brace matching. */
function extractJsonObjects(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] !== '{') {
      i += 1;
      continue;
    }
    let depth = 0;
    let inStr = false;
    let esc = false;
    let closed = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          out.push(text.slice(i, j + 1));
          i = j + 1;
          closed = true;
          break;
        }
      }
    }
    if (!closed) break;
  }
  return out;
}

function tryParseObject(raw: string): ToolCall | null {
  const cleaned = raw
    .trim()
    .replace(/^>\s*/gm, '')
    .replace(/^```(?:json|tool)?\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  const candidates = cleaned.startsWith('{')
    ? [cleaned, ...extractJsonObjects(cleaned)]
    : extractJsonObjects(cleaned);

  for (const candidate of candidates) {
    try {
      const parsed = parseJsonLenient(candidate) as {
        name?: string;
        tool?: string;
        arguments?: Record<string, unknown>;
        args?: Record<string, unknown>;
        parameters?: Record<string, unknown>;
      };
      const name = parsed.name ?? parsed.tool;
      if (!name || typeof name !== 'string') continue;
      if (!getTool(name)) continue;
      const args = parsed.arguments ?? parsed.args ?? parsed.parameters ?? {};
      return {
        id: toolId(),
        name,
        arguments: typeof args === 'object' && args ? args : {},
      };
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Parse tool calls from model output.
 * Local models rarely follow a single format, so we accept several shapes.
 */
export function parseToolCalls(text: string): ToolCall[] {
  // Repair common local-model JSON typos before brace extraction.
  const textRepaired = repairToolJson(text);
  const calls: ToolCall[] = [];
  const push = (raw: string) => {
    const call = tryParseObject(raw);
    if (call) calls.push(call);
  };

  for (const source of [text, textRepaired]) {
    for (const m of source.matchAll(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/gi)) {
      push(m[1]);
    }
  }

  // Unclosed <tool_call> … (common with small models) — use brace-aware extract
  if (!calls.length) {
    for (const source of [textRepaired, text]) {
      const idx = source.search(/<tool_call>/i);
      if (idx < 0) continue;
      const after = source.slice(idx + '<tool_call>'.length);
      for (const obj of extractJsonObjects(repairToolJson(after))) {
        push(obj);
        if (calls.length) break;
      }
      if (calls.length) break;
    }
  }

  for (const m of text.matchAll(
    /<(?:tool|function_call|invoke)(?:\s[^>]*)?>\s*([\s\S]*?)\s*<\/(?:tool|function_call|invoke)>/gi,
  )) {
    push(m[1]);
  }

  for (const m of text.matchAll(/```(?:tool|json)?\s*([\s\S]*?)```/gi)) {
    push(m[1]);
  }

  for (const m of text.matchAll(/TOOL_CALL:\s*(\{[\s\S]*?\})(?:\n|$)/gi)) {
    push(m[1]);
  }

  for (const m of text.matchAll(/\b([a-z][a-z0-9_]{2,})\s*\(\s*(\{[\s\S]*?\})\s*\)/gi)) {
    const name = m[1];
    if (!getTool(name)) continue;
    try {
      const args = parseJsonLenient(m[2]) as Record<string, unknown>;
      calls.push({ id: toolId(), name, arguments: args });
    } catch {
      // ignore
    }
  }

  if (!calls.length) {
    for (const source of [textRepaired, text]) {
      for (const obj of extractJsonObjects(repairToolJson(source.replace(/^>\s*/gm, '')))) {
        push(obj);
      }
      if (calls.length) break;
    }
  }

  const seen = new Set<string>();
  return calls.filter((c) => {
    const key = `${c.name}:${JSON.stringify(c.arguments)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function stripToolCallMarkup(text: string): string {
  let out = text
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    .replace(
      /<(?:tool|function_call|invoke)(?:\s[^>]*)?>[\s\S]*?<\/(?:tool|function_call|invoke)>/gi,
      '',
    )
    .replace(/```(?:tool|json)?\s*[\s\S]*?```/gi, '')
    .replace(/TOOL_CALL:\s*\{[\s\S]*?\}(?:\n|$)/gi, '')
    .replace(/\b([a-z][a-z0-9_]{2,})\s*\(\s*\{[\s\S]*?\}\s*\)/gi, (full, name: string) =>
      getTool(name) ? '' : full,
    );

  for (const obj of extractJsonObjects(out.replace(/^>\s*/gm, ''))) {
    if (tryParseObject(obj)) {
      out = out.replace(obj, '');
      // Also strip a leading blockquote line that only wrapped the JSON
      out = out.replace(new RegExp(`^>\\s*${escapeRegExp(obj)}\\s*$`, 'm'), '');
    }
  }

  return out
    .replace(/^>\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function buildAgentSystemPrompt(base?: string): string {
  return [
    base?.trim() ||
      "You are LocalMind Agent, a private on-device assistant that can control the user's Chrome browser via tools.",
    'Never invent tool results. Never ask for passwords or try to log into accounts.',
    'Never invent fake user messages, dialogues, or roleplay. Only output a tool call OR the final answer.',
    'Pick tools that match the user goal. Do not call Gmail tools unless the user asked about email.',
    'Never invent tab IDs. After tabs_create, use the returned id with page_read. Otherwise omit tabId.',
    'Typical web research flow: tabs_create → page_read (with that tab id) → final answer in 3 bullets.',
    'JSON must be valid. Example (note the quotes around keys AND values):',
    '<tool_call>',
    '{"name":"tabs_create","arguments":{"url":"https://en.wikipedia.org/wiki/WebGPU"}}',
    '</tool_call>',
    'Do not wrap the tool call in markdown, blockquotes, or prose.',
    'When finished, answer the user in markdown without a tool call.',
    'Do not send email unless the user explicitly asked you to send it.',
  ].join('\n');
}
