import type { MLCEngineInterface, InitProgressCallback } from '@mlc-ai/web-llm';
import { BaseAIProvider } from '@/ai/provider';
import type { ChatChunk, ChatRequest, InitProgressReport } from '@/types';

/**
 * WebLLM-backed provider.
 *
 * Model *weights* persist in the browser Cache API after the first download
 * (WebLLM default). The live WebGPU engine runs in the side panel page via
 * `CreateMLCEngine`.
 *
 * Note: hosting the engine in the MV3 service worker was attempted, but our
 * Vite/CRX bundle cannot reliably load `@mlc-ai/web-llm` in the SW (dynamic
 * import hits `window` via `__vitePreload`; static import tree-shakes the
 * wrong export). Until that is fixed upstream/in bundler config, page-side
 * load + Cache API is the correct durable path.
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
    if (this.engine) {
      try {
        await this.engine.unload();
      } catch {
        // ignore unload errors when replacing models
      }
      this.engine = null;
    }

    if (!(await hasWebGPU())) {
      throw new Error(
        'WebGPU is not available in this browser. LocalMind requires Chrome 113+ with WebGPU enabled.',
      );
    }

    const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

    const initProgressCallback: InitProgressCallback = (report) => {
      onProgress?.({
        progress: report.progress,
        text: report.text,
        timeElapsed: report.timeElapsed,
      });
    };

    this.engine = await CreateMLCEngine(modelId, { initProgressCallback });
    this.modelId = modelId;
    this.ready = true;
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
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
    }
    this.ready = false;
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

/** Singleton used by popup + side panel pages. */
let sharedProvider: WebLLMProvider | null = null;

export function getAIProvider(): WebLLMProvider {
  if (!sharedProvider) {
    sharedProvider = new WebLLMProvider();
  }
  return sharedProvider;
}
