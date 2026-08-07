/**
 * Always-on Phil floating action button on http(s) pages.
 */
const ROOT_ID = 'phil-fab-root';
const STYLE_ID = 'phil-fab-style';

type QuickKind =
  | 'open_today'
  | 'open_focus'
  | 'open_goals'
  | 'open_reminders'
  | 'whats_up'
  | 'focus_status';

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483646;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      pointer-events: none;
    }
    #${ROOT_ID} * { box-sizing: border-box; }
    #${ROOT_ID} .phil-fab-btn {
      pointer-events: auto;
      width: 48px;
      height: 48px;
      border: 0;
      border-radius: 16px;
      cursor: pointer;
      color: #0b1220;
      background: linear-gradient(145deg, #5eead4 0%, #2dd4bf 55%, #14b8a6 100%);
      box-shadow: 0 10px 28px rgba(15, 118, 110, 0.35);
      display: grid;
      place-items: center;
      transition: transform 0.18s ease, box-shadow 0.18s ease;
    }
    #${ROOT_ID} .phil-fab-btn:hover {
      transform: translateY(-2px) scale(1.03);
      box-shadow: 0 14px 32px rgba(15, 118, 110, 0.42);
    }
    #${ROOT_ID} .phil-fab-btn:active { transform: scale(0.97); }
    #${ROOT_ID} .phil-fab-menu {
      pointer-events: auto;
      position: absolute;
      right: 0;
      bottom: 58px;
      min-width: 168px;
      padding: 6px;
      border-radius: 14px;
      background: rgba(11, 18, 32, 0.94);
      border: 1px solid rgba(94, 234, 212, 0.28);
      box-shadow: 0 16px 40px rgba(0,0,0,0.35);
      display: none;
      flex-direction: column;
      gap: 2px;
    }
    #${ROOT_ID}.open .phil-fab-menu { display: flex; }
    #${ROOT_ID} .phil-fab-item {
      border: 0;
      background: transparent;
      color: #e8eef7;
      text-align: left;
      padding: 8px 10px;
      border-radius: 10px;
      font-size: 12px;
      cursor: pointer;
    }
    #${ROOT_ID} .phil-fab-item:hover { background: rgba(94, 234, 212, 0.14); }
  `;
  document.documentElement.appendChild(style);
}

async function isFabEnabled(): Promise<boolean> {
  try {
    const stored = await chrome.storage.local.get('philSettings');
    const settings = stored.philSettings as { fabEnabled?: boolean } | undefined;
    if (settings && typeof settings.fabEnabled === 'boolean') return settings.fabEnabled;
    const resp = await chrome.runtime.sendMessage({ type: 'PHIL_GET_SETTINGS' });
    return Boolean(resp?.settings?.fabEnabled ?? true);
  } catch {
    return true;
  }
}

function sendQuick(kind: QuickKind): void {
  void chrome.runtime.sendMessage({ type: 'PHIL_QUICK_INTENT', kind });
}

export function mountPhilFab(): void {
  if (window.top !== window) return;
  if (document.getElementById(ROOT_ID)) return;

  void (async () => {
    if (!(await isFabEnabled())) return;
    ensureStyles();

    const root = document.createElement('div');
    root.id = ROOT_ID;
    root.setAttribute('data-phil-fab', 'true');

    const menu = document.createElement('div');
    menu.className = 'phil-fab-menu';
    menu.setAttribute('role', 'menu');

    const items: Array<{ label: string; kind: QuickKind }> = [
      { label: 'What’s up today', kind: 'whats_up' },
      { label: 'Today', kind: 'open_today' },
      { label: 'Focus', kind: 'open_focus' },
      { label: 'Goals', kind: 'open_goals' },
      { label: 'Reminders', kind: 'open_reminders' },
      { label: 'Focus status', kind: 'focus_status' },
    ];

    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'phil-fab-item';
      btn.textContent = item.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        root.classList.remove('open');
        sendQuick(item.kind);
      });
      menu.appendChild(btn);
    }

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'phil-fab-btn';
    fab.setAttribute('aria-label', 'Open Phil');
    fab.title = 'Phil';
    fab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a6 6 0 0 0-4.5 10v2.5a1.5 1.5 0 0 0 1.5 1.5h6a1.5 1.5 0 0 0 1.5-1.5V13A6 6 0 0 0 12 3Z" stroke="currentColor" stroke-width="1.7"/>
      <path d="M9.5 20h5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
    </svg>`;

    fab.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.shiftKey || e.altKey) {
        root.classList.toggle('open');
        return;
      }
      void chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
    });

    fab.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      root.classList.toggle('open');
    });

    root.appendChild(menu);
    root.appendChild(fab);
    document.documentElement.appendChild(root);

    document.addEventListener(
      'click',
      (e) => {
        if (!root.contains(e.target as Node)) root.classList.remove('open');
      },
      true,
    );

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.philSettings) return;
      const next = changes.philSettings.newValue as { fabEnabled?: boolean } | undefined;
      if (next && next.fabEnabled === false) {
        root.remove();
      }
    });
  })();
}
