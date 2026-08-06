/**
 * Page action helpers injected/used by the content script.
 * Agent can click, type, fill, query, and show a control banner.
 */

const BANNER_ID = 'localmind-agent-banner';

export function showAgentBanner(message: string): void {
  let el = document.getElementById(BANNER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = BANNER_ID;
    el.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:2147483647',
      'background:#0f766e',
      'color:#ecfdf5',
      'font:600 12px/1.4 system-ui,sans-serif',
      'padding:8px 14px',
      'text-align:center',
      'box-shadow:0 2px 12px rgba(0,0,0,.25)',
    ].join(';');
    document.documentElement.appendChild(el);
  }
  el.textContent = message || 'LocalMind Agent is controlling this tab';
}

export function hideAgentBanner(): void {
  document.getElementById(BANNER_ID)?.remove();
}

function resolve(selector: string): HTMLElement {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) throw new Error(`No element matches selector: ${selector}`);
  return el;
}

export function pageQuery(selector: string, limit = 10) {
  const nodes = Array.from(document.querySelectorAll(selector)).slice(0, limit);
  return nodes.map((n, i) => {
    const el = n as HTMLElement;
    return {
      index: i,
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.textContent || '').trim().slice(0, 200),
      href: (el as HTMLAnchorElement).href || el.getAttribute('href'),
      id: el.id || undefined,
      name: (el as HTMLInputElement).name || undefined,
    };
  });
}

export function pageClick(selector: string) {
  const el = resolve(selector);
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.click();
  return { selector };
}

export function pageType(selector: string, text: string, clear = true) {
  const el = resolve(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLElement;
  el.focus();
  if ('value' in el) {
    if (clear) el.value = '';
    el.value = clear ? text : `${el.value}${text}`;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (el.isContentEditable) {
    if (clear) el.textContent = '';
    el.textContent = (clear ? '' : el.textContent || '') + text;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    throw new Error('Element is not editable');
  }
  return { selector, length: text.length };
}

export function pageFill(fields: Record<string, string>) {
  const results: Array<{ selector: string; ok: boolean; error?: string }> = [];
  for (const [selector, value] of Object.entries(fields)) {
    try {
      pageType(selector, value, true);
      results.push({ selector, ok: true });
    } catch (e) {
      results.push({
        selector,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { results };
}
