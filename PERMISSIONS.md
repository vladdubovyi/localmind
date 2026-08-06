# LocalMind — private AI Chrome extension

## Install permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab when the user invokes page features |
| `storage` | Persist settings + session handoff for selection actions |
| `sidePanel` | Persistent sidebar chat |
| `contextMenus` | Right-click Ask LocalMind / selection actions |
| `scripting` | Inject helpers when needed for page features |

Host access at install is limited to Hugging Face + GitHub raw (WebLLM model/wasm downloads). After cache, inference works offline.

## Optional Agent permissions (requested at runtime)

| Permission | Why |
|---|---|
| `tabs` | List / open / navigate tabs |
| `identity` | Gmail OAuth (`launchWebAuthFlow`) |
| `debugger` | Advanced DOM snapshot (off by default) |
| Host access to `http(s)://*/*`, Gmail, Google APIs | Page control + Gmail |

Enable these via **Agent → Enable + grant permissions**. They are not required for chat / Ask this page / selection tools.

## Security principles

- Never upload prompts, webpages, or chats to LocalMind servers
- No analytics by default
- Inference stays in extension pages (WebGPU); service worker coordinates UI + tools
- Agent never automates password login
- Dangerous tools (e.g. `gmail_send`) always require explicit confirmation
- Gmail session mode opens a draft and will **not** auto-click Send
