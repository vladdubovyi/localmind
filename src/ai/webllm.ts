import type { MLCEngineInterface, InitProgressCallback } from '@mlc-ai/web-llm';
import { BaseAIProvider } from '@/ai/provider';
import type { ChatChunk, ChatRequest, InitProgressReport } from '@/types';

/**
 * WebLLM-backed provider.
 *
 * Model *weights* persist in the browser Cache API after the first download.
 * The live WebGPU engine is hosted in the extension service worker via
 * `CreateExtensionServiceWorkerMLCEngine`, so closing the side panel does not
 * throw away a warm model — reopen reconnects (instant if the SW is alive,
 * Cache API hydrate if Chrome killed the worker).
 */
export class WebLLMProvider extends BaseAIProvider {
  private engine: MLCEngineInterface | null = null;
  private loading: Promise<void> | null = null;

  async initialize(
    modelId: string,
    onProgress?: (p: InitProgressReport) => void,
  ): Promise<void> {
    if (this.ready && this.modelId === modelId && this.engine) {
      return;
    }
    await this.downloadModel(modelId, onProgress);
  }

  async downloadModel(
    modelId: string,
    onProgress?: (p: InitProgressReport) => void,
  ): Promise<void> {
    if (this.loading) {
      await this.loading;
      if (this.modelId === modelId && this.ready) return;
    }

    this.ready = false;
    this.loading = this.loadEngine(modelId, onProgress);
    try {
      await this.loading;
    } finally {
      this.loading = null;
    }
  }

  private async loadEngine(
    modelId: string,
    onProgress?: (p: InitProgressReport) => void,
  ): Promise<void> {
    // Drop the page-side client only. Do NOT unload the SW-resident model —
    // reconnecting with the same modelId skips reload entirely.
    this.detachClient();

    if (!(await hasWebGPU())) {
      throw new Error(
        'WebGPU is not available in this browser. LocalMind requires Chrome 124+ with WebGPU enabled (including in extension service workers).',
      );
    }

    const { CreateExtensionServiceWorkerMLCEngine } = await import(
      '@mlc-ai/web-llm'
    );

    const initProgressCallback: InitProgressCallback = (report) => {
      onProgress?.({
        progress: report.progress,
        text: report.text,
        timeElapsed: report.timeElapsed,
      });
    };

    this.engine = await CreateExtensionServiceWorkerMLCEngine(
      modelId,
      {
        initProgressCallback,
        onDisconnect: () => {
          // Service worker / port went away. Mark not ready so the UI reconnects.
          this.ready = false;
          this.engine = null;
        },
      },
      undefined,
      10_000,
    );
    this.modelId = modelId;
    this.ready = true;
  }

  private detachClient(): void {
    if (!this.engine) return;
    try {
      const port = (this.engine as { port?: chrome.runtime.Port }).port;
      port?.disconnect();
    } catch {
      // ignore disconnect races
    }
    this.engine = null;
    this.ready = false;
  }

  async chat(
    request: ChatRequest,
    onChunk?: (chunk: ChatChunk) => void,
  ): Promise<string> {
    if (!this.engine || !this.ready) {
      throw new Error('Model is not ready. Download and load a model first.');
    }

    const messages = request.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const stream = request.stream !== false;

    if (!stream || !onChunk) {
      const reply = await this.engine.chat.completions.create({
        messages,
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 0.95,
        max_tokens: request.maxTokens ?? 1024,
        stream: false,
      });
      return reply.choices[0]?.message?.content ?? '';
    }

    const completion = await this.engine.chat.completions.create({
      messages,
      temperature: request.temperature ?? 0.7,
      top_p: request.topP ?? 0.95,
      max_tokens: request.maxTokens ?? 1024,
      stream: true,
      stream_options: { include_usage: false },
    });

    let full = '';
    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (delta) {
        full += delta;
        onChunk({ content: delta, done: false });
      }
    }
    onChunk({ content: '', done: true });
    return full;
  }

  async cancel(): Promise<void> {
    if (this.engine) {
      await this.engine.interruptGenerate();
    }
  }

  async dispose(): Promise<void> {
    // Keep the SW-hosted model warm for the next panel open.
    this.detachClient();
    this.modelId = null;
  }
}

async function hasWebGPU(): Promise<boolean> {
  if (!('gpu' in navigator) || !navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    // Environments without a GPU adapter reject; never let that surface as an
    // unhandled extension error on chrome://extensions.
    return false;
  }
}

/** Singleton used by popup + side panel pages (client of the SW engine). */
let sharedProvider: WebLLMProvider | null = null;

export function getAIProvider(): WebLLMProvider {
  if (!sharedProvider) {
    sharedProvider = new WebLLMProvider();
  }
  return sharedProvider;
}
