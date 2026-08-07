/**
 * Unit tests for project template playbooks (C1).
 */
import assert from 'node:assert/strict';
import {
  careerPlaybook,
  detectResearchConflicts,
  homeStandingSummary,
  jobHuntPlaybook,
  lifePlannerPlaybook,
  parseJobHuntConstraints,
  playbookForTemplate,
  rankJobListings,
  researchRecommendation,
} from './projectPlaybooks.ts';
import type { PersistentProject } from '../phil/projectTypes.ts';

{
  const book = careerPlaybook('Staff Engineer Promotion', Date.UTC(2026, 0, 1));
  assert.ok(book.milestones.length >= 4);
  assert.equal(book.metrics.weeklyStudyHours, 6);
  assert.ok(Array.isArray(book.metrics.roadmap));
  assert.match(book.statusSummary, /12-month|roadmap|study/i);
}

{
  const c = parseJobHuntConstraints('I want a remote backend job paying at least €120k');
  assert.equal(c.salaryTarget, 120_000);
  assert.equal(c.salaryCurrency, 'EUR');
  assert.equal(c.locationPreference, 'remote');
  assert.ok((c.techStack as string[]).includes('backend'));
}

{
  const book = jobHuntPlaybook('Job Hunt', 'remote backend €120k');
  assert.match(book.statusSummary, /€120k|remote/i);
}

{
  const listings = [
    { id: 'a', title: 'BE', company: 'X', salary: 130_000, currency: 'EUR', location: 'remote', stack: ['backend'] },
    { id: 'a', title: 'BE dup', company: 'X', salary: 130_000, currency: 'EUR', location: 'remote', stack: ['backend'] },
    { id: 'b', title: 'FE', company: 'Y', salary: 50_000, currency: 'EUR', location: 'onsite', stack: ['frontend'] },
  ];
  const metrics = parseJobHuntConstraints('remote backend €120k');
  metrics.seenJobIds = [];
  const ranked = rankJobListings(listings, metrics);
  assert.equal(ranked.duplicatesHidden, 1);
  assert.equal(ranked.ranked.length, 2);
  metrics.seenJobIds = ['a'];
  const ranked2 = rankJobListings(listings, metrics);
  assert.ok(ranked2.duplicatesHidden >= 2);
  assert.ok(ranked2.ranked.every((j) => j.id !== 'a'));
}

{
  const book = lifePlannerPlaybook('Move to Spain');
  assert.ok(book.milestones.some((m) => /Visa/i.test(m.title)));
  assert.ok(book.milestones.some((m) => /Flights/i.test(m.title)));
  assert.ok(book.milestones.some((m) => /Apartment/i.test(m.title)));
}

{
  const home = playbookForTemplate('custom', 'Buying my first home');
  assert.ok(home);
  assert.equal(home!.metrics.homePurchase, true);
  assert.ok(home!.milestones.some((m) => /Mortgage/i.test(m.title)));
}

{
  const entries = [
    { id: '1', title: 'A', summary: '450 km range recommend buying cheaper to run', tags: [], capturedAt: 1 },
    { id: '2', title: 'B', summary: '280 km range wait expensive to own', tags: [], capturedAt: 2 },
  ];
  const conflicts = detectResearchConflicts(entries);
  assert.ok(conflicts.length >= 1);
  const project = {
    id: 'p', title: 'EV', template: 'research', status: 'active', createdAt: 1, updatedAt: 1,
    milestones: [], linkedGoalIds: [], linkedReminderIds: [], knowledgeEntries: entries,
    metrics: { conflicts }, lastProgressAt: 1,
  } as PersistentProject;
  const rec = researchRecommendation(project);
  assert.match(rec, /trade-offs|remaining unknowns|recommendation/i);
}

{
  const project = {
    id: 'p', title: 'Buying my first home', template: 'custom', status: 'active',
    createdAt: 1, updatedAt: 1, milestones: [], linkedGoalIds: [], linkedReminderIds: [],
    knowledgeEntries: [],
    metrics: {
      homePurchase: true, banksCompared: 3, apartmentsViewed: 12, apartmentsShortlisted: 3,
      taxesEstimated: true, insuranceResearched: false, lawyerSelected: false,
    },
    lastProgressAt: 1,
  } as PersistentProject;
  const standing = homeStandingSummary(project);
  assert.match(standing, /Where am I|timeline|next week/i);
}

console.log('storage/projectPlaybooks.test.ts OK');
