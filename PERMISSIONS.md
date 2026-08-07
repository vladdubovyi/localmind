# Phil — private personal assistant (Chrome MV3)

## Required permissions

| Permission | Why |
|---|---|
| `activeTab` | Read the current tab when you invoke Phil |
| `storage` | Settings, session intents, agent config |
| `sidePanel` | Primary Phil UI |
| `contextMenus` | Right-click Ask Phil / selection actions |
| `scripting` | Inject page helpers for Ask this page / Agent |
| `tabs` | Focus tracking + Agent tab tools |
| `alarms` | Reminders + morning briefing |
| `notifications` | Reminder / nudge / briefing alerts |
| `idle` | Pause focus dwell when the machine is idle |

## Optional (requested when Agent / Gmail is enabled)

| Permission / host | Why |
|---|---|
| `identity` | Gmail OAuth API mode |
| `http://*/*`, `https://*/*` | Agent page control + web research |
| Gmail / Google API hosts | Session DOM + OAuth token endpoints |

## Host permissions (install)

Hugging Face / GitHub raw hosts for WebLLM model + wasm downloads (then cached offline).

## Privacy promises

- Never upload prompts, webpages, or chats to Phil servers
- Gmail tokens stay on-device
- Dangerous tools (`gmail_send`, trash, spam) always confirm
- Session Gmail mode never auto-clicks Send
