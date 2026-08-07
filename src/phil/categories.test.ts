import assert from 'node:assert/strict';
import { categorizeDomain, domainFromUrl } from './categories.ts';

assert.equal(categorizeDomain('https://github.com/org/repo'), 'productive');
assert.equal(categorizeDomain('www.youtube.com'), 'leisure');
assert.equal(categorizeDomain('https://example.com/page'), 'neutral');
assert.equal(
  categorizeDomain('youtube.com', { 'youtube.com': 'productive' }),
  'productive',
);
assert.equal(domainFromUrl('https://www.reddit.com/r/programming'), 'reddit.com');

console.log('phil/categories.test.ts OK');
