# Phil

**Your private on-device personal assistant.**

Phil is a Chrome extension (Manifest V3) that runs an LLM fully on-device with [WebLLM](https://webllm.mlc.ai/) + WebGPU. Agent chat, focus tracking, reminders, goals, Persistent Projects, morning briefings, Google web research, Gmail tools, and an optional local browser agent — no OpenAI, no API keys, no cloud inference.

## Shipped (1.0)

- **Agent-first side panel** (no Chat tab) with on-device models (Gemma 2 2B through Qwen 3.5 9B / Llama 3.1 8B)
- **Skills + Router Factory** — understand → route → `registerSkill` plans (not a hardcoded intent switch)
- **Persistent Projects** — Career, Job Hunt, Research, Life Planner, Exec Day, goal-aware browse; “Where am I?” standing summaries
- **Selection actions** (explain / rewrite / translate / ELI5 / improve + replace)
- **Browser Agent** — tabs, page DOM, Gmail session/API tools with confirmation gates
- **Focus** — tab dwell tracking (productive vs leisure) + goal-relative coaching
- **Reminders** — `chrome.alarms` + notifications; absolute/weekly schedules in device timezone
- **Goals** — off-task nudges when leisure sites eat the day
- **Today** — morning briefing + evening recap; proactive suggestions inbox
- **Web research** — **Google SERP by default** (DuckDuckGo Instant Answer only as fallback)
- **Browser memory** — keyword index of recent visits (optional History permission)
- **Privacy dashboard** — permission inventory, local vs leaves-device, clears, analytics/crash default off
- **Onboarding wizard** — browser → Gmail → **Calendar (skippable)** → model
- **Always-on FAB** on web pages (right-click / Shift-click for quick intents)

## Quick start

```bash
npm install
npm run build
```

1. `chrome://extensions` → Developer mode → **Load unpacked** → `dist/`
2. Open Phil → complete setup (Calendar is optional) → **Download AI**
3. Use **Agent / Today / Focus / Goals / Reminders / Projects / Privacy**, or the gear for model settings

### Agent setup

1. Side panel → **Agent** → Settings → **Enable + grant permissions**
2. Load a local model
3. Optional Gmail API: OAuth Web client + redirect from `chrome.identity.getRedirectURL('oauth2')`
4. Without OAuth, use **session** mode while signed into `mail.google.com`

## Architecture

```
src/
├── phil/           # Categories + PA types + notification policy
├── agent/          # Skills, Router Factory, tools, Gmail, research
├── background/     # Service worker, focus/reminders, proactive, daily review
├── content/        # FAB, extraction, selection menu, page/Gmail actions
├── components/     # Agent + Phil panels + Projects + Privacy + onboarding
├── ai/             # WebLLM provider
└── storage/        # IndexedDB + chrome.storage (projects, memory, browse index)
```

See [`docs/adr/0001-skills-router.md`](docs/adr/0001-skills-router.md) for routing.

## Privacy

- Prompts, pages, chats, projects, and memories stay on-device
- Analytics and crash reporting default **off**
- Gmail OAuth tokens stored locally; no Phil server
- See [PERMISSIONS.md](./PERMISSIONS.md) and the in-app Privacy tab

## License

MIT
