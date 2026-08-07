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

// Kwargs without braces (user-reported narration that must still execute)
{
  const sample = 'gmail_list(query: "newer_than:14d", maxResults: 5)';
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'kwargs: expected one call');
  assert(calls[0].name === 'gmail_list', 'kwargs: name');
  assert(calls[0].arguments.query === 'newer_than:14d', 'kwargs: query');
  assert(calls[0].arguments.maxResults === 5, 'kwargs: maxResults');
  const stripped = stripToolCallMarkup(sample);
  assert(!stripped.includes('gmail_list'), 'kwargs: stripped');
}

{
  const sample = 'reminder_create(text: "call mom", inMinutes: 5)';
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'reminder kwargs: expected one call');
  assert(calls[0].name === 'reminder_create', 'reminder kwargs: name');
  assert(calls[0].arguments.text === 'call mom', 'reminder kwargs: text');
  assert(calls[0].arguments.inMinutes === 5, 'reminder kwargs: inMinutes');
}

// Unknown tool JSON should be ignored
{
  const sample = '{"name":"not_a_real_tool","arguments":{}}';
  assert(parseToolCalls(sample).length === 0, 'unknown tool ignored');
}

// Bare / blockquote / typo JSON (user-reported tabs_create typo)
{
  const sample = `<tool_call>
{"name":"tabs_create","arguments":{"url:"https://en.wikipedia.org/wiki/WebGPU"}}
`;
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'typo json: expected one call');
  assert(calls[0].name === 'tabs_create', 'typo json: name');
  assert(
    calls[0].arguments.url === 'https://en.wikipedia.org/wiki/WebGPU',
    'typo json: url repaired',
  );
}

// Shorthand (user-reported): gmail_list {query:"...", maxResults:5}
{
  const sample = `gmail_list {query:"newer_than:14d", maxResults:5}`;
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'shorthand: expected one call');
  assert(calls[0].name === 'gmail_list', 'shorthand: name');
  assert(calls[0].arguments.query === 'newer_than:14d', 'shorthand: query');
  assert(calls[0].arguments.maxResults === 5, 'shorthand: maxResults');
}

{
  const sample = `tabs_navigate {url:"mail.google.com"}`;
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'shorthand nav: expected one call');
  assert(calls[0].arguments.url === 'https://mail.google.com', 'shorthand nav: url normalized');
}

// Glued (user-reported): tabs_navigate{"url":"…"} with no space
{
  const sample = `tabs_navigate{"url":"https://mail.google.com/mail/subscriptions"}`;
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'glued nav: expected one call');
  assert(calls[0].name === 'tabs_navigate', 'glued nav: name');
  assert(
    calls[0].arguments.url === 'https://mail.google.com/mail/subscriptions',
    'glued nav: url',
  );
  const stripped = stripToolCallMarkup(sample);
  assert(!stripped.includes('tabs_navigate'), 'glued nav: stripped name');
  assert(!stripped.includes('subscriptions'), 'glued nav: stripped url');
}

{
  const sample = `tabs_create{"url":"https://example.com/path"}`;
  const calls = parseToolCalls(sample);
  assert(calls.length === 1, 'glued create: expected one call');
  assert(calls[0].name === 'tabs_create', 'glued create: name');
}

console.log('agent parser tests passed');
