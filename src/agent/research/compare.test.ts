/**
 * Unit checks for research compare / dedupe / rank (WF-01/06/16).
 */
import assert from 'node:assert/strict';
import {
  answerFollowUp,
  buildCompareAnswer,
  dedupeProducts,
  rankFlights,
  rankKeyboards,
} from './compare.ts';
import { FLIGHTS_FIXTURE, KEYBOARD_FIXTURE } from './fixtures.ts';

const deduped = dedupeProducts(KEYBOARD_FIXTURE);
assert.ok(deduped.length < KEYBOARD_FIXTURE.length, 'removes Keychron duplicate');
assert.equal(
  deduped.filter((p) => /keychron c1/i.test(p.name)).length,
  1,
  'one Keychron C1 after dedupe',
);

const ranked = rankKeyboards(KEYBOARD_FIXTURE, { maxPrice: 150, requireHotSwap: true });
assert.ok(ranked.length >= 3);
assert.ok(ranked.every((p) => p.priceUsd <= 150));
assert.ok(ranked.every((p) => p.features.some((f) => /hot-?swap/i.test(f))));
assert.ok(!ranked.some((p) => /leopold/i.test(p.name)), 'excludes soldered Leopold');

const kb = buildCompareAnswer(
  "I'm looking for a mechanical keyboard under $150 with hot-swappable switches. Compare the best options and recommend one.",
);
assert.ok(kb);
assert.match(kb!.answer, /ranked recommendation/i);
assert.match(kb!.answer, /trade-off/i);
assert.equal(kb!.engine, 'google');

const pm = buildCompareAnswer('Find the three best project management tools for startups.');
assert.ok(pm);
assert.equal(pm!.shortlist.length, 3);
const follow = answerFollowUp('Which one has the best API?', {
  kind: 'pm_tools',
  query: 'pm',
  shortlist: pm!.shortlist,
  answer: pm!.answer,
  updatedAt: Date.now(),
});
assert.ok(follow);
assert.match(follow!, /best API/i);
assert.match(follow!, /Linear/i);
assert.match(follow!, /prior/i);

const flights = buildCompareAnswer(
  'Find the cheapest direct flight from Warsaw to Tokyo in April.',
);
assert.ok(flights);
assert.match(flights!.answer, /Warsaw|Tokyo|direct flight/i);
assert.match(flights!.answer, /trade-off/i);
const directs = rankFlights(FLIGHTS_FIXTURE, { directOnly: true });
assert.ok(directs.every((f) => f.stops === 0));

console.log('research/compare.test.ts: ok');
