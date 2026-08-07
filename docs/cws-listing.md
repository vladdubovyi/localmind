# Chrome Web Store listing — Phil

Copy-ready assets for the Chrome Web Store (CWS) submission. Icons live in [`public/icons/`](../public/icons/).

## Name

**Phil**

(Alternative if “Phil” is taken: **Phil — Private Browser AI**)

## Short description

(≤132 characters)

```
Private on-device AI chief of staff in your browser. Persistent Projects, page help, goals & research — chat stays local.
```

Character count: 118

## Detailed description

```
Phil is your private AI chief of staff that lives in your browser.

It understands what you’re working on, helps you research faster, keeps you on track, and proactively assists throughout your day — with AI that runs on your device (WebGPU / WebLLM). Prompts, page text, and chats stay on-device by default. No cloud inference. No Phil servers reading your work.

THE UNLOCK: PERSISTENT PROJECTS
Goals, reminders, email drafts, web research, productivity, and daily briefings attach to named long-running projects — “Staff Engineer Promotion”, “Move to Spain”, “Buy a House”. Ask “Where am I?” and Phil answers from that project context. Generic chatbots can’t keep that thread.

WHAT PHIL DOES
• Onboarding with clear local-vs-internet explanation; optional Calendar connect for daily planning
• Summarize / explain the current page; highlight selection actions (explain, rewrite, translate)
• Goals, reminders, focus tracking, and morning / evening briefings
• Natural-language playbooks (“I want to learn Kubernetes”) that create durable goals and next steps
• Proactive suggestions when you’ve been researching, comparing tabs, or drifting off-goal
• Optional Gmail tools with confirmation before send
• Optional Google web research (Google is the default search engine)
• Privacy dashboard: what stays local vs what may leave the device; clear chats / memories

PRIVACY AT A GLANCE
• Chat, page data, goals, focus, memories, and project knowledge stay on-device by default
• Internet used for: first model download (CDN), optional Google research, optional Gmail, optional Calendar sync, optional history when you enable browser memory
• Analytics: OFF by default
• Crash reporting: OFF by default

REQUIREMENTS
• Chromium browser with WebGPU (Chrome / Edge recommended)
• Enough disk and RAM for the on-device model you choose

Phil is built for people who want an executive assistant in the browser without shipping their workday to the cloud.
```

## Category

Productivity

## Language

English

## Privacy practices summary (CWS single-purpose / privacy fields)

Use wording consistent with [`website/privacy.html`](../website/privacy.html) and [`PERMISSIONS.md`](../PERMISSIONS.md):

| Practice | Declaration |
|----------|-------------|
| Single purpose | Private on-device personal / chief-of-staff assistant in the browser (chat, page help, projects, productivity). |
| Remote code | No remote code execution beyond declared model artifact downloads from allowlisted CDNs. |
| User data collection | Does **not** collect personal data for sale. Analytics/crash **off by default**. |
| On-device processing | Prompts, page content, chats processed locally after model download. |
| Data leaving the device | Model download CDN; optional Google Search (research); optional Gmail; optional Calendar; optional History (local index only — not uploaded to Phil). |
| Certification | Certify that the extension’s privacy policy URL matches these claims. |

### Short privacy blurb (store “Privacy practices” / justification)

```
Phil processes chat and page content on-device. Data may leave the device only for model downloads (CDN), optional Google web research, optional Gmail, optional Calendar sync, and optional history indexing when the user enables those features. Analytics and crash reporting are off by default.
```

## Icons (required)

| Size | Path | Notes |
|------|------|--------|
| 16×16 | `public/icons/icon16.png` | Toolbar |
| 32×32 | `public/icons/icon32.png` | Windows |
| 48×48 | `public/icons/icon48.png` | Management page |
| 128×128 | `public/icons/icon128.png` | Store / install |
| 512×512 | `public/icons/icon512.png` | Optional source for promo crops |

Brand mark: mint “P” on deep teal ink (rounded square).

## Screenshots / promo (human follow-up)

Record after e2e greens using [`docs/demo-script.md`](./demo-script.md). Suggested shots:

1. Agent empty state + page summarize chip  
2. Persistent Project detail (“Where am I?”)  
3. Privacy dashboard local vs leaves-device  
4. Today briefing with project slice  

## Store URL (placeholder)

`https://chromewebstore.google.com/detail/phil` — replace after publish.

## Related

- Landing: [`website/index.html`](../website/index.html)
- Privacy: [`website/privacy.html`](../website/privacy.html)
- Terms: [`website/terms.html`](../website/terms.html)
