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


### 2026-08-07 — Agent A2 (E2E scaffold + shipped regression)
- **Test IDs:** PAGE-*, SEL-*, SET-01, WF-11, WF-12; ONB/ERR/PRIV/MEM/SET-02…08/DAY/BRW/EA/PRO/POL/BIZ/CORE/WF/PRJ/RTE/SKL scaffold
- **Severity:** blocker
- **Type:** missing-impl | skipped-test
- **Summary:** Encoded all plan test IDs as Playwright titles; shipped PAGE/SEL/SET-01/WF-11/12 paths restored handoff; remaining groups intentionally red until owner pods implement.
- **Detail:**
  - **Product handoff fix (tiny):** Selection → Agent seed (`ChatApp`/`AgentPanel`) and empty-state PAGE chips (Summarize/Explain/Ask) so SEL/PAGE-04 are not blocked by the old “ask Agent manually” error.
  - **Likely green without model:** PAGE-04, SET-01, CORE-01…05, DAY-01 (partial), EA-04 (empty), BIZ-01…04/09/10 (when website assets present on branch).
  - **Need model / WebGPU (blocker if env lacks GPU):** PAGE-01…03, WF-11, SEL-01…05, WF-12, CORE-06/07/10, Gmail CORE-08/09.
  - **Red / fail-on-missing (expected):** ONB-01…08 (Calendar step ONB-08 missing), ERR-*, PRIV-*, MEM-*, SET-02…08, DAY-02…06, BRW-*, EA-01…02, PRO-*, POL-01…05 (POL-04 will fail on Milestone 4 memory stub), BIZ-05…08, WF-01…10/13…20, PRJ-*, RTE-*, SKL-*.
  - **SEL/PAGE regression note:** Prior handoff showed forbidden “Ask Phil what to do with the selection” error; fixed by seeding Agent. If model not ready, SEL tests may still time out waiting for Working… — log as env/model blocker, not missing ID.
  - **Fixtures:** `e2e/fixtures/article.html` + `articlePage`/`agentArticlePage` + `queueSelectionAction` harness.
- **Suggested owner:** B3 (ONB/ERR), B4 (PRIV/MEM), B5 (SET/POL), B1 (RTE/SKL), B2/C1 (PRJ), C2 (DAY/PRO), C3 (WF), C4 (BRW), A3/D2 (BIZ-05…08), D1 (CORE model CI)

### 2026-08-07 — Agent A2 (E2E scaffold run evidence)
- **Test IDs:** PAGE-01…04, SEL-01…05, SET-01, WF-11, WF-12, CORE-01…05
- **Severity:** blocker
- **Type:** missing-impl | deferred
- **Summary:** Shipped UI/handoff greens verified; model-grounded PAGE/WF-11 answers blocked by WebLLM not finishing in this environment.
- **Detail:**
  - **Green locally:** CORE-01…05, SET-01, PAGE-04, SEL-01…05, WF-12 (handoff: no forbidden “ask Agent manually” error; selection seed reaches Agent). SEL waits briefly for Working… then continues if model still restoring.
  - **Red / env blocker:** PAGE-01 (and same path for PAGE-02/03, WF-11) — Summarize chip starts Working… but turn does not finish within 90s (`WebLLM/model blocker (handoff/chips OK)`). Not a missing ID; needs cached model / WebGPU-ready profile for grounded replies.
  - **Not run full suite:** Remaining ONB/ERR/PRIV/MEM/SET-02…/DAY/BRW/EA/PRO/POL/BIZ-05…08/WF/PRJ/RTE/SKL intentionally fail-on-missing UI until owner pods land.
  - **Website note:** `e2e/business.spec.ts` expects A3 `website/**` assets; may fail on this branch until A3 merged.
- **Suggested owner:** D1/CI for model cache; B3+ for ONB; see prior A2 entry for group owners

### 2026-08-07 — Agent B1 (Skills + Router Factory)
- **Test IDs:** RTE-01…09, SKL-01…03
- **Severity:** should-fix
- **Type:** open-question
- **Summary:** Locked skill ids to **dotted namespaces** (`reminder.create`, etc.) with **aliases** for flat legacy ids (`reminder`) so both score/resolve.
- **Detail:** Canonical SkillPlan.debug.skills / e2e asserts use dotted ids. `getSkill('reminder')` resolves to `reminder.create`. AgentRoute bridge still surfaces legacy SkillId for useAgent fast-paths. A0 ADR §13 Q2 closed by B1.
- **Suggested owner:** C1/C3 follow same id convention when registering templates

### 2026-08-07 — Agent B1 (Skills + Router Factory)
- **Test IDs:** RTE-09, SKL-*
- **Severity:** should-fix
- **Type:** deferred
- **Summary:** **Stage-2 WebLLM structured routing deferred** for Wave 1 — ship Stage0+Stage1+clarify+fallback only; Stage-2 behind `enableStage2` + `llmRouter` (default off).
- **Detail:** Local JSON reliability + extra latency vs RTE-09. Cascade still accepts optional Stage-2 when flag set. Multi-skill compare/decide authored via Stage-1 utterance cues (`planTemplates`-style), not LLM. A0 ADR §13 Q1/Q3.
- **Suggested owner:** Wave 2 / D1 to enable Stage-2 once goldens prove JSON stable

### 2026-08-07 — Agent B1 (Skills + Router Factory)
- **Test IDs:** RTE-02, RTE-06, SKL-01, PRJ-*
- **Severity:** FYI
- **Type:** missing-impl
- **Summary:** Project template skills are **registered stubs** (score + execute message) for SKL-01 / RTE-02/06 routing; full Persistent Projects UI/storage and template execute bodies remain B2/C1.
- **Detail:** `project.career_accelerator`, `project.job_hunt`, `project.research_manager`, `project.life_planner`, `project.exec_day`, `project.create`, `project.status` register via `registerCoreSkills`. C1 should `registerSkill` (replace) with real implementations — do not edit factory core.
- **Suggested owner:** B2, C1

### 2026-08-07 — Agent B1 (Skills + Router Factory)
- **Test IDs:** WF-04, SET-08, RTE-01
- **Severity:** question
- **Type:** deferred
- **Summary:** Absolute datetime parsing (“next Tuesday 3 PM” in device TZ) still relative/`inMinutes` in reminder skill; TZ is on RouteContext but chrono util left for C3.
- **Detail:** Reminder routes Stage-0 correctly; creating absolute when= is C3/B5. Device TZ exposed on context.timeZone.
- **Suggested owner:** C3, B5

### 2026-08-07 — Agent B1 (Skills + Router Factory)
- **Test IDs:** RTE-*, SKL-*
- **Severity:** FYI
- **Type:** open-question
- **Summary:** B1 is exclusive owner of routing entry in `useAgent.ts` (resolveRoute → factory); other pods only `registerSkill`.
- **Detail:** `createRouterFactory` / `getDefaultRouter` / `registerSkill` live under `src/agent/router` + `src/agent/skills`. Test harness: `?philTest=1` → `window.__PHIL_ROUTER_TEST__` with `route.skills`.
- **Suggested owner:** all Wave1+ pods

### 2026-08-07 — Agent B2 (Persistent Projects core)
- **Test IDs:** PRJ-01…06
- **Severity:** FYI
- **Type:** deferred
- **Summary:** Shipped Persistent Projects storage/UI/tools; template playbooks and dotted skill ids left to C1/B1.
- **Detail:** `src/storage/projects.ts` (chrome.storage.local keys `philProjects` / `philActiveProject`), Projects tab + panel, tools `project_create|list|set_active|get|progress|add_knowledge`, light NL via `isProjectCreateGoal` + registry skill `project`, goals/reminders auto-link `projectId` when active, Today briefing mentions active project. Full Career/Job Hunt playbooks and router factory dotted ids (`project.career_accelerator`) are Wave 2 C1 / B1 — core uses flat `project` skill with TODO.
- **Suggested owner:** C1 (templates), B1 (router skill ids)

### 2026-08-07 — Agent B2 (Persistent Projects core)
- **Test IDs:** PRJ-01, PRJ-06
- **Severity:** question
- **Type:** open-question
- **Summary:** Confirmed A0 Q6 preference: single `project_create` + template field for Wave 1 core; C1 may later register template-specific skills that call the same store.
- **Detail:** UI create + NL heuristics cover PRJ-01 without model. Agent-loop NL path works when project skill wins routing; model-grounded “I’ve set up your …” replies still depend on tool finalize. E2e asserts UI create path.
- **Suggested owner:** B1, C1, human PM

### 2026-08-07 — Agent B3 (Onboarding + Errors)
- **Test IDs:** ONB-01…08, ERR-01…04
- **Severity:** should-fix
- **Type:** deferred | skipped-test
- **Summary:** Wired Calendar ONB-08 + ChatApp Onboarding/ModelRestoring/WebGPU recovery; full Google Calendar OAuth sync deferred to stub `calendarEnabled` flag.
- **Detail:** SetupWizard steps are welcome → browser → gmail → calendar → ready → model UI. Persistence: `onboarding.grantedCalendar` snapshot + live `agentSettings.calendarEnabled` for B4 Privacy/planning. Calendar connect requests identity/Google hosts when needed then sets the flag — no Calendar API event sync yet. Minimal webResearch SERP URL swap to Google to unblock ERR-03 (C3 still owns deeper research). ERR-02 full mid-load harness and ERR-03 live empty-SERP agent run still limited by e2e fixture (assert copy/UI affordances). ONB-06 asserts Resume/Retry copy rather than forced interrupt. Shared `ErrorRecovery` component added.
- **Suggested owner:** C3 (Calendar sync + research depth), B4 (Privacy reads calendarEnabled), D1 (model/GPU CI harness for ONB-05/06 interrupt)

### 2026-08-07 — Agent B3 (Onboarding + Errors)
- **Test IDs:** ERR-01
- **Severity:** FYI
- **Type:** open-question
- **Summary:** ERR-01 stubs `navigator.gpu.requestAdapter → null` via page init script after philPage seed; race with already-probed WebGPU may need fixture-level GPU disable for CI certainty.
- **Detail:** ChatApp probes via `probeWebGPU()` on mount. Reload after init script should re-probe; if flaky, recommend extension launch arg / CDP override in fixtures.
- **Suggested owner:** B3 follow-up / D1 fixtures

### 2026-08-07 — Agent B3 (Onboarding + Errors) — e2e evidence
- **Test IDs:** ONB-01…08, ERR-01…04
- **Severity:** FYI
- **Type:** deferred
- **Summary:** Local Playwright: **all ONB-01…08 and ERR-01…04 green** (12/12) on this branch.
- **Detail:** Ran `playwright test e2e/onboarding.spec.ts e2e/errors.spec.ts` → 12 passed. Environment has no WebGPU; model gate shows inline WebGPU recovery + catalog (Recommended/Download/Google/Retry copy). ERR-02/03 assert copy/UI affordances rather than forced mid-load / live empty-SERP agent runs. Full Calendar OAuth sync still stubbed via `calendarEnabled`. ERR-01 uses isolated page for GPU stub.
- **Suggested owner:** D1 (real GPU/model interrupt harness), C3 (live research + Calendar API sync)

### 2026-08-07 — Agent B5 (Settings + Polish)
- **Test IDs:** SET-02…08, POL-01…05
- **Severity:** should-fix
- **Type:** deferred | conflict-with-ADR
- **Summary:** Shipped Phil settings matrix + polish; POL-04 still blocked by B4 Memory Milestone stub; SET-02/03/06 delivery caps wired for C2.
- **Detail:**
  - **Added settings fields:** `notificationFrequency` (off/low/normal/high + caps), productivity sensitivity → `nudgeThresholdMs`, `reminderDefaultLeadMinutes` / `reminderDefaultRepeat`, quiet hours (`quietHoursEnabled`/`StartHour`/`EndHour`). Helpers in `src/phil/notificationPolicy.ts` for C2 proactive engine.
  - **SET-08:** No TZ picker; `parseAbsoluteReminder` / device Intl util; Phil copy avoids the word “timezone”; Settings notes “Remind me tomorrow at 3 PM” + device timezone.
  - **SET-07 / POL Privacy:** Added Privacy tab + Settings “Open Privacy controls” link (coordinate with B4 — tab/heading name **Privacy**). Minimal PrivacyPanel shell; B4 owns full PRIV/MEM.
  - **POL-01…03/05:** Empty states (Agent/Goals/Reminders/Focus), `chrome.commands` + in-app Shortcuts cheatsheet (`?`), narrow overflow-x guards.
  - **POL-04:** Left Settings “Memory (coming in Milestone 4)” alone per ownership (B4). Expect POL-04 red until B4 removes it.
  - **SET-02/03 e2e:** Scaffold asserts UI visibility; full proactive harness remains C2. Frequency off / caps enforced in focus nudges + `canDeliverNotification`.
- **Suggested owner:** B4 for Memory stub / POL-04; C2 to consume notificationPolicy caps for PRO-*

### 2026-08-07 — Agent B4 (Privacy + Memory)
- **Test IDs:** PRIV-01…06, MEM-01…07; BIZ-05…08
- **Severity:** FYI
- **Type:** deferred
- **Summary:** Privacy dashboard + chrome.storage keyword memory shipped; Calendar Privacy enable is local flag until B3 OAuth.
- **Detail:** Storage: `philMemories` in chrome.storage.local (SW-safe). Conversations remain IDB with keyword search. Embeddings/vector stubs are no-ops. History shown as not granted until C4. Analytics/crash default OFF; Feedback via GitHub + mailto.
- **Suggested owner:** B3 (Calendar OAuth), C4 (history), D2 (feedback email)

### 2026-08-07 — Agent C2 (Daily review + Proactive + Exec-day)
- **Test IDs:** DAY-01…06, PRO-01…07, PRJ-EA-01…03, WF-07, WF-19, WF-20
- **Severity:** FYI
- **Type:** open-question | deferred
- **Summary:** Shipped evening recap alarm, richer morning briefing, proactive detectors + Today inbox, exec-day coaching surfaces; ADR Q5 = dedicated detectors (not synthetic router utterances).
- **Detail:**
  - **Detectors:** `research_without_notes`, `similar_product_tabs`, `leisure_refocus`, `email_time_triage`, `travel_book_reminder`, `context_switching`, `stay_on_track_coach`, `suggest_break` (+ harness seeds).
  - **ADR Q5 choice:** dedicated detectors write `philSuggestions`; frequency `off` blocks creation; quiet hours + caps via `notificationPolicy`. Router Factory untouched.
  - **DAY:** morning compose adds priorities + goals completed + toward-goals focus; evening recap alarm (`eveningRecapHour`) + Today section; DAY-06 goal-relative Focus insights.
  - **PRJ-EA / WF:** exec_day morning plan slice, day nudges, evening auto-recap; WF-07/19/20 harnessed on Today/Focus. WF-10 skipped (C1/C3).
  - **E2E:** harness seeds via `__philProactive` / session flags.
  - **E2E evidence (local):** `playwright test e2e/daily-review.spec.ts e2e/proactive.spec.ts e2e/projects-exec-assistant.spec.ts e2e/workflows-focus-coaching.spec.ts` → **19 passed, 1 skipped** (WF-10 owned by C1/C3). Green: DAY-01…06, PRO-01…07, PRJ-EA-01…03, WF-07, WF-19, WF-20.
- **Suggested owner:** D1 for CI e2e evidence; C1 for Career/Job Hunt; C3 for WF-10 Japan playbook

