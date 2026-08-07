# Phil

**Your private on-device personal assistant.**

Phil is a Chrome extension (Manifest V3) that runs an LLM fully on-device with [WebLLM](https://webllm.mlc.ai/) + WebGPU. Chat, focus tracking, reminders, goals, morning briefings, web research, and an optional local browser agent — no OpenAI, no API keys, no cloud inference.

## Shipped (1.0)

- **Chat + Ask this page** with on-device models (Gemma 2 2B through Qwen 3.5 9B / Llama 3.1 8B)
- **Selection actions** (explain / rewrite / translate / ELI5 / improve + replace)
- **Browser Agent** — tabs, page DOM, Gmail session/API tools with confirmation gates
- **Focus** — tab dwell tracking (productive vs leisure)
- **Reminders** — `chrome.alarms` + notifications
- **Goals** — off-task nudges when leisure sites eat the day
- **Today** — morning briefing from goals, reminders, and focus
- **Web research** — DuckDuckGo SERP via browser tabs; finding tabs left open
- **Always-on FAB** on web pages (right-click / Shift-click for quick intents)

## Quick start

```bash
npm install
npm run build
```

1. `chrome://extensions` → Developer mode → **Load unpacked** → `dist/`
2. Open Phil → **Download AI**
3. Use **Today / Focus / Goals / Reminders**, or open the **Agent** tab

### Agent setup

1. Side panel → **Agent** → Settings → **Enable + grant permissions**
2. Load a local model (same as chat)
3. Optional Gmail API: OAuth Web client + redirect from `chrome.identity.getRedirectURL('oauth2')`
4. Without OAuth, use **session** mode while signed into `mail.google.com`

## Architecture

```
src/
├── phil/           # Categories + PA types
├── agent/          # Tool registry, parser, permissions, Gmail API
├── background/     # Service worker, Phil focus/reminders, tool router
├── content/        # FAB, extraction, selection menu, page/Gmail actions
├── components/     # Chat + Phil panels + Agent UI
├── ai/             # WebLLM provider
└── storage/        # IndexedDB (localmind chat + phil PA)
```

## Privacy

- Prompts, pages, chats stay on-device
- No analytics by default
- Gmail OAuth tokens stored locally; no Phil server
- See [PERMISSIONS.md](./PERMISSIONS.md)

## License

MIT
