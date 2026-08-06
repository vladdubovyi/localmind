export type EnginePhase =
  | 'idle'
  | 'checking'
  | 'needs_download'
  | 'cached'
  | 'downloading'
  | 'ready'
  | 'error';

/** True first-time download / hard failure — show the full Onboarding flow. */
export function shouldShowFullOnboarding(
  phase: EnginePhase,
  loadingFromCache: boolean,
): boolean {
  if (phase === 'needs_download') return true;
  if (phase === 'downloading' && !loadingFromCache) return true;
  if (phase === 'error' && !loadingFromCache) return true;
  return false;
}

/**
 * Model weights are already on disk (or were); we're reconnecting / hydrating
 * the WebGPU engine — not prompting the user to download again.
 */
export function isRestoringEngine(
  phase: EnginePhase,
  loadingFromCache: boolean,
): boolean {
  if (phase === 'cached') return true;
  if (phase === 'downloading' && loadingFromCache) return true;
  if (phase === 'error' && loadingFromCache) return true;
  return false;
}
