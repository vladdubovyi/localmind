/**
 * WebLLM Cache API helpers — source of truth for whether a model was downloaded.
 * LocalMind IndexedDB modelMeta is a UX hint and can get out of sync when the
 * popup is closed mid-load.
 */

export async function isModelInCache(modelId: string): Promise<boolean> {
  try {
    const { hasModelInCache } = await import('@mlc-ai/web-llm');
    return await hasModelInCache(modelId);
  } catch {
    return false;
  }
}
