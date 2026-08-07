/**
 * Projects panel — Persistent Projects list + detail (plan §16 / PRJ-01…06).
 */
import { useCallback, useEffect, useState } from 'react';
import { createProjectFromUi, createReminderFromUi } from '@/phil/clientActions';
import type { PersistentProject, ProjectTemplate } from '@/phil/projectTypes';
import {
  addKnowledgeEntry,
  formatProjectProgress,
  listProjects,
  setActiveProjectId,
  templateLabel,
} from '@/storage/projects';
import { cn } from '@/utils';

const TEMPLATE_OPTIONS: { value: ProjectTemplate; label: string }[] = [
  { value: 'career', label: 'Career' },
  { value: 'job_hunt', label: 'Job hunt' },
  { value: 'research', label: 'Research' },
  { value: 'exec_day', label: 'Exec day' },
  { value: 'life_move', label: 'Life move' },
  { value: 'custom', label: 'Custom' },
];

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
      const { project } = await createProjectFromUi({ title: t, template });
      setLastSetupMsg(
        `I've set up your ${project.title} project — speaking in project terms from here.`,
      );
      setTitle('');
      setSelectedId(project.id);
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
