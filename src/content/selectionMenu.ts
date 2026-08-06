/**
 * Floating selection toolbar shown near highlighted text.
 * Injected by the content script — no React (keeps CS lean).
 */
import { SELECTION_ACTIONS } from '@/prompts/selection';
import type { SelectionAction } from '@/types';

const ROOT_ID = 'localmind-selection-menu';
const STYLE_ID = 'localmind-selection-menu-style';

export interface SelectionSnapshot {
  text: string;
  rect: { top: number; left: number; bottom: number; right: number; width: number; height: number };
}

let lastRange: Range | null = null;
let lastSnapshot: SelectionSnapshot | null = null;

export function getLastSelectionRange(): Range | null {
  return lastRange;
}

export function getLastSelectionSnapshot(): SelectionSnapshot | null {
  return lastSnapshot;
}

export function clearSavedSelection(): void {
  lastRange = null;
  lastSnapshot = null;
}

function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      z-index: 2147483646;
      display: flex;
      gap: 2px;
      padding: 4px;
      border-radius: 12px;
      background: #121a17;
      border: 1px solid #2a3a34;
      box-shadow: 0 8px 28px rgba(0,0,0,0.45);
      font-family: "Sora", "Segoe UI", system-ui, sans-serif;
      font-size: 12px;
      line-height: 1;
      color: #e8f0ec;
      transform: translateX(-50%);
      animation: localmind-fade-up 0.18s ease-out;
    }
    #${ROOT_ID} button {
      appearance: none;
      border: 0;
      background: transparent;
      color: #b7c6be;
      padding: 7px 9px;
      border-radius: 8px;
      cursor: pointer;
      font: inherit;
      white-space: nowrap;
    }
    #${ROOT_ID} button:hover {
      background: #1c2924;
      color: #14b8a6;
    }
    @keyframes localmind-fade-up {
      from { opacity: 0; transform: translateX(-50%) translateY(4px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.documentElement.appendChild(style);
}

function hideMenu(): void {
  document.getElementById(ROOT_ID)?.remove();
}

function showMenu(snapshot: SelectionSnapshot, onAction: (action: SelectionAction) => void): void {
  ensureStyles();
  hideMenu();

  const root = document.createElement('div');
  root.id = ROOT_ID;
  root.setAttribute('role', 'toolbar');
  root.setAttribute('aria-label', 'LocalMind selection actions');

  for (const action of SELECTION_ACTIONS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = action.shortLabel;
    btn.title = action.description;
    btn.addEventListener('mousedown', (e) => {
      // Prevent clearing the selection before we capture it
      e.preventDefault();
      e.stopPropagation();
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideMenu();
      onAction(action.id);
    });
    root.appendChild(btn);
  }

  document.documentElement.appendChild(root);

  const menuWidth = root.offsetWidth;
  const padding = 8;
  let left = snapshot.rect.left + snapshot.rect.width / 2;
  left = Math.max(padding + menuWidth / 2, Math.min(left, window.innerWidth - padding - menuWidth / 2));

  let top = snapshot.rect.top - root.offsetHeight - 10;
  if (top < padding) {
    top = snapshot.rect.bottom + 10;
  }

  root.style.left = `${left}px`;
  root.style.top = `${top}px`;
}

function readSelection(): SelectionSnapshot | null {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const text = sel.toString().replace(/\s+/g, ' ').trim();
  if (text.length < 2 || text.length > 12000) return null;

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;

  try {
    lastRange = range.cloneRange();
  } catch {
    lastRange = null;
  }

  lastSnapshot = {
    text,
    rect: {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
      height: rect.height,
    },
  };
  return lastSnapshot;
}

export function mountSelectionMenu(
  onAction: (action: SelectionAction, text: string) => void,
): () => void {
  const onMouseUp = () => {
    // Defer so selection is finalized
    window.setTimeout(() => {
      const snap = readSelection();
      if (!snap) {
        hideMenu();
        return;
      }
      showMenu(snap, (action) => onAction(action, snap.text));
    }, 10);
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Escape') hideMenu();
    if (e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      onMouseUp();
    }
  };

  const onScroll = () => hideMenu();
  const onDown = (e: MouseEvent) => {
    const target = e.target as Node | null;
    if (target && document.getElementById(ROOT_ID)?.contains(target)) return;
    // Don't hide immediately on selection start — mouseup will refresh
  };

  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keyup', onKeyUp);
  document.addEventListener('scroll', onScroll, true);
  document.addEventListener('mousedown', onDown);

  return () => {
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('scroll', onScroll, true);
    document.removeEventListener('mousedown', onDown);
    hideMenu();
  };
}

/** Replace the previously saved selection with new text. */
export function replaceSavedSelection(newText: string): { ok: boolean; error?: string } {
  const range = lastRange;
  if (!range) {
    return { ok: false, error: 'Selection was lost. Select the text again and retry.' };
  }

  try {
    // Verify range is still in the document
    if (!document.contains(range.commonAncestorContainer)) {
      return { ok: false, error: 'The original selection is no longer on the page.' };
    }

    range.deleteContents();
    const node = document.createTextNode(newText);
    range.insertNode(node);

    // Reselect the new text
    const sel = window.getSelection();
    sel?.removeAllRanges();
    const next = document.createRange();
    next.selectNodeContents(node);
    sel?.addRange(next);
    lastRange = next.cloneRange();

    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Could not replace selection.',
    };
  }
}
