/**
 * Agent tool-call parser smoke tests.
 * Run: npm test
 */
import { parseToolCalls, stripToolCallMarkup } from './parser.ts';

const sample = `
I'll open the page first.
<tool_call>
{"name":"tabs_create","arguments":{"url":"https://example.com"}}
</tool_call>
`;

const calls = parseToolCalls(sample);
console.assert(calls.length === 1, 'expected one tool call');
console.assert(calls[0].name === 'tabs_create', 'name mismatch');
console.assert(calls[0].arguments.url === 'https://example.com', 'url mismatch');

const stripped = stripToolCallMarkup(sample);
console.assert(!stripped.includes('tool_call'), 'markup should be stripped');
console.assert(stripped.includes('open the page'), 'thought text kept');

console.log('agent parser tests passed', { calls: calls.length });
