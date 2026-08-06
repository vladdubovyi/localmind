import {
  isRestoringEngine,
  shouldShowFullOnboarding,
} from './engineLifecycle.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(shouldShowFullOnboarding('needs_download', false), 'first download');
assert(shouldShowFullOnboarding('downloading', false), 'active download');
assert(shouldShowFullOnboarding('error', false), 'download error');
assert(!shouldShowFullOnboarding('cached', true), 'cached should not onboard');
assert(
  !shouldShowFullOnboarding('downloading', true),
  'cache hydrate should not onboard',
);
assert(!shouldShowFullOnboarding('ready', false), 'ready should not onboard');

assert(isRestoringEngine('cached', true), 'cached is restore');
assert(isRestoringEngine('downloading', true), 'hydrate is restore');
assert(isRestoringEngine('error', true), 'failed hydrate still restore UI');
assert(!isRestoringEngine('downloading', false), 'network download is not restore');
assert(!isRestoringEngine('needs_download', false), 'needs download is not restore');
assert(!isRestoringEngine('ready', false), 'ready is not restore');

console.log('engineLifecycle.test.ts: ok');
