/**
 * WebLLM Cache API helpers — source of truth for whether model *weights* were
 * downloaded. The live WebGPU engine lives in the extension service worker;
 * IndexedDB modelMeta is only a UX hint and can drift if a load is interrupted.
 */

export async function isModelInCache(modelId: string): Promise<boolean> {
  try {
    const { hasModelInCache } = await import('@mlc-ai/web-llm');
    return await hasModelInCache(modelId);
  } catch {
    return false;
  }
}
