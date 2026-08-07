import assert from 'node:assert/strict';
import {
  extractBrowseSearchQuery,
  pruneExpired,
  BROWSE_RETENTION_MS,
  type BrowseVisit,
} from './browserMemoryQuery.ts';

{
  const q = extractBrowseSearchQuery('Find that Kubernetes article I read last week.');
  assert.match(q.toLowerCase(), /kubernetes/);
  assert.doesNotMatch(q.toLowerCase(), /last week/);
  assert.doesNotMatch(q.toLowerCase(), /\bfind\b/);
}

{
  const now = Date.now();
  const visits: BrowseVisit[] = [
    {
      id: 'a',
      url: 'https://example.com/old',
      title: 'Old',
      visitedAt: now - BROWSE_RETENTION_MS - 1000,
      source: 'seed',
    },
    {
      id: 'b',
      url: 'https://example.com/new',
      title: 'New',
      visitedAt: now - 3 * 24 * 60 * 60 * 1000,
      source: 'seed',
    },
  ];
  const kept = pruneExpired(visits, now);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.id, 'b');
}

console.log('storage/browserMemory.test.ts OK');
