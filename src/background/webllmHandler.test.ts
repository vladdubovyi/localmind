/**
 * Ensure early WebLLM port messages are queued until the handler is armed.
 * Run: npm test
 */
import { createArmedMessageBridge } from './webllmHandler.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const bridge = createArmedMessageBridge();
const seen: unknown[] = [];

bridge.onMessage({ kind: 'reload', uuid: '1' });
bridge.onMessage({ kind: 'keepAlive' });
assert(bridge.getQueueLength() === 2, 'messages should queue before arm');

bridge.arm((msg) => {
  seen.push(msg);
});
assert(bridge.getQueueLength() === 0, 'queue should flush on arm');
assert(seen.length === 2, 'flushed both queued messages');
assert(
  (seen[0] as { uuid?: string }).uuid === '1',
  'reload must be delivered first',
);

bridge.onMessage({ kind: 'chatCompletionNonStreaming', uuid: '2' });
assert(seen.length === 3, 'post-arm messages deliver immediately');
assert(bridge.getQueueLength() === 0, 'no queue after arm');

console.log('webllmHandler.test.ts: ok');
