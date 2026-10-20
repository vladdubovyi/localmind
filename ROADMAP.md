# Phil roadmap

## Long-term project context saving

Persistent Projects already store milestones, knowledge entries, linked goals/reminders, and a short `statusSummary`. That is enough for a session, but multi-month projects lose the thread: decisions get buried in chat, constraints live only in the user’s head, and “Where am I?” regenerates from thin metrics instead of a maintained context pack.

### Context model
- [ ] Add a first-class project context store (alongside `knowledgeEntries`): typed notes for decisions, constraints, stakeholders, open questions, and “left off here” checkpoints
- [ ] Support pinning / archiving context items so the active set stays small while history remains queryable
- [ ] Attach optional source metadata (Agent turn, page URL, research compare, manual entry) without requiring a network call
- [ ] Keep context scoped to `projectId` (and optional `parentProjectId` for Life Planner subprojects)

### Capture paths
- [ ] Agent skill / tool: `project_context_save` with confirm when the user says “remember this for the project”
- [ ] Selection-menu action: save highlighted page text into the active project’s context (summary + raw excerpt)
- [ ] Research flow: after a compare / recommendation, offer “save to project context” for the chosen options and rejected alternatives
- [ ] Auto-propose (not auto-write) context updates when a milestone status flips or a linked goal completes

### Compaction for on-device models
- [ ] Periodic standing-summary refresh: fold new context into `metrics.standingSummary` / `statusSummary` within a token budget
- [ ] Layered pack for Agent injection: pinned constraints → recent checkpoints → top knowledge → open milestones
- [ ] Manual “compact now” from the Projects panel; show before/after length so the user can undo
- [ ] Regression tests: long project fixtures still produce a usable “Where am I?” under the WebLLM context limit

### UI and privacy
- [ ] Projects panel section to browse, edit, pin, and delete context items
- [ ] Export / clear per project (wire into Privacy dashboard inventory)
- [ ] Never sync context off-device; same local storage rules as existing project knowledge

---

## Smart goal suggestions

Goals today are mostly user-created (`goal_create`) with optional `projectId` when a project is active. Templates know typical next steps (Career study blocks, Job Hunt applications, Research decision criteria), but Phil does not yet surface those as ranked, dismissible suggestions.

### Suggestion generation
- [ ] Template playbooks emit candidate goals from open milestones and missing metrics (e.g. Job Hunt without salary/location constraints → suggest “Set search constraints”)
- [ ] Include milestone-derived goals: “Finish {milestone} by {targetDate}” when a target exists and status is not `done`
- [ ] Include activity-derived candidates from local Focus / browser-memory signals (e.g. repeated leisure drift during Career study hours → suggest a focus goal)
- [ ] Cap the inbox (e.g. 3–5 active suggestions); regenerate when project or milestone state changes

### Ranking and presentation
- [ ] Score by: deadline proximity, milestone criticality, days since `lastProgressAt`, and whether a linked goal already covers the same intent
- [ ] Deduplicate against existing `linkedGoalIds` and recently dismissed suggestions
- [ ] Surface in Goals tab + proactive inbox; Agent can list suggestions via a skill
- [ ] Respect quiet hours and notification policy (suggest silently in-app when quiet)

### Accept / edit / dismiss
- [ ] One-tap accept → `goal_create` with `projectId`, title, and optional schedule defaults
- [ ] Edit-before-accept sheet (title, target date, link to a different milestone)
- [ ] Dismiss with reason tags (not relevant / too soon / already doing it) to suppress similar candidates
- [ ] E2E: suggestion appears for a seeded Career project, accept links goal, dismiss keeps it from returning for N days

---

## Project breakdown

Milestones exist on `PersistentProject`, but breakdown stops there: no task layer, weak dependency handling, and “what next?” is playbook copy rather than a live plan. Long projects need a tree Phil can coach against and re-plan when scope shifts.

### Structure
- [ ] Extend milestones with child tasks (title, status, optional `targetDate`, optional `dependsOn` task/milestone ids)
- [ ] Support nested milestones via existing `parentMilestoneId` in the Projects UI (create, indent, reparent)
- [ ] Template starters: Career / Job Hunt / Research / Life Planner generate an initial milestone→task tree on project create (editable, not locked)
- [ ] Import from a paste or Agent plan (“break this into a 6-week plan”) with user confirmation before write

### Next-up engine
- [ ] Compute unblocked work: tasks with dependencies satisfied, preferring soonest `targetDate`
- [ ] Agent tool / Today hook: `project_next` returns 1–3 concrete next actions for the active project
- [ ] Explain why each item was chosen (deadline, dependency unlock, stalled milestone)
- [ ] Allow snooze / skip without marking done; skipped items rotate down the queue

### Progress and standing summary
- [ ] Roll up task → milestone → project `progressRatio` and refresh standing summary text
- [ ] “Where am I?” includes: % complete, blocked count, next deadline, last progress age
- [ ] Milestone auto-status: all tasks done → `done`; any in progress → `in_progress` (with manual override)
- [ ] Unit tests on roll-up and dependency unblock with fixture trees

### Re-plan without losing history
- [ ] “Re-plan from here” keeps completed work, archives cancelled tasks, and inserts new milestones/tasks
- [ ] Diff view before apply (added / removed / date shifts)
- [ ] Snapshot previous plan into project context as a checkpoint so history is not destroyed
- [ ] E2E: Life Planner subproject re-plan preserves parent links and completed milestones

---

## Smart day tracker (long-term goals + project timelines)

Today / Focus / morning briefing / evening recap are day-centric. They mention the active project but do not schedule the day against multi-week timelines. The day tracker should bias toward long-horizon progress: protect milestone work, surface deadline risk, and still fit in a normal workday.

### Day plan from timelines
- [ ] Build a daily plan from: due/overdue project tasks, linked goals, reminders, and open milestones with near `targetDate`
- [ ] Time-box suggestions using device TZ only (no separate timezone picker)
- [ ] Split the plan into “must move today” (deadline / unblock) vs “keep momentum” (long-term habit goals)
- [ ] Persist the day’s plan locally so Agent, Today, and evening recap share the same list

### Briefing and recap
- [ ] Morning briefing: top project risks this week + today’s must-move items + optional calendar blocks when Calendar is enabled
- [ ] Evening recap: what advanced which milestone, what slipped, and one suggested carry-over for tomorrow
- [ ] Multi-project mode: if several projects are active, weight by nearest deadline and `lastProgressAt` staleness
- [ ] Exec Day template: denser day plan; Life Planner: include subproject slices

### Timeline-aware coaching
- [ ] Drift detector: expected progress vs actual (e.g. milestone target in 14 days, 0 tasks done this week)
- [ ] Focus integration: if leisure dominates a day that had milestone work planned, nudge toward the next unblocked task (policy-gated)
- [ ] Weekly thin roll-up inside Today (not a separate product): milestone deltas across the last 7 local days
- [ ] Proactive suggestions that cite the timeline (“Mortgage pre-approval target is in 10 days; next task is X”)

### Calendar and Focus hooks
- [ ] When Calendar is connected, treat today’s events as busy blocks and place project work in free windows
- [ ] When Calendar is skipped, plan from tasks/goals only and optionally prompt to enable later (existing Privacy path)
- [ ] Focus categories can tag sessions against a project/milestone for the evening roll-up
- [ ] E2E fixtures: seeded project timeline → morning plan contains expected tasks; drift nudge fires when progress is stalled
