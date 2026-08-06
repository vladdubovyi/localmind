/**
 * Catalog smoke tests — ensure curated IDs stay in WebLLM's prebuilt list.
 * Run: npm test
 */
import { prebuiltAppConfig } from '@mlc-ai/web-llm';
import {
  DEFAULT_MODEL_ID,
  MODELS,
  getModelById,
  recommendModelForDevice,
} from './catalog.ts';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const prebuiltIds = new Set(
  (prebuiltAppConfig.model_list ?? []).map((m) => m.model_id),
);

assert(MODELS.length >= 8, 'expected an expanded curated catalog');
assert(getModelById(DEFAULT_MODEL_ID), 'default model missing');

for (const model of MODELS) {
  assert(prebuiltIds.has(model.id), `not in WebLLM prebuilt list: ${model.id}`);
  assert(model.vramMb > 0, `vramMb required: ${model.id}`);
  assert(model.estimatedBytes > 0, `estimatedBytes required: ${model.id}`);
  assert(model.tier, `tier required: ${model.id}`);
}

assert(
  MODELS.some((m) => m.id === 'Qwen3.5-9B-q4f16_1-MLC'),
  'expected Qwen 3.5 9B high-end model',
);
assert(
  MODELS.some((m) => m.id === 'Llama-3.1-8B-Instruct-q4f16_1-MLC'),
  'expected Llama 3.1 8B high-end model',
);

assert(
  recommendModelForDevice(4).id === 'gemma-2-2b-it-q4f16_1-MLC',
  'low RAM → gemma 2b',
);
assert(
  recommendModelForDevice(8).id === DEFAULT_MODEL_ID,
  '8 GB → default 3B',
);
assert(
  recommendModelForDevice(16).id === 'Qwen3.5-9B-q4f16_1-MLC',
  '16 GB → highest free tier',
);

console.log('catalog.test.ts: ok', { models: MODELS.length });
