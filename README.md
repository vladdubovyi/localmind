# LocalMind

**Private AI that lives inside your browser.**

LocalMind is a Chrome extension (Manifest V3) that runs an LLM fully on-device with [WebLLM](https://webllm.mlc.ai/) + WebGPU. No OpenAI, no API keys, no cloud inference, no Ollama.

> This repository currently ships **Milestone 1** — core runtime. Later milestones add page understanding, selection actions, memory/RAG, and PDF support.

## Milestone 1 (shipped)

- Chrome extension scaffold (popup + side panel + background + content script)
- WebLLM model download / browser cache / load
- Chat UI with markdown, copy, regenerate, stop
- Model picker (Qwen 2.5 3B default, Gemma 2 2B, Phi 3.5 Mini)
- IndexedDB settings + conversation persistence
- Settings: temperature, top-p, max tokens
- Extensible `AIProvider` abstraction for future fallbacks

## Quick start

```bash
npm install
npm run dev      # unpacked extension at dist/ (CRXJS)
# or
npm run build    # production build → dist/
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Open the LocalMind popup → **Download AI**
5. Chat offline after the model is cached

### Requirements

- Chrome 113+ with WebGPU
- ~4–8 GB RAM depending on model
- First download needs network (~1.6–2.5 GB); afterward works offline

## Architecture

```
src/
├── background/     # Service worker (side panel, context menus)
├── content/        # DOM extractor (Milestone 2+)
├── popup/          # Popup chat UI
├── sidebar/        # Persistent side panel
├── ai/             # AIProvider + WebLLM engine + prompts
├── components/     # Chat, onboarding, settings
├── storage/        # IndexedDB (settings, chats, model meta)
├── models/         # Model catalog + device recommendations
├── prompts/        # Prompt library (wired in later milestones)
├── embeddings/     # Stub → Milestone 4
└── vector/         # Stub → Milestone 4
```

### AI layer

```ts
interface AIProvider {
  initialize()
  downloadModel()
  chat()
  summarize()
  embed()
  cancel()
  dispose()
}
```

Inference runs in extension pages (popup / side panel) where WebGPU is available — not in the service worker.

## Roadmap

| Milestone | Scope |
|-----------|--------|
| **1** | Extension + WebLLM + download/cache + chat UI |
| **2** | Ask this page / Summarize page |
| **3** | Selection menu + rewrite / translate / ELI5 |
| **4** | Local memory + semantic search |
| **5** | PDF, multi-model polish, plugins |

## Privacy

- Prompts, page content, and chats stay on-device
- No analytics by default
- Open-source core

## License

MIT
