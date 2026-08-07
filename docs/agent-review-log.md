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
