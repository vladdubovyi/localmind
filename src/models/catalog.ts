import type { ModelInfo } from '@/types';

/** Default / recommended models for Milestone 1 */
export const MODELS: ModelInfo[] = [
  {
    id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC',
    label: 'Qwen 2.5 3B Instruct',
    family: 'Qwen',
    sizeLabel: '~2.5 GB',
    estimatedBytes: 2.5 * 1024 ** 3,
    vramMb: 2505,
    recommendedRamGb: 8,
    description: 'Default model. Strong reasoning and instruction following at 4-bit.',
  },
  {
    id: 'gemma-2-2b-it-q4f16_1-MLC',
    label: 'Gemma 2 2B',
    family: 'Gemma',
    sizeLabel: '~1.6 GB',
    estimatedBytes: 1.6 * 1024 ** 3,
    vramMb: 1600,
    recommendedRamGb: 4,
    description: 'Lighter option when RAM/VRAM is limited.',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
    label: 'Phi 3.5 Mini',
    family: 'Phi',
    sizeLabel: '~2.3 GB',
    estimatedBytes: 2.3 * 1024 ** 3,
    vramMb: 2300,
    recommendedRamGb: 6,
    description: 'Compact Microsoft model with solid general performance.',
  },
];

export const DEFAULT_MODEL_ID = MODELS[0].id;

export function getModelById(id: string): ModelInfo | undefined {
  return MODELS.find((m) => m.id === id);
}

export function recommendModelForDevice(deviceMemoryGb?: number): ModelInfo {
  if (deviceMemoryGb !== undefined && deviceMemoryGb < 6) {
    return MODELS.find((m) => m.id.startsWith('gemma-2-2b')) ?? MODELS[1];
  }
  if (deviceMemoryGb !== undefined && deviceMemoryGb < 8) {
    return MODELS.find((m) => m.family === 'Phi') ?? MODELS[2];
  }
  return MODELS[0];
}

export function estimateDownloadMinutes(bytes: number, mbps = 50): number {
  const seconds = (bytes * 8) / (mbps * 1_000_000);
  return Math.max(1, Math.round(seconds / 60));
}
