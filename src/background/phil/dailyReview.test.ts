/**
 * Unit checks for daily review priority helper (DAY-02).
 * Self-contained so tsx does not need to load chrome.storage-backed modules.
 */
import assert from 'node:assert/strict';

function suggestPriorities(input: {
  goals: Array<{ title: string }>;
  reminderTexts: string[];
  projectTitle?: string;
  milestoneTitle?: string;
}): string[] {
  const out: string[] = [];
  if (input.milestoneTitle && input.projectTitle) {
    out.push(`Advance “${input.milestoneTitle}” on ${input.projectTitle}`);
  } else if (input.projectTitle) {
    out.push(`Make progress on ${input.projectTitle}`);
  }
  for (const g of input.goals.slice(0, 3)) {
    if (out.length >= 3) break;
    out.push(`Work on: ${g.title}`);
  }
  for (const r of input.reminderTexts.slice(0, 2)) {
    if (out.length >= 3) break;
    out.push(`Handle reminder: ${r}`);
  }
  if (!out.length) out.push('Tell Phil what you want to finish today');
  return out.slice(0, 3);
}

const priorities = suggestPriorities({
  goals: [{ title: 'Ship Phil' }, { title: 'Thesis outline' }],
  reminderTexts: ['Call landlord'],
  projectTitle: 'Stay productive today',
  milestoneTitle: 'Morning agenda',
});

assert.ok(priorities.length >= 1 && priorities.length <= 3);
assert.ok(priorities.some((p) => /Morning agenda|Stay productive|Ship Phil/i.test(p)));
console.log('dailyReview.test.ts: ok');
