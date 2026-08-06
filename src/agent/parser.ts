import { parseJsonLenient, repairToolJson } from './jsonRepair';
import { normalizeToolArgs, parseShorthandArgBody } from './shorthandArgs';
import { getTool } from './tools';
import type { ToolCall } from './types';

function toolId(): string {
  return `tool_${Math.random().toString(36).slice(2, 10)}`;
}

function makeCall(name: string, args: Record<string, unknown>): ToolCall {
  return {
    id: toolId(),
    name,
    arguments: normalizeToolArgs(name, args),
  };
}

/**
 * Parse `tool_name{…}` / `tool_name {…}` (with or without space).
 * Local models often emit: tabs_navigate{"url":"https://…"}
 */
function parseNameBraceCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  const re = /\b([a-z][a-z0-9_]{2,})\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const name = match[1];
    if (!getTool(name)) continue;
    const braceStart = match.index + match[0].length - 1;
    const objs = extractJsonObjects(text.slice(braceStart));
    if (!objs.length) continue;
    const raw = objs[0];
    let args: Record<string, unknown> = parseShorthandArgBody(raw);
    try {
      const parsed = parseJsonLenient(raw) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        // Full {"name":"…","arguments":{…}} objects are handled elsewhere
        if (typeof parsed.name === 'string' && getTool(parsed.name)) continue;
        args = parsed;
      }
    } catch {
      // keep shorthand args
    }
    calls.push(makeCall(name, args));
    // Advance past this object to avoid overlapping matches
    re.lastIndex = braceStart + raw.length;
  }
  return calls;
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
      return makeCall(name, typeof args === 'object' && args ? args : {});
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
      calls.push(makeCall(name, args));
    } catch {
      // ignore
    }
  }

  // Shorthand / glued: gmail_list {…}, tabs_navigate{"url":"…"}, tabs_create{url:"…"}
  if (!calls.length) {
    for (const call of parseNameBraceCalls(textRepaired)) calls.push(call);
    if (!calls.length) {
      for (const call of parseNameBraceCalls(text)) calls.push(call);
    }
  }

  // Bare tool name alone on a line — skipped (too many false positives)

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

  // Strip tool_name{…} / tool_name {…} including glued forms
  out = stripNameBraceMarkup(out);

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

function stripNameBraceMarkup(text: string): string {
  const removals: Array<{ start: number; end: number }> = [];
  const re = /\b([a-z][a-z0-9_]{2,})\s*\{/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const name = match[1];
    if (!getTool(name)) continue;
    const braceStart = match.index + match[0].length - 1;
    const objs = extractJsonObjects(text.slice(braceStart));
    if (!objs.length) continue;
    const end = braceStart + objs[0].length;
    removals.push({ start: match.index, end });
    re.lastIndex = end;
  }
  if (!removals.length) return text;
  let out = text;
  for (const r of removals.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, r.start) + out.slice(r.end);
  }
  return out;
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
    'If the user asks about email/inbox/messages, immediately call gmail_list — do not ask permission or narrate.',
    'Gmail works via the open Gmail tab by default (no API key). Example:',
    '<tool_call>',
    '{"name":"gmail_list","arguments":{"query":"newer_than:14d","maxResults":5}}',
    '</tool_call>',
    'For web pages: tabs_create → page_read (with returned tab id) → final answer.',
    'To open a link in a new tab, call tabs_create with the full https URL — do not only print the tool name.',
    'Never invent tab IDs. Do not wrap tool calls in markdown or prose.',
    'When finished, answer in markdown without a tool call.',
    'Do not send email unless the user explicitly asked you to send it.',
  ].join('\n');
}
