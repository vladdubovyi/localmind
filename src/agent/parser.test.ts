/**
 * Agent tool-call parser smoke tests.
 * Run: npm test
 */
import { parseToolCalls, stripToolCallMarkup } from './parser.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// Canonical XML format
{
  const sample = `
I'll open the page first.
<tool_call>
{"name":"tabs_create","arguments":{"url":"https://example.com"}}
</tool_call>
`;
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'expected one tool call');
  assert(calls[0].name === 'tabs_create', 'name mismatch');
  assert(calls[0].arguments.url === 'https://example.com', 'url mismatch');
  const stripped = stripToolCallMarkup(sample);
  assert(!stripped.includes('tool_call'), 'markup should be stripped');
  assert(stripped.includes('open the page'), 'thought text kept');
}

// Bare JSON (what small models often emit)
{
  const sample = `Let me check that for you with the Gmail list tool.
{"name":"gmail_list","arguments":{"query":"label:inbox newer_than:7d","maxResults":5}}`;
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'bare json: expected one call');
  assert(calls[0].name === 'gmail_list', 'bare json: name');
  assert(calls[0].arguments.maxResults === 5, 'bare json: maxResults');
}

// Blockquote-prefixed JSON (user-reported format)
{
  const sample = `Let me check that for you with the Gmail list tool.
>{"name":"gmail_list","arguments":{"query":"label:inbox newer_than:7d","maxResults":5}}`;
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'blockquote json: expected one call');
  assert(calls[0].name === 'gmail_list', 'blockquote json: name');
}

// Fenced json without language still works via extract
{
  const sample = '```\n{"name":"page_read","arguments":{}}\n```';
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'fence: expected one call');
  assert(calls[0].name === 'page_read', 'fence: name');
}

// Function-call style
{
  const sample = 'gmail_list({"query":"label:inbox","maxResults":5})';
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'fn style: expected one call');
  assert(calls[0].name === 'gmail_list', 'fn style: name');
}

// Unknown tool JSON should be ignored
{
  const sample = '{"name":"not_a_real_tool","arguments":{}}';
  assert(parseToolCalls(sample).length === 0, 'unknown tool ignored');
}

console.log('agent parser tests passed');
