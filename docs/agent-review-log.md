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

### 2026-08-07 — Agent A0 (Router research ADR)
- **Test IDs:** RTE-01…09, SKL-01…03 (research only; no e2e in this pod)
- **Severity:** question
- **Type:** open-question
- **Summary:** Should B1 ship Stage-2 WebLLM structured routing in Wave 1, or defer Stage-2 until local JSON reliability is proven?
- **Detail:** ADR recommends cascade Stage0→1→2→clarify/fallback. Stage-2 uses the same on-device WebLLM with a skill-id enum. Small models often emit malformed JSON; Phil already has repair paths, but an extra route call hurts latency. Alternative for Wave 1: Stage0+Stage1+clarify+fallback only, add Stage-2 in Wave 2 if goldens misroute. ADR §13 Q1.
- **Suggested owner:** B1, human PM

### 2026-08-07 — Agent A0 (Router research ADR)
- **Test IDs:** SKL-01, RTE-07
- **Severity:** should-fix
- **Type:** open-question
- **Summary:** Freeze skill id naming: dotted namespaces (`reminder.create`) vs flat legacy ids (`reminder`) for A1 contract stubs.
- **Detail:** Current code uses flat `SkillId` union. ADR prefers dotted namespaces for project/email families. A1 and B1 must pick one freeze for shared types the same day as ADR merge to avoid dual vocabularies in e2e asserts (`route.skills = ['reminder.create']`). ADR §13 Q2.
- **Suggested owner:** A1, B1

### 2026-08-07 — Agent A0 (Router research ADR)
- **Test IDs:** RTE-04, WF-01
- **Severity:** question
- **Type:** open-question
- **Summary:** How should multi-skill plans be authored without Stage-2—declarative companions on skills, or LLM-only ordered plans?
- **Detail:** Compare/decide + optional memory.save needs ordered `SkillPlan` steps. If Stage-2 is deferred, B1 needs another way to emit multi-step plans (skill `planTemplates` / utterance cue rules). ADR recommends template skill selection directly for projects; multi-step research is the open design point. ADR §13 Q3.
- **Suggested owner:** B1, C3

### 2026-08-07 — Agent A0 (Router research ADR)
- **Test IDs:** PRJ-CA-01, PRJ-01, RTE-02
- **Severity:** question
- **Type:** open-question
- **Summary:** Confirm router selects template skills directly vs generic `project.create` that dispatches templates internally.
- **Detail:** ADR recommendation is direct selection of `project.career_accelerator` (etc.) with `project.create` only for `custom`. If A1/B2 prefer a single create tool + template field, routing goldens and SKL-01 enumerable list change. Needs explicit agreement before C1 registers templates. ADR §13 Q6.
- **Suggested owner:** B1, B2, C1, human PM

### 2026-08-07 — Agent A0 (Router research ADR)
- **Test IDs:** WF-04, SET-08, RTE-09
- **Severity:** should-fix
- **Type:** open-question
- **Summary:** Who owns absolute datetime parsing in device TZ—“next Tuesday 3 PM”—reminder skill (C3) or shared util from B1?
- **Detail:** Locked decision: device TZ only. Current `parseReminderInMinutes` only handles relative durations. Absolute parse is required for WF-04/SET-08. ADR places TZ on `RouteContext` but leaves chrono util ownership open. ADR §13 Q7.
- **Suggested owner:** B1, C3, B5

### 2026-08-07 — Agent A0 (Router research ADR)
- **Test IDs:** PRO-01…07, PRJ-GA-02
- **Severity:** question
- **Type:** open-question
- **Summary:** Should proactive/browse detectors call `router.route()` with synthetic utterances or use dedicated proactive-only skill matchers?
- **Detail:** Plan says proactive feeds the same factory (no second router). Synthetic utterances are simpler but fragile; `trigger: 'proactive'` + detector id may be cleaner. Affects C2/C1 integration with B1 API. ADR §13 Q5.
- **Suggested owner:** B1, C2

### 2026-08-07 — Agent A0 (Router research ADR)
- **Test IDs:** RTE-*, SKL-*
- **Severity:** FYI
- **Type:** deferred
- **Summary:** Embeddings/kNN and second classifier models explicitly deferred; cascade + Google/TZ/Calendar context documented in ADR.
- **Detail:** Full write-up at `docs/adr/0001-skills-router.md`. No product `src/**` changes in A0. Implementers must follow ADR or amend it before inventing a competing router.
- **Suggested owner:** B1, D2

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

### 2026-08-07 — Agent A3 (Business / GTM)
- **Test IDs:** BIZ-01, BIZ-02, BIZ-03, BIZ-04, BIZ-09, BIZ-10
- **Severity:** FYI
- **Type:** deferred
- **Summary:** Shipped landing, legal, CWS copy, demo script, icons, and BIZ smoke specs; left in-extension Feedback / analytics toggles to later pods.
- **Detail:** Delivered `website/index.html` (+ privacy/terms/styles), `docs/cws-listing.md`, `docs/demo-script.md` (≤90s incl. Calendar + Projects “Where am I?”), replaced `public/icons/icon{16,32,48,128,512}.png`, and `e2e/business.spec.ts` for BIZ-01…04 and BIZ-09…10. BIZ-05 (Feedback button), BIZ-06…08 (analytics/crash defaults + opt-in) need Privacy/Settings UI from B4/B5 — privacy policy already documents analytics/crash **default OFF**. Waitlist form uses `mailto:waitlist@phil.local` placeholder until a real ESP is chosen. CWS store URL and production privacy/legal emails are placeholders.
- **Suggested owner:** B4/B5 for BIZ-05…08 wiring; D2 for store URL + real contact emails; human PM for waitlist ESP

### 2026-08-07 — Agent A3 (Business / GTM)
- **Test IDs:** BIZ-01, BIZ-04
- **Severity:** question
- **Type:** open-question
- **Summary:** Install CTA currently points at waitlist until CWS is published; icon512 is extra (not required by MV3 manifest).
- **Detail:** Landing primary CTA is “Join the waitlist” (`#waitlist`) with note that install will point at CWS once live. Manifest still references 16/32/48/128 only; `icon512.png` is for store promo crops. Chose `website/**` (not `docs/landing/`) per plan ownership.
- **Suggested owner:** human PM / D2

### 2026-08-07 — Agent A3 (Business / GTM)
- **Test IDs:** BIZ-05, BIZ-06, BIZ-07, BIZ-08
- **Severity:** should-fix
- **Type:** skipped-test
- **Summary:** Encoded BIZ-05…08 as `test.skip` in `e2e/business.spec.ts` until Privacy/Settings ships Feedback + analytics/crash controls.
- **Detail:** A2 had scaffolded failing extension-fixture asserts for these IDs; A3 replaced with explicit skips so BIZ-01…04 / 09…10 stay green without a full extension build. Privacy policy already states analytics/crash default OFF. Un-skip when B4/B5 land UI.
- **Suggested owner:** B4, B5, D2

