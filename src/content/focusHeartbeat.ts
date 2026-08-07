/**
 * Page-side dwell signal for Phil Focus tracking.
 *
 * MV3 service workers sleep after ~30s of idle events. Tab listeners alone only
 * record time when focus *changes*. This heartbeat wakes the SW while a visible
 * http(s) page stays open so continuous website time can accumulate.
 */

const INTERVAL_MS = 10_000;

let timer: number | null = null;
let started = false;

function payload(visible: boolean) {
  return {
    type: 'PHIL_FOCUS_HEARTBEAT' as const,
    url: location.href,
    title: document.title,
    visible,
  };
}

function send(visible: boolean): void {
  try {
    void chrome.runtime.sendMessage(payload(visible)).catch(() => undefined);
  } catch {
    // extension context invalidated on reload
  }
}

function onVisibility(): void {
  const visible = document.visibilityState === 'visible';
  send(visible);
  if (visible) startTimer();
  else stopTimer();
}

function startTimer(): void {
  if (timer != null) return;
  timer = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    send(true);
  }, INTERVAL_MS);
}

function stopTimer(): void {
  if (timer == null) return;
  window.clearInterval(timer);
  timer = null;
}

/** Start focus heartbeats once per content-script world. */
export function mountFocusHeartbeat(): void {
  if (started) return;
  started = true;

  onVisibility();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => send(false));
  window.addEventListener('beforeunload', () => send(false));
}
