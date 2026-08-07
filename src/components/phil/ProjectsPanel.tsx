/**
 * Projects panel — Persistent Projects list + detail (plan §16 / PRJ-01…06).
 */
import { useCallback, useEffect, useState } from 'react';
import { createProjectFromUi, createReminderFromUi } from '@/phil/clientActions';
import type { PersistentProject, ProjectTemplate } from '@/phil/projectTypes';
import {
  acceptHomeNextWeekPlan,
  assistJobApplication,
  associateBrowseVisits,
  buildResearchRecommendation,
  captureResearchPages,
  markCareerBrowseRelevant,
  runCareerCoach,
  runJobSearch,
  scheduleCareerStudyReminders,
  seedHomeStanding,
} from '@/storage/projectActions';
import {
  addKnowledgeEntry,
  formatProjectProgress,
  getProject,
  listProjects,
  putProject,
  setActiveProjectId,
  templateLabel,
} from '@/storage/projects';
import type { JobApplication, JobListingFixture } from '@/storage/projectPlaybooks';
import { cn } from '@/utils';

const TEMPLATE_OPTIONS: { value: ProjectTemplate; label: string }[] = [
  { value: 'career', label: 'Career' },
  { value: 'job_hunt', label: 'Job hunt' },
  { value: 'research', label: 'Research' },
  { value: 'exec_day', label: 'Exec day' },
  { value: 'life_move', label: 'Life move' },
  { value: 'custom', label: 'Custom' },
];

const JOB_FIXTURE: JobListingFixture[] = [
  { id: 'job-1', title: 'Senior Backend Engineer', company: 'Nordic Cloud', salary: 130_000, currency: 'EUR', location: 'remote', stack: ['backend', 'Node.js', 'TypeScript'] },
  { id: 'job-2', title: 'Backend Engineer', company: 'Duplicate Corp', salary: 125_000, currency: 'EUR', location: 'remote', stack: ['backend', 'Go'] },
  { id: 'job-2', title: 'Backend Engineer (repost)', company: 'Duplicate Corp', salary: 125_000, currency: 'EUR', location: 'remote', stack: ['backend', 'Go'] },
  { id: 'job-3', title: 'Platform Engineer', company: 'EU Fintech', salary: 140_000, currency: 'EUR', location: 'remote EU', stack: ['backend', 'Python', 'TypeScript'] },
];
const EV_FIXTURE_PAGES = [
  { url: 'https://phil.local/fixtures/ev-range-optimistic.html', title: 'EV Range Review A', summary: 'Claims 450 km real-world range; recommend buying this year; cheaper to run.' },
  { url: 'https://phil.local/fixtures/ev-range-conservative.html', title: 'EV Range Review B', summary: 'Claims 280 km winter range; wait on purchase; expensive to own without home charger.' },
  { url: 'https://phil.local/fixtures/ev-tco.html', title: 'EV TCO Calculator', summary: 'Total cost depends on commute; conflicting with cheap-to-run claims.' },
];
const HOME_BROWSE_FIXTURE = [
  { url: 'https://phil.local/fixtures/mortgage-compare.html', title: 'Mortgage comparison banks' },
  { url: 'https://phil.local/fixtures/tax-calculator.html', title: 'Home tax calculator' },
  { url: 'https://phil.local/fixtures/apartment-listing.html', title: 'Apartment listing downtown' },
  { url: 'https://phil.local/fixtures/reddit-home.html', title: 'Reddit first-home discussion' },
];
function salaryLabel(p: PersistentProject): string | null {
  const salary = p.metrics.salaryTarget;
  if (salary == null) return null;
  const cur = p.metrics.salaryCurrency === 'EUR' ? '€' : '$';
  return `${cur}${Math.round(Number(salary) / 1000)}k`;
}

function useProjectsRefresh(onChange: () => void): void {
  useEffect(() => {
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== 'local') return;
      if (changes.philProjects || changes.philActiveProject) onChange();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [onChange]);
}

export function ProjectsPanel() {
  const [projects, setProjects] = useState<PersistentProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<ProjectTemplate>('custom');
  const [busy, setBusy] = useState(false);
  const [lastSetupMsg, setLastSetupMsg] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const all = await listProjects();
    setProjects(all);
    const stored = await chrome.storage.local.get('philActiveProject');
    const sel = stored.philActiveProject as { activeProjectId?: string | null } | undefined;
    const aid = sel?.activeProjectId ?? null;
    setActiveId(aid);
    setSelectedId((prev) => {
      if (prev && all.some((p) => p.id === prev)) return prev;
      return aid ?? all[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useProjectsRefresh(() => {
    void refresh();
  });

  const selected = projects.find((p) => p.id === selectedId) ?? null;

  const create = async () => {
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      const utterance = template === 'job_hunt' && !/€|120/.test(t) ? `${t} remote backend job paying at least €120k` : t;
      const { project } = await createProjectFromUi({ title: t, template, utterance });
      setLastSetupMsg(project.statusSummary ?? `I've set up your ${project.title} project — speaking in project terms from here.`);
      setActionMsg(null);
      setTitle('');
      setSelectedId(project.id);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const runTemplateAction = async (action: string) => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      let msg = '';
      switch (action) {
        case 'schedule-study': {
          const r = await scheduleCareerStudyReminders(selected.id);
          msg = `Recurring study reminders linked (${r.reminderIds.length}).`;
          break;
        }
        case 'browse-aware': {
          await markCareerBrowseRelevant(selected.id, { url: 'https://phil.local/fixtures/system-design-staff.html', title: 'System design for staff engineers' });
          msg = 'Browse awareness: system design article suggested as relevant — productive toward this Career Accelerator project.';
          break;
        }
        case 'no-progress': {
          const advanced = Date.now();
          const p = await getProject(selected.id);
          if (p) await putProject({ ...p, lastProgressAt: advanced - 7 * 86_400_000 });
          const updated = await runCareerCoach(selected.id, 'no_progress', advanced);
          msg = String(updated.metrics.coachNudge ?? 'No progress — adjusting the schedule.');
          break;
        }
        case 'monthly-review': {
          const p = await getProject(selected.id);
          if (p) {
            const milestones = p.milestones.map((m, i) => i === 0 ? { ...m, status: 'done' as const } : m);
            await putProject({ ...p, milestones, createdAt: Date.now() - 30 * 86_400_000, lastProgressAt: Date.now() });
          }
          const updated = await runCareerCoach(selected.id, 'monthly');
          msg = String(updated.metrics.progressReview ?? '12-month realism review');
          break;
        }
        case 'job-search': msg = (await runJobSearch(selected.id, JOB_FIXTURE)).message; break;
        case 'job-apply': {
          const last = selected.metrics.lastJobSearch as { topMatches?: JobListingFixture[] } | undefined;
          msg = (await assistJobApplication(selected.id, last?.topMatches?.[0] ?? JOB_FIXTURE[0]!)).message;
          break;
        }
        case 'research-capture': {
          const updated = await captureResearchPages(selected.id, EV_FIXTURE_PAGES);
          msg = String(updated.metrics.lastCaptureNote ?? 'Saved to project — comparison table; conflicting claims detected.');
          break;
        }
        case 'research-recommend': msg = await buildResearchRecommendation(selected.id); break;
        case 'silent-browse': {
          await associateBrowseVisits(selected.id, HOME_BROWSE_FIXTURE, { silent: true });
          msg = 'Silent browse log / knowledge candidates associated (mortgage, tax, apartment, Reddit). No notification storm.';
          break;
        }
        case 'seed-standing': {
          await seedHomeStanding(selected.id, { banksCompared: 3, apartmentsViewed: 12, apartmentsShortlisted: 3, taxesEstimated: true, insuranceResearched: false, lawyerSelected: false });
          msg = "Standing seeded for Where am I? timeline + next week's action plan prompt.";
          break;
        }
        case 'next-week-plan': msg = await acceptHomeNextWeekPlan(selected.id); break;
        default: msg = 'Unknown action';
      }
      setActionMsg(msg);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const setActive = async (id: string) => {
    await setActiveProjectId(id);
    setActiveId(id);
    setSelectedId(id);
  };

  const addStubKnowledge = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await addKnowledgeEntry(selected.id, {
        title: 'Starter research note',
        summary: 'Knowledge stub for project artifacts — replace with saved research.',
        tags: ['stub'],
        source: 'user',
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const addLinkedReminder = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await createReminderFromUi({
        text: `Check progress on ${selected.title}`,
        when: Date.now() + 60 * 60_000,
        projectId: selected.id,
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto px-4 py-4">
      <div>
        <h2 className="font-display text-lg text-fg">Projects</h2>
        <p className="mt-1 text-xs text-muted">
          Long-horizon plans with milestones, knowledge, and linked reminders. Ask “What
          projects am I working on?” or set an active project for Agent turns.
        </p>
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        Phil replies in project terms — e.g. “I've set up your Move to Spain project…” —
        not raw tool lists. Ask “Where am I?” for workstream status and a next-week plan.
      </p>

      {lastSetupMsg && (
        <p className="mt-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs text-fg-dim">
          {lastSetupMsg}
        </p>
      )}
      {actionMsg && (
        <pre data-testid="project-action-msg" className="mt-2 whitespace-pre-wrap rounded-lg border border-border px-3 py-2 font-sans text-xs text-fg-dim">{actionMsg}</pre>
      )}

      <div className="mt-4 space-y-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Staff Engineer Promotion…"
          disabled={busy}
          aria-label="New project title"
          className="w-full rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create();
          }}
        />
        <div className="flex gap-2">
          <select
            value={template}
            onChange={(e) => setTemplate(e.target.value as ProjectTemplate)}
            disabled={busy}
            aria-label="Project template"
            className="min-w-0 flex-1 rounded-xl border border-border bg-panel px-3 py-2 text-sm outline-none focus:border-accent/50"
          >
            {TEMPLATE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy || !title.trim()}
            className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>

      <h3 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">
        Your projects
      </h3>
      <ul className="mt-2 space-y-1.5">
        {projects.length === 0 && (
          <li className="text-sm text-muted">No projects yet — create one above.</li>
        )}
        {projects.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={cn(
                'flex w-full items-start justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm',
                selectedId === p.id
                  ? 'border-accent/40 bg-accent/5'
                  : 'border-border-subtle bg-panel/50',
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-fg">{p.title}</div>
                <div className="mt-0.5 text-[11px] text-muted">
                  {templateLabel(p.template)} · {p.status}
                  {activeId === p.id ? ' · active project' : ''}
                </div>
              </div>
              {activeId !== p.id && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    void setActive(p.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.stopPropagation();
                      void setActive(p.id);
                    }
                  }}
                  className="shrink-0 text-[11px] text-accent hover:underline"
                >
                  Set active
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {selected && (
        <div className="mt-5 space-y-3 border-t border-border-subtle pt-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-display text-base text-fg">{selected.title}</h3>
              <p className="mt-0.5 text-[11px] text-muted">
                {templateLabel(selected.template)} · {selected.status}
                {activeId === selected.id ? ' · active project' : ''}
              </p>
            </div>
            {activeId !== selected.id && (
              <button
                type="button"
                onClick={() => void setActive(selected.id)}
                className="shrink-0 rounded-lg border border-border px-2 py-1 text-[11px] text-muted hover:border-accent/40 hover:text-fg"
              >
                Set active
              </button>
            )}
          </div>

          {selected.statusSummary && (
            <p className="text-xs text-fg-dim">{selected.statusSummary}</p>
          )}


          {selected.template === 'career' && (
            <div className="space-y-2" data-testid="career-playbook">
              <p className="text-xs text-fg-dim">~12-month target{selected.targetDate ? ` · ${new Date(selected.targetDate).toLocaleDateString()}` : ''}{selected.metrics.weeklyStudyHours ? ` · ${selected.metrics.weeklyStudyHours}h/week study` : ''}</p>
              {Array.isArray(selected.metrics.requiredSkills) && (<p className="text-xs text-muted">Skills: {(selected.metrics.requiredSkills as string[]).join(', ')}</p>)}
              {Array.isArray(selected.metrics.roadmap) && (
                <div><h4 className="text-[11px] font-medium uppercase tracking-wide text-muted">Learning roadmap</h4>
                  <ul className="mt-1 space-y-0.5">{(selected.metrics.roadmap as string[]).map((r) => (<li key={r} className="text-xs text-fg-dim">{r}</li>))}</ul></div>
              )}
              {typeof selected.metrics.todayStudyTask === 'string' && (<p className="text-xs text-fg-dim">{selected.metrics.todayStudyTask}</p>)}
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('schedule-study')} className="text-[11px] text-accent hover:underline disabled:opacity-50">Schedule recurring study</button>
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('browse-aware')} className="text-[11px] text-accent hover:underline disabled:opacity-50">Simulate browse awareness</button>
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('no-progress')} className="text-[11px] text-accent hover:underline disabled:opacity-50">Week later: no progress nudge</button>
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('monthly-review')} className="text-[11px] text-accent hover:underline disabled:opacity-50">Month later: progress review</button>
              </div>
            </div>
          )}
          {selected.template === 'job_hunt' && (
            <div className="space-y-2" data-testid="jobhunt-playbook">
              <p className="text-xs text-fg-dim">Constraints: {salaryLabel(selected) ?? '—'} · {String(selected.metrics.locationPreference ?? '—')} · stack {((selected.metrics.techStack as string[]) ?? []).join(', ') || '—'}</p>
              <p className="text-[11px] text-muted">Preferred companies: {((selected.metrics.preferredCompanies as string[]) ?? []).length ? (selected.metrics.preferredCompanies as string[]).join(', ') : '(empty — add later)'}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('job-search')} className="text-[11px] text-accent hover:underline disabled:opacity-50">Run daily job search</button>
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('job-apply')} className="text-[11px] text-accent hover:underline disabled:opacity-50">Application assistance</button>
              </div>
              {((selected.metrics.applications as JobApplication[] | undefined) ?? []).map((a) => (
                <p key={a.jobId} className="text-xs text-fg-dim">{a.title} @ {a.company} — application status: {a.status}</p>
              ))}
            </div>
          )}
          {selected.template === 'research' && (
            <div className="space-y-2" data-testid="research-playbook">
              <p className="text-xs text-muted">Knowledge store {selected.knowledgeEntries.length === 0 ? 'empty but ready' : `has ${selected.knowledgeEntries.length} entries`}</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('research-capture')} className="text-[11px] text-accent hover:underline disabled:opacity-50">Capture EV fixtures</button>
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('research-recommend')} className="text-[11px] text-accent hover:underline disabled:opacity-50">What&apos;s your recommendation?</button>
              </div>
              {((selected.metrics.conflicts as string[] | undefined) ?? []).map((c) => (<p key={c} className="text-xs text-fg-dim">{c}</p>))}
              {((selected.metrics.comparisonTable as Array<{ dimension: string; values: Record<string, string> }> | undefined) ?? []).map((row) => (
                <p key={row.dimension} className="text-xs text-fg-dim">Comparison table — {row.dimension}: {Object.values(row.values).join(' · ')}</p>
              ))}
            </div>
          )}
          {selected.template === 'life_move' && !selected.metrics.homePurchase && (
            <div className="space-y-2" data-testid="life-playbook">
              {Array.isArray(selected.metrics.missingDocuments) && (<p className="text-xs text-fg-dim">Missing documents / not-started streams: {(selected.metrics.missingDocuments as string[]).join(', ')}</p>)}
              <p className="text-[11px] text-muted">Prioritization is date-based (earlier deadlines first) — visa &amp; flights.</p>
              {((selected.metrics.briefingItems as string[] | undefined) ?? []).map((b) => (<p key={b} className="text-xs text-fg-dim">{b}</p>))}
            </div>
          )}
          {(selected.metrics.homePurchase || /\b(home|house)\b/i.test(selected.title)) && (
            <div className="space-y-2" data-testid="home-playbook">
              <p className="text-xs text-fg-dim">Home purchase workstreams: mortgage, apartments, taxes, insurance, lawyer…</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('silent-browse')} className="text-[11px] text-accent hover:underline disabled:opacity-50">Simulate silent browse</button>
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('seed-standing')} className="text-[11px] text-accent hover:underline disabled:opacity-50">Seed Friday standing</button>
                <button type="button" disabled={busy} onClick={() => void runTemplateAction('next-week-plan')} className="text-[11px] text-accent hover:underline disabled:opacity-50">Generate next week&apos;s action plan</button>
              </div>
              {((selected.metrics.browseLog as Array<{ title: string; url: string }> | undefined) ?? []).map((b) => (
                <p key={b.url} className="text-xs text-fg-dim">Knowledge candidate: {b.title}</p>
              ))}
            </div>
          )}

          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Milestones / workstreams
            </h4>
            <ul className="mt-1.5 space-y-1">
              {selected.milestones.map((m) => (
                <li key={m.id} className="text-sm text-fg-dim">
                  <span className="text-muted">[{m.status}]</span> {m.title}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted">
                Project artifacts
              </h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void addLinkedReminder()}
                  disabled={busy}
                  className="text-[11px] text-accent hover:underline disabled:opacity-50"
                >
                  + linked reminder
                </button>
                <button
                  type="button"
                  onClick={() => void addStubKnowledge()}
                  disabled={busy}
                  className="text-[11px] text-accent hover:underline disabled:opacity-50"
                >
                  + knowledge
                </button>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted">
              {selected.linkedGoalIds.length} linked goal(s) ·{' '}
              {selected.linkedReminderIds.length} linked reminder(s) ·{' '}
              {selected.knowledgeEntries.length} knowledge
            </p>
            {selected.knowledgeEntries.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {selected.knowledgeEntries.slice(0, 5).map((k) => (
                  <li key={k.id} className="text-sm text-fg-dim">
                    {k.title}
                    {k.summary ? (
                      <span className="block text-[11px] text-muted">{k.summary}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted">
              Where am I?
            </h4>
            <pre className="mt-1.5 whitespace-pre-wrap font-sans text-xs leading-relaxed text-fg-dim">
              {formatProjectProgress(selected)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
