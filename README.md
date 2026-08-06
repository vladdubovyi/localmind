# LocalMind

**Private AI that lives inside your browser.**

LocalMind is a Chrome extension (Manifest V3) that runs an LLM fully on-device with [WebLLM](https://webllm.mlc.ai/) + WebGPU. No OpenAI, no API keys, no cloud inference, no Ollama.

## Shipped

### Milestone 1 — Core runtime
Chrome extension + WebLLM download/cache + chat UI (markdown, copy, regenerate, stop).

### Milestone 2 — Page understanding
**Ask this page** + **Summarize** (TLDR / bullets / facts / actions) with DOM → chunk → retrieve → LLM.

### Milestone 3 — Selection actions
Floating toolbar + context menu: Explain / Summarize / Rewrite / Translate / ELI5 / Improve, with **Replace on page**.

### Browser Agent (new)
Optional local agent that can:
- Open / list / navigate tabs
- Read pages, query DOM, click, type, fill forms
- Scan / draft Gmail (API OAuth or Gmail-tab session mode)
- Run multi-step tool loops with confirmation gates

Agent mode requests extra permissions only when enabled. It never automates password login. `gmail_send` always requires explicit confirmation; session mode never auto-clicks Send.

## Quick start

```bash
npm install
npm run build
```

1. `chrome://extensions` → Developer mode → **Load unpacked** → `dist/`
2. Open LocalMind → **Download AI**
3. Chat, Ask this page, or open the **Agent** tab

### Agent setup

1. Side panel → **Agent** → Settings → **Enable + grant permissions**
2. Load a local model (same as chat)
3. Optional Gmail API: create an OAuth Web client in Google Cloud, add the redirect URL from `chrome.identity.getRedirectURL('oauth2')`, paste the client ID into Agent settings → **Connect Gmail**
4. Without OAuth, use **session** mode while signed into `mail.google.com`

## Architecture

```
src/
├── agent/          # Tool registry, parser, permissions, Gmail API
├── background/     # Service worker + tool router (tabs/page/gmail/debugger)
├── content/        # Extraction, selection menu, page actions, Gmail DOM
├── components/     # Chat + Agent UI
├── ai/             # WebLLM provider
└── storage/        # IndexedDB + agent settings
```

### Agent tool loop

```
Goal → local LLM → <tool_call> → service worker router → chrome.* / content script
     → observation → LLM → … → final answer
```

Risky tools pause for Allow / Deny in the Agent panel.

## Privacy

- Prompts, pages, chats stay on-device
- No analytics by default
- Gmail OAuth tokens stored locally; no LocalMind server
- See [PERMISSIONS.md](./PERMISSIONS.md)

## License

MIT
