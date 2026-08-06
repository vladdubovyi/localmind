# LocalMind — private AI Chrome extension

## Permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab when the user invokes page features |
| `storage` | Persist settings + session handoff for selection actions |
| `sidePanel` | Persistent sidebar chat |
| `contextMenus` | Right-click Ask LocalMind / selection actions |
| `scripting` | Inject helpers when needed for page features |

Host access is limited to Hugging Face + GitHub raw (WebLLM model/wasm downloads). After cache, inference works offline.

## Security principles

- Never upload prompts, webpages, or chats
- No analytics by default
- Inference stays in extension pages (WebGPU); service worker only coordinates UI
