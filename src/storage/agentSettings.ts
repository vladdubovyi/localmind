import type { AgentSettings } from '@/agent/types';
import { DEFAULT_AGENT_SETTINGS } from '@/agent/types';

const KEY = 'agentSettings';

export async function getAgentSettings(): Promise<AgentSettings> {
  const stored = await chrome.storage.local.get(KEY);
  const value = stored[KEY] as Partial<AgentSettings> | undefined;
  return { ...DEFAULT_AGENT_SETTINGS, ...value };
}

export async function saveAgentSettings(
  partial: Partial<AgentSettings>,
): Promise<AgentSettings> {
  const current = await getAgentSettings();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
