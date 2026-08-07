/**
 * Persistent Project template playbooks (Wave 2 C1).
 */
import type {
  MilestoneStatus,
  PersistentProject,
  ProjectKnowledgeEntry,
  ProjectMetrics,
  ProjectMilestone,
  ProjectTemplate,
} from '@/phil/projectTypes';

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

const MS_DAY = 86_400_000;

export type JobListingFixture = {
  id: string;
  title: string;
  company: string;
  salary: number;
  currency: string;
  location: string;
  stack: string[];
  url?: string;
};

export type JobApplicationStatus = 'saved' | 'drafted' | 'applied' | 'follow-up';

export type JobApplication = {
  jobId: string;
  title: string;
  company: string;
  status: JobApplicationStatus;
  coverLetterPreview?: string;
  cvNotes?: string;
  updatedAt: number;
};

export type BrowseLogEntry = {
  url: string;
  title: string;
  associatedAt: number;
  silent: boolean;
  tags?: string[];
};

export type ComparisonRow = {
  dimension: string;
  values: Record<string, string>;
};

function ms(title: string, status: MilestoneStatus, now: number, targetDate?: number): ProjectMilestone {
  return { id: uid('ms'), title, status, targetDate, updatedAt: now };
}

export function careerPlaybook(title: string, now = Date.now()) {
  const targetDate = now + 365 * MS_DAY;
  return {
    milestones: [
      ms('Map Staff Engineer bar + gap analysis', 'in_progress', now, now + 30 * MS_DAY),
      ms('System design depth (distributed systems)', 'not_started', now, now + 120 * MS_DAY),
      ms('Leadership / tech strategy narratives', 'not_started', now, now + 180 * MS_DAY),
      ms('Cross-org impact project', 'not_started', now, now + 270 * MS_DAY),
      ms('Promo packet + calibration', 'not_started', now, targetDate),
    ],
    targetDate,
    metrics: {
      weeklyStudyHours: 6,
      requiredSkills: ['System design', 'Distributed systems', 'Technical leadership', 'Influence without authority', 'Execution at org scale'],
      roadmap: [
        'Months 1–2: scope Staff bar, pick weak areas',
        'Months 3–5: weekly system-design study + design docs',
        'Months 6–8: lead a cross-team initiative',
        'Months 9–12: promo evidence, mentors, packet',
      ],
      studyAskPending: true,
      todayStudyTask: 'Study task: system design — CAP theorem trade-offs (45m)',
      techStack: ['System design', 'Distributed systems', 'Technical leadership', 'Influence without authority', 'Execution at org scale'],
    } as ProjectMetrics,
    statusSummary: `Career Accelerator project “${title}” — ~12-month target with learning roadmap and milestones. Suggested weekly study: 6 hours. Shall I schedule recurring study sessions?`,
  };
}

export function parseJobHuntConstraints(utterance: string): ProjectMetrics {
  const t = utterance.toLowerCase();
  let salaryTarget = 120_000;
  let salaryCurrency = 'EUR';
  const euro = t.match(/(?:€|eur)\s*(\d+)\s*k/i) || t.match(/(\d+)\s*k\s*(?:€|eur)/i);
  const usd = t.match(/(?:\$|usd)\s*(\d+)\s*k/i) || t.match(/(\d+)\s*k\s*(?:\$|usd)/i);
  if (euro) { salaryTarget = Number(euro[1]) * 1000; salaryCurrency = 'EUR'; }
  else if (usd) { salaryTarget = Number(usd[1]) * 1000; salaryCurrency = 'USD'; }
  else {
    const bare = t.match(/(\d+)\s*k/);
    if (bare) salaryTarget = Number(bare[1]) * 1000;
  }
  const locationPreference = /\bremote\b/i.test(t) ? 'remote' : /\bhybrid\b/i.test(t) ? 'hybrid' : 'flexible';
  const techStack: string[] = [];
  if (/\bbackend\b/i.test(t)) techStack.push('backend');
  if (/\bfrontend\b/i.test(t)) techStack.push('frontend');
  if (/\bfull.?stack\b/i.test(t)) techStack.push('fullstack');
  if (/\b(node|nodejs)\b/i.test(t)) techStack.push('Node.js');
  if (/\bpython\b/i.test(t)) techStack.push('Python');
  if (/\bgo(lang)?\b/i.test(t)) techStack.push('Go');
  if (/\bjava\b/i.test(t)) techStack.push('Java');
  if (/\btypescript\b/i.test(t)) techStack.push('TypeScript');
  if (!techStack.length) techStack.push('backend');
  return { salaryTarget, salaryCurrency, locationPreference, techStack, preferredCompanies: [], applications: [] as JobApplication[], seenJobIds: [] as string[] };
}

export function jobHuntPlaybook(title: string, utterance = '', now = Date.now()) {
  const constraints = parseJobHuntConstraints(utterance || title);
  const salaryLabel = constraints.salaryCurrency === 'EUR'
    ? `€${Math.round((constraints.salaryTarget as number) / 1000)}k`
    : `$${Math.round((constraints.salaryTarget as number) / 1000)}k`;
  return {
    milestones: [
      ms('Clarify role + constraints', 'in_progress', now),
      ms('Daily job search loop', 'not_started', now),
      ms('Applications + follow-ups', 'not_started', now),
      ms('Interview prep', 'not_started', now),
    ],
    metrics: constraints,
    statusSummary: `Job Hunt project — target ${salaryLabel}, ${constraints.locationPreference}, stack: ${(constraints.techStack as string[]).join(', ')}. Constraints are stored and editable on the project.`,
    targetDate: now + 90 * MS_DAY,
  };
}

export function researchPlaybook(title: string, now = Date.now()) {
  return {
    milestones: [
      ms('Define decision criteria', 'in_progress', now),
      ms('Capture sources while browsing', 'not_started', now),
      ms('Resolve conflicting claims', 'not_started', now),
      ms('Recommendation + remaining unknowns', 'not_started', now),
    ],
    metrics: {
      topic: title,
      comparisonTable: [] as ComparisonRow[],
      conflicts: [] as string[],
      recommendation: null,
    } as ProjectMetrics,
    statusSummary: `Research project ready — knowledge store empty but ready for EV / topic capture (${title}).`,
    targetDate: now + 180 * MS_DAY,
  };
}

export const LIFE_PLANNER_WORKSTREAMS = ['Apartment search', 'Visa', 'Banking', 'Taxes', 'Flights', 'Internet', 'Insurance', 'Utilities', 'Packing'] as const;

export function lifePlannerPlaybook(title: string, now = Date.now()) {
  const targetDate = now + 180 * MS_DAY;
  const deadlines: Record<string, number> = {
    Visa: now + 14 * MS_DAY, Flights: now + 7 * MS_DAY, 'Apartment search': now + 60 * MS_DAY,
    Banking: now + 90 * MS_DAY, Taxes: now + 120 * MS_DAY, Internet: now + 150 * MS_DAY,
    Insurance: now + 100 * MS_DAY, Utilities: now + 140 * MS_DAY, Packing: now + 160 * MS_DAY,
  };
  const milestones = LIFE_PLANNER_WORKSTREAMS.map((name, i) =>
    ms(name, i === 0 ? 'in_progress' : 'not_started', now, deadlines[name]),
  ).sort((a, b) => (a.targetDate ?? 0) - (b.targetDate ?? 0));
  return {
    milestones,
    metrics: {
      workstreams: [...LIFE_PLANNER_WORKSTREAMS],
      missingDocuments: ['Passport scan', 'Proof of funds', 'Employment letter'],
      briefingItems: ['Book flights this week', 'Schedule visa appointment within two weeks', 'Electricity providers not researched yet'],
      prioritization: 'date-based',
    } as ProjectMetrics,
    statusSummary: `Life Planner master project “${title}” (~6 months) with workstreams: ${LIFE_PLANNER_WORKSTREAMS.join(', ')}. Date-based priorities: visa and flights first.`,
    targetDate,
  };
}

export const HOME_BUYING_WORKSTREAMS = ['Mortgage', 'Apartments', 'Taxes', 'Insurance', 'Lawyer', 'Inspections', 'Closing'] as const;

export function homeBuyingPlaybook(title: string, now = Date.now()) {
  return {
    milestones: HOME_BUYING_WORKSTREAMS.map((name, i) => ms(name, i === 0 ? 'in_progress' : 'not_started', now)),
    metrics: {
      workstreams: [...HOME_BUYING_WORKSTREAMS], browseLog: [] as BrowseLogEntry[], homePurchase: true,
      banksCompared: 0, apartmentsViewed: 0, apartmentsShortlisted: 0,
      taxesEstimated: false, insuranceResearched: false, lawyerSelected: false,
    } as ProjectMetrics,
    statusSummary: `Home purchase project “${title}” — workstreams for mortgage, apartments, taxes, insurance, lawyer, and more.`,
    targetDate: now + 120 * MS_DAY,
  };
}

export function playbookForTemplate(template: ProjectTemplate, title: string, utterance = '', now = Date.now()) {
  switch (template) {
    case 'career': return careerPlaybook(title, now);
    case 'job_hunt': return jobHuntPlaybook(title, utterance, now);
    case 'research': return researchPlaybook(title, now);
    case 'life_move':
      return /\b(home|house|mortgage|buying)\b/i.test(`${title} ${utterance}`) ? homeBuyingPlaybook(title, now) : lifePlannerPlaybook(title, now);
    case 'custom':
      return /\b(home|house|mortgage|buying)\b/i.test(`${title} ${utterance}`) ? homeBuyingPlaybook(title, now) : null;
    default: return null;
  }
}

export function rankJobListings(listings: JobListingFixture[], metrics: ProjectMetrics) {
  const seen = new Set((metrics.seenJobIds as string[] | undefined) ?? []);
  const salaryTarget = Number(metrics.salaryTarget ?? 0);
  const location = String(metrics.locationPreference ?? '').toLowerCase();
  const stack = new Set(((metrics.techStack as string[]) ?? []).map((s) => s.toLowerCase()));
  let duplicatesHidden = 0;
  const ranked: Array<JobListingFixture & { score: number; reason: string }> = [];
  const seenThisRun = new Set<string>();
  for (const job of listings) {
    if (seen.has(job.id) || seenThisRun.has(job.id)) { duplicatesHidden += 1; continue; }
    seenThisRun.add(job.id);
    let score = 0;
    const reasons: string[] = [];
    if (job.salary >= salaryTarget) { score += 40; reasons.push('meets salary'); }
    else score += Math.max(0, 20 - (salaryTarget - job.salary) / 5000);
    if (location && job.location.toLowerCase().includes(location)) { score += 30; reasons.push(location); }
    const overlap = job.stack.filter((s) => stack.has(s.toLowerCase())).length;
    score += overlap * 10;
    if (overlap) reasons.push(`stack×${overlap}`);
    ranked.push({ ...job, score, reason: reasons.join(', ') || 'partial fit' });
  }
  ranked.sort((a, b) => b.score - a.score);
  return { ranked, duplicatesHidden, topMatches: ranked.slice(0, 3) };
}

export function detectResearchConflicts(entries: ProjectKnowledgeEntry[]): string[] {
  const conflicts: string[] = [];
  const texts = entries.map((e) => `${e.title} ${e.summary}`.toLowerCase());
  const has = (re: RegExp) => texts.some((t) => re.test(t));
  if (has(/\b(400|450)\s*km\b/) && has(/\b(250|280|300)\s*km\b/)) {
    conflicts.push('Conflicting claims: EV range figures disagree across sources (≈250–300 km vs ≈400–450 km).');
  }
  if (has(/\bcheap(er)? to (run|own)\b/) && has(/\b(expensive|costly) to (run|own)\b/)) {
    conflicts.push('Conflicting claims: ownership cost narratives disagree.');
  }
  if (has(/\brecommend (buying|buy)\b/) && has(/\b(wait|not (yet )?buy|defer)\b/)) {
    conflicts.push('Conflicting claims: buy-now vs wait recommendations.');
  }
  return conflicts;
}

export function buildEvComparisonTable(entries: ProjectKnowledgeEntry[]): ComparisonRow[] {
  return [
    { dimension: 'Range', values: Object.fromEntries(entries.map((e) => { const m = e.summary.match(/(\d{2,3})\s*km/i); return [e.title, m ? `${m[1]} km` : '—']; })) },
    { dimension: 'Cost narrative', values: Object.fromEntries(entries.map((e) => [e.title, e.summary.slice(0, 120)])) },
  ];
}

export function researchRecommendation(project: PersistentProject): string {
  const conflicts = (project.metrics.conflicts as string[] | undefined) ?? [];
  const knowledge = project.knowledgeEntries;
  const lines = [
    'Recommendation from accumulated research (not a cold web search):', '',
    knowledge.length ? `Based on ${knowledge.length} saved source(s) on “${project.title}”.` : 'Knowledge store is still thin — capture more sources first.',
    '', 'Trade-offs:',
    '- Upfront price vs fuel/energy savings over 3–5 years',
    '- Range anxiety vs daily commute distance',
    '- Charging access at home vs public network density', '',
  ];
  if (conflicts.length) { lines.push('Conflicts noted:'); for (const c of conflicts) lines.push(`- ${c}`); lines.push(''); }
  lines.push('Remaining unknowns:', '- Real-world winter range for your commute', '- Home charger install cost / HOA constraints', '- Total cost of ownership vs your current ICE car', '');
  lines.push(knowledge.length >= 2 ? 'Lean: continue research 2–4 more weeks, then buy if charger path is clear — unless commute exceeds conservative range figures.' : 'Need more sources before a firm buy/wait call.');
  return lines.join('\n');
}

export function careerNoProgressNudge(project: PersistentProject, now = Date.now()): string {
  const idleDays = Math.floor((now - project.lastProgressAt) / MS_DAY);
  return `No progress detected on “${project.title}” for ~${Math.max(idleDays, 7)} days. Suggest adjusting the schedule: drop to 3×45m study blocks this week, or move the system-design milestone. Notification frequency settings are respected — this is a single coach nudge, not a spam loop.`;
}

export function careerProgressReview(project: PersistentProject, now = Date.now()): string {
  const done = project.milestones.filter((m) => m.status === 'done').length;
  const total = project.milestones.length || 1;
  const ratio = done / total;
  const elapsed = now - project.createdAt;
  const target = project.targetDate ?? project.createdAt + 365 * MS_DAY;
  const expected = elapsed / Math.max(target - project.createdAt, 1);
  const realistic = ratio + 0.15 >= expected
    ? 'The 12-month Staff Engineer target still looks realistic if weekly study holds.'
    : 'The 12-month target is at risk — pace is behind the roadmap.';
  const weak = (project.metrics.requiredSkills as string[] | undefined)?.slice(0, 2) ?? ['System design', 'Leadership'];
  return `Progress: ${done}/${total} milestones (${Math.round(ratio * 100)}%). ${realistic} Focus on weak areas: ${weak.join(', ')}.`;
}

export function lifePlannerBriefingSlice(project: PersistentProject): string {
  const items = (project.metrics.briefingItems as string[] | undefined) ?? ['Book flights this week', 'Schedule visa appointment within two weeks', 'Electricity providers not researched yet'];
  return ['Life Planner focus:', ...items.map((i) => `- ${i}`)].join('\n');
}

export function homeStandingSummary(project: PersistentProject): string {
  const m = project.metrics;
  return [
    `Where am I on ${project.title}?`, '',
    `Mortgage: ${Number(m.banksCompared ?? 0)} bank(s) compared`,
    `Apartments: ${Number(m.apartmentsViewed ?? 0)} viewed / ${Number(m.apartmentsShortlisted ?? 0)} shortlisted`,
    `Taxes: ${m.taxesEstimated ? 'estimated' : 'not researched'}`,
    `Insurance: ${m.insuranceResearched ? 'researched' : 'not researched'}`,
    `Lawyer: ${m.lawyerSelected ? 'selected' : 'not selected'}`, '',
    'Estimated timeline: 8–10 weeks to a competitive offer if mortgage pre-approval lands this month.', '',
    "Want next week's action plan?",
  ].join('\n');
}

export function homeNextWeekPlan(project: PersistentProject): string {
  return [
    `Next week's action plan for ${project.title}:`,
    '1. Finish comparing one more mortgage offer',
    '2. Tour top-3 shortlisted apartments',
    '3. Run tax estimate with known purchase price band',
    '4. Shortlist two insurance quotes',
    '5. Book intro call with a conveyancing lawyer',
  ].join('\n');
}
