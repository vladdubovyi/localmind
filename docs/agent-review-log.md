# Agent review log

Append-only log for unclear requirements, open questions, missing/skipped/deferred implementation across Phil go-live pods.

**Instructions:** Every Wave agent must append entries before finishing if anything was unclear, skipped, or deferred. See the go-live plan section “Agent review log”.

**Entry template:**

```markdown
### YYYY-MM-DD — Agent <ID> (<pod name>)
- **Test IDs:** e.g. WF-03, ONB-08
- **Severity:** blocker | should-fix | question | FYI
- **Type:** unclear-requirement | open-question | missing-impl | skipped-test | deferred | conflict-with-ADR
- **Summary:** one sentence
- **Detail:** what you saw / what you did instead / what review should decide
- **Suggested owner:** e.g. B3, D1, human PM
```

---

## Entries

### 2026-08-07 — Agent A1 (Wave 0 Contracts)
- **Test IDs:** RTE-*, SKL-*, PRJ-01…06 (types only)
- **Severity:** question
- **Type:** open-question
- **Summary:** A0 ADR (`docs/adr/0001-skills-router.md`) was not present when contracts were frozen; field names may need a same-day patch if ADR renames Skill/SkillPlan.
- **Detail:** Froze additive types on top of shipped `AgentSkill` / `routeGoal` → `AgentRoute`. New `Skill` uses `routeScore` + `execute` + `confirmationLevel`; `Skill.id` is `string` (dotted ids) while registry keeps `SkillId` union intact. `RouteContext` adds `utterance?`, `activeProjectId?`, `pageUrl?`, `selection?`, `modelReady?` without removing required `goal`. `NotImplementedError` lives in `src/agent/router/types.ts`. Sync with A0 when ADR lands.
- **Suggested owner:** A0 → A1 follow-up; B1 consumes

### 2026-08-07 — Agent A1 (Wave 0 Contracts)
- **Test IDs:** PRJ-JH-*, PRJ-LP-*
- **Severity:** should-fix
- **Type:** deferred
- **Summary:** `ProjectMetrics` is an open bag; job-hunt application status machine and Life Planner subproject nesting are only lightly typed.
- **Detail:** Core `PersistentProject` includes `parentProjectId?` and milestone `parentMilestoneId?`, plus optional salary/location/techStack metrics keys. Full application status enum (`saved → drafted → applied → follow-up`) and richer template metrics were left for B2/C1 so A1 does not over-constrain storage. Reminders/Goals gained optional `projectId?` on existing `src/phil/types.ts` interfaces.
- **Suggested owner:** B2 / C1

