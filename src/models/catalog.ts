import type { ModelInfo, ModelTier } from '@/types';

/**
 * Curated free WebLLM / MLC models (Apache/MIT/Llama/Gemma licenses).
 * IDs must exist in `@mlc-ai/web-llm` `prebuiltAppConfig.model_list`.
 *
 * High-end picks (~5–6.5 GB VRAM) need a discrete GPU or a well-equipped
 * laptop; balanced/light stay workable on typical 8 GB machines.
 */
export const MODELS: ModelInfo[] = [
  // —— High-end ——
  {
    id: 'Qwen3.5-9B-q4f16_1-MLC',
    label: 'Qwen 3.5 9B',
    family: 'Qwen',
    sizeLabel: '~5.8 GB',
    estimatedBytes: 5.8 * 1024 ** 3,
    vramMb: 6433,
    recommendedRamGb: 16,
    tier: 'high',
    badge: 'Highest quality',
    description:
      'Top free WebLLM model. Strongest general reasoning and instruction following.',
  },
  {
    id: 'gemma-2-9b-it-q4f16_1-MLC',
    label: 'Gemma 2 9B',
    family: 'Gemma',
    sizeLabel: '~5.8 GB',
    estimatedBytes: 5.8 * 1024 ** 3,
    vramMb: 6422,
    recommendedRamGb: 16,
    tier: 'high',
    badge: 'High-end',
    description: 'Google’s larger open model — excellent writing and multilingual quality.',
  },
  {
    id: 'Qwen3-8B-q4f16_1-MLC',
    label: 'Qwen 3 8B',
    family: 'Qwen',
    sizeLabel: '~5.2 GB',
    estimatedBytes: 5.2 * 1024 ** 3,
    vramMb: 5696,
    recommendedRamGb: 16,
    tier: 'high',
    badge: 'High-end',
    description: 'Newer Qwen 3 generation at 8B — strong all-rounder under the 9B.',
  },
  {
    id: 'Llama-3.1-8B-Instruct-q4f16_1-MLC',
    label: 'Llama 3.1 8B Instruct',
    family: 'Llama',
    sizeLabel: '~4.6 GB',
    estimatedBytes: 4.6 * 1024 ** 3,
    vramMb: 5001,
    recommendedRamGb: 16,
    tier: 'high',
    badge: 'High-end',
    description: 'Meta’s flagship 8B instruct model — reliable chat and tool-style prompts.',
  },
  {
    id: 'DeepSeek-R1-Distill-Qwen-7B-q4f16_1-MLC',
    label: 'DeepSeek R1 Distill 7B',
    family: 'DeepSeek',
    sizeLabel: '~4.7 GB',
    estimatedBytes: 4.7 * 1024 ** 3,
    vramMb: 5107,
    recommendedRamGb: 12,
    tier: 'high',
    badge: 'Reasoning',
    description: 'R1 reasoning distill — better multi-step thinking and math than plain 7B chats.',
  },
  {
    id: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    label: 'Qwen 2.5 Coder 7B',
    family: 'Qwen',
    sizeLabel: '~4.7 GB',
    estimatedBytes: 4.7 * 1024 ** 3,
    vramMb: 5107,
    recommendedRamGb: 12,
    tier: 'high',
    badge: 'Coding / Agent',
    description: 'Best free pick for code and browser-agent tool loops.',
  },
  {
    id: 'Qwen2.5-7B-Instruct-q4f16_1-MLC',
    label: 'Qwen 2.5 7B Instruct',
    family: 'Qwen',
    sizeLabel: '~4.7 GB',
    estimatedBytes: 4.7 * 1024 ** 3,
    vramMb: 5107,
    recommendedRamGb: 12,
    tier: 'high',
    badge: 'High-end',
    description: 'Proven 7B general model — strong quality without jumping to 9B VRAM.',
  },

  // —— Balanced ——
  {
    id: 'Qwen3.5-4B-q4f16_1-MLC',
    label: 'Qwen 3.5 4B',
    family: 'Qwen',
    sizeLabel: '~3.5 GB',
    estimatedBytes: 3.5 * 1024 ** 3,
    vramMb: 3868,
    recommendedRamGb: 8,
    tier: 'balanced',
    badge: 'Newer mid-size',
    description: 'Newer Qwen 3.5 mid-size — step up from 3B without full high-end VRAM.',
  },
  {
    id: 'Phi-4-mini-instruct-q4f16_1-MLC',
    label: 'Phi 4 Mini',
    family: 'Phi',
    sizeLabel: '~3.1 GB',
    estimatedBytes: 3.1 * 1024 ** 3,
    vramMb: 3438,
    recommendedRamGb: 8,
    tier: 'balanced',
    description: 'Microsoft Phi-4 Mini — compact but sharper than Phi 3.5 for reasoning.',
  },
  {
    id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    label: 'Qwen 2.5 3B Instruct',
    family: 'Qwen',
    sizeLabel: '~2.5 GB',
    estimatedBytes: 2.5 * 1024 ** 3,
    vramMb: 2505,
    recommendedRamGb: 8,
    tier: 'balanced',
    badge: 'Default',
    description: 'Default model. Strong reasoning and instruction following at 4-bit.',
  },

  // —— Light ——
  {
    id: 'gemma-2-2b-it-q4f16_1-MLC',
    label: 'Gemma 2 2B',
    family: 'Gemma',
    sizeLabel: '~1.6 GB',
    estimatedBytes: 1.6 * 1024 ** 3,
    vramMb: 1600,
    recommendedRamGb: 4,
    tier: 'light',
    badge: 'Low RAM',
    description: 'Lighter option when RAM/VRAM is limited.',
  },
];

export const DEFAULT_MODEL_ID = 'Qwen2.5-3B-Instruct-q4f16_1-MLC';

export const MODEL_TIER_ORDER: ModelTier[] = ['high', 'balanced', 'light'];

export const MODEL_TIER_LABEL: Record<ModelTier, string> = {
  high: 'High-end (needs ~12–16 GB RAM)',
  balanced: 'Balanced',
  light: 'Light',
};

export function getModelById(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsByTier(tier: ModelTier): ModelInfo[] {
  return MODELS.filter((m) => (m.tier ?? 'balanced') === tier);
}

export function recommendModelForDevice(deviceMemoryGb?: number): ModelInfo {
  if (deviceMemoryGb !== undefined && deviceMemoryGb < 6) {
    return getModelById('gemma-2-2b-it-q4f16_1-MLC') ?? MODELS[MODELS.length - 1];
  }
  if (deviceMemoryGb !== undefined && deviceMemoryGb < 8) {
    return getModelById(DEFAULT_MODEL_ID) ?? MODELS[0];
  }
  if (deviceMemoryGb !== undefined && deviceMemoryGb >= 16) {
    return (
      getModelById('Qwen3.5-9B-q4f16_1-MLC') ??
      getModelById('Llama-3.1-8B-Instruct-q4f16_1-MLC') ??
      getModelById(DEFAULT_MODEL_ID) ??
      MODELS[0]
    );
  }
  if (deviceMemoryGb !== undefined && deviceMemoryGb >= 12) {
    return (
      getModelById('Qwen2.5-7B-Instruct-q4f16_1-MLC') ??
      getModelById(DEFAULT_MODEL_ID) ??
      MODELS[0]
    );
  }
  return getModelById(DEFAULT_MODEL_ID) ?? MODELS[0];
}

export function estimateDownloadMinutes(bytes: number, mbps = 50): number {
  const seconds = (bytes * 8) / (mbps * 1_000_000);
  return Math.max(1, Math.round(seconds / 60));
}
