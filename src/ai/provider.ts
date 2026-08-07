import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  InitProgressReport,
} from '@/types';

/**
 * Abstract AI provider contract.
 * Milestone 1: WebLLM. Later: Transformers.js / ONNX Runtime Web fallbacks.
 */
export abstract class BaseAIProvider implements AIProvider {
  protected ready = false;
  protected modelId: string | null = null;

  abstract initialize(
    modelId: string,
    onProgress?: (p: InitProgressReport) => void,
  ): Promise<void>;

  abstract downloadModel(
    modelId: string,
    onProgress?: (p: InitProgressReport) => void,
  ): Promise<void>;

  abstract chat(
    request: ChatRequest,
    onChunk?: (chunk: ChatChunk) => void,
  ): Promise<string>;

  abstract cancel(): Promise<void>;
  abstract dispose(): Promise<void>;

  async summarize(
    text: string,
    style: 'tldr' | 'bullets' | 'facts' | 'actions' = 'tldr',
  ): Promise<string> {
    const stylePrompt: Record<typeof style, string> = {
      tldr: 'Write a concise TLDR (2-4 sentences).',
      bullets: 'Summarize as clear bullet points.',
      facts: 'Extract key facts as a short list.',
      actions: 'Extract actionable next steps as a checklist.',
    };

    return this.chat({
      messages: [
        {
          role: 'system',
          content:
            'You are Phil, a private on-device assistant. Be accurate and concise.',
        },
        {
          role: 'user',
          content: `${stylePrompt[style]}\n\n---\n${text.slice(0, 12000)}`,
        },
      ],
      stream: false,
      maxTokens: 768,
    });
  }

  async embed(texts: string[]): Promise<number[][]> {
    return texts.map(() => []);
  }

  isReady(): boolean {
    return this.ready;
  }

  getModelId(): string | null {
    return this.modelId;
  }
}
