# Phil demo talk track (≤90 seconds)

Screen-recording script for go-live / CWS. Speak naturally; times are targets. Suite order mirrors the go-live plan demos.

**Total target: ~85 seconds.**

---

## 0:00–0:18 — Onboarding (incl. Calendar)

Cold profile → side panel opens.

> “This is Phil — a private AI chief of staff in your browser. Setup explains what stays on-device versus what needs the internet. I’ll grant browser permissions, skip or connect Gmail, and here’s Calendar — connect it so daily planning can see today’s events, or skip and enable later in Privacy. Phil recommends a local model and downloads it on-device.”

**Show:** welcome → local vs internet → Calendar step → model progress → Agent ready.

---

## 0:18–0:30 — Page summarize

Open a fixture / docs article.

> “On any page I can summarize without pasting. Phil reads the tab and answers from the content.”

**Show:** Summarize this page → grounded reply.

---

## 0:30–0:40 — Selection

Highlight a paragraph → Explain (or ELI5).

> “Highlight text and Phil explains the selection in the side panel — still local.”

**Show:** selection menu → side-panel explanation.

---

## 0:40–0:55 — Goals / playbook + Persistent Projects (“Where am I?”)

> “Say ‘I want to learn Kubernetes’ — Phil doesn’t just chat; it starts a playbook: goal, reminder, next step. Long-running work becomes a Persistent Project. Ask ‘Where am I?’ and Phil summarizes standings across workstreams — that’s why you come back.”

**Show:** playbook reply + Goals/Projects → “Where am I?” standing summary.

---

## 0:55–1:05 — Proactive

Trigger or show a research dwell suggestion.

> “Phil also notices when you’ve been researching and offers a summary — without you asking.”

**Show:** proactive inbox / “Phil noticed” suggestion.

---

## 1:05–1:25 — Privacy

Open Privacy dashboard.

> “Privacy shows what stays on-device — chats, page text, projects — versus what may leave: model CDN, Google research, optional Gmail and Calendar. Analytics and crash reporting stay off unless you opt in.”

**Show:** local vs leaves-device + analytics off.

---

## Checklist (BIZ-09 coverage)

| Beat | Covered |
|------|---------|
| Onboarding (incl. calendar) | ✓ |
| Page summarize | ✓ |
| Selection | ✓ |
| Goals / playbook | ✓ |
| Proactive | ✓ |
| Privacy | ✓ |
| Projects “Where am I?” | ✓ |

## Notes

- Actual MP4 is a human step after green e2e; this script is mandatory in-repo.
- Prefer a small cached model in demos so download does not burn the clock.
- If Calendar was skipped in onboarding, say so and point at Privacy to enable.
