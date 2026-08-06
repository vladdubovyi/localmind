/**
 * Cross-surface intents (popup → side panel). Popup documents die on blur;
 * the side panel is the durable host for permission grants and model loads.
 */

const PENDING_MODEL_KEY = 'pendingModelLoad';
const WIZARD_STEP_KEY = 'setupWizardStep';

export async function setPendingModelLoad(modelId: string): Promise<void> {
  await chrome.storage.local.set({
    [PENDING_MODEL_KEY]: { modelId, createdAt: Date.now() },
  });
}

export async function consumePendingModelLoad(): Promise<string | null> {
  const stored = await chrome.storage.local.get(PENDING_MODEL_KEY);
  const value = stored[PENDING_MODEL_KEY] as
    | { modelId?: string; createdAt?: number }
    | undefined;
  if (!value?.modelId) return null;
  await chrome.storage.local.remove(PENDING_MODEL_KEY);
  // Ignore stale intents older than 1 hour
  if (value.createdAt && Date.now() - value.createdAt > 60 * 60 * 1000) {
    return null;
  }
  return value.modelId;
}

export async function peekPendingModelLoad(): Promise<string | null> {
  const stored = await chrome.storage.local.get(PENDING_MODEL_KEY);
  const value = stored[PENDING_MODEL_KEY] as { modelId?: string } | undefined;
  return value?.modelId ?? null;
}

export async function saveWizardStep(stepIndex: number): Promise<void> {
  await chrome.storage.local.set({ [WIZARD_STEP_KEY]: stepIndex });
}

export async function getWizardStep(): Promise<number> {
  const stored = await chrome.storage.local.get(WIZARD_STEP_KEY);
  const value = stored[WIZARD_STEP_KEY];
  return typeof value === 'number' && value >= 0 ? value : 0;
}

export async function clearWizardStep(): Promise<void> {
  await chrome.storage.local.remove(WIZARD_STEP_KEY);
}
