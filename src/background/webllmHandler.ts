/**
 * WebLLM engine host for the extension service worker.
 *
 * Keeping the MLCEngine here (instead of the side panel document) means
 * closing/reopening the panel reconnects to a warm model when the SW is
 * still alive, and otherwise reloads weights from the Cache API — never a
 * fresh multi‑GB network download.
 */

import type { ExtensionServiceWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

const WEBLLM_PORT = 'web_llm_service_worker';

let handler: ExtensionServiceWorkerMLCEngineHandler | undefined;
let handlerInit: Promise<ExtensionServiceWorkerMLCEngineHandler> | null = null;

async function ensureHandler(
  port: chrome.runtime.Port,
): Promise<ExtensionServiceWorkerMLCEngineHandler> {
  if (handler) {
    handler.setPort(port);
    return handler;
  }

  if (!handlerInit) {
    handlerInit = (async () => {
      const { ExtensionServiceWorkerMLCEngineHandler } = await import(
        '@mlc-ai/web-llm'
      );
      handler = new ExtensionServiceWorkerMLCEngineHandler(port);
      return handler;
    })();
  }

  const ready = await handlerInit;
  // A concurrent connect may have created the handler with a different port.
  if (ready.port !== port) {
    ready.setPort(port);
  }
  return ready;
}

export function registerWebllmServiceWorkerHandler(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== WEBLLM_PORT) return;

    void ensureHandler(port)
      .then((h) => {
        port.onMessage.addListener(h.onmessage.bind(h));
      })
      .catch((err: unknown) => {
        console.error('[LocalMind] WebLLM service worker handler failed', err);
        try {
          port.disconnect();
        } catch {
          // ignore
        }
      });
  });
}
