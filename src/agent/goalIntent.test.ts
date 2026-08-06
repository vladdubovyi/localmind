/**
 * Goal-intent helper smoke tests.
 * Run: npm test
 */
import {
  detectIntent,
  isGmailAtomFeedUrl,
  isUnrelatedDemoUrl,
  matchEmailFromGoal,
  nudgeToolExample,
  rewriteToolCallForIntent,
} from './goalIntent.ts';
import type { AgentStep, ToolCall } from './types.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(isGmailAtomFeedUrl('https://mail.google.com/gmail/feed/atom?alt=json'), 'atom feed');
assert(!isGmailAtomFeedUrl('https://mail.google.com/mail/u/0/#inbox'), 'inbox ok');
assert(isUnrelatedDemoUrl('https://en.wikipedia.org/wiki/WebGPU'), 'webgpu demo');

{
  const list = [
    {
      id: 'dom-1',
      from: 'notifications-noreply@faceit.com',
      subject: '_0h gifted you a subscription',
      snippet: 'Hello Lu4nik435, you have received a 1 month gift',
    },
    {
      id: 'dom-2',
      from: 'news@helios.pl',
      subject: 'Premiery 7 sierpnia',
      snippet: 'Sprawdź nowości',
    },
  ];
  const hit = matchEmailFromGoal('Summirize 0h gifted you a subscription', list);
  assert(hit?.id === 'dom-1', 'match gifted subject');
}

{
  const prior: AgentStep[] = [
    {
      id: '1',
      kind: 'user',
      content: 'Which 5 emails did I get last?',
      createdAt: 1,
    },
    {
      id: '2',
      kind: 'tool_result',
      content: 'list',
      createdAt: 2,
      toolCall: { id: 't', name: 'gmail_list', arguments: {} },
      toolResult: {
        ok: true,
        data: [
          {
            id: 'dom-1',
            from: 'a@b.com',
            subject: '_0h gifted you a subscription',
            snippet: 'gift',
          },
        ],
      },
    },
    {
      id: '3',
      kind: 'user',
      content: 'Summirize 0h gifted you a subscription',
      createdAt: 3,
    },
  ];
  assert(
    detectIntent('Summirize 0h gifted you a subscription', prior) === 'email_read',
    'intent read',
  );
  assert(detectIntent('Which 5 emails did I get last?', []) === 'email_list', 'intent list');

  const nudge = nudgeToolExample('Yes summarize it', prior);
  assert(nudge.includes('gmail_read'), 'nudge gmail_read');
  assert(nudge.includes('dom-1'), 'nudge uses prior subject match');
  assert(!nudge.includes('WebGPU'), 'nudge no webgpu');

  const badNav: ToolCall = {
    id: 'x',
    name: 'tabs_navigate',
    arguments: {
      url: 'https://mail.google.com/gmail/feed/atom?alt=json&max-results=5',
    },
  };
  const rewritten = rewriteToolCallForIntent('Which 5 emails?', prior, badNav);
  assert(rewritten.name === 'gmail_list', 'rewrite atom → gmail_list');

  const webgpu: ToolCall = {
    id: 'y',
    name: 'tabs_create',
    arguments: { url: 'https://en.wikipedia.org/wiki/WebGPU' },
  };
  const fixed = rewriteToolCallForIntent('Yes summarize it', prior, webgpu);
  assert(fixed.name === 'gmail_read', 'rewrite webgpu → gmail_read');
  assert(fixed.arguments.id === 'dom-1', 'rewrite uses message id');
}

console.log('goalIntent.test.ts: ok');
