/**
 * Reserved hook for a future WebLLM service-worker engine host.
 *
 * The SW path is currently disabled: Vite/CRX cannot reliably bundle
 * `@mlc-ai/web-llm` for MV3 service workers (dynamic import → `window` via
 * `__vitePreload`; static import tree-shakes the wrong export). Inference
 * runs in the side panel via `CreateMLCEngine` instead; weights still persist
 * in the Cache API.
 */

/**
 * Queue helper kept for unit tests / future SW re-enable.
 */
export function createArmedMessageBridge(): {
  onMessage: (msg: unknown) => void;
  arm: (fn: (msg: unknown) => void) => void;
  getQueueLength: () => number;
} {
  const queued: unknown[] = [];
  let handlerFn: ((msg: unknown) => void) | null = null;

  return {
    onMessage(msg: unknown) {
      if (handlerFn) {
        handlerFn(msg);
        return;
      }
      queued.push(msg);
    },
    arm(fn: (msg: unknown) => void) {
      handlerFn = fn;
      while (queued.length > 0) {
        fn(queued.shift()!);
      }
    },
    getQueueLength: () => queued.length,
  };
}

export function registerWebllmServiceWorkerHandler(): void {
  // Intentionally no-op until bundling supports WebLLM in the SW.
}
