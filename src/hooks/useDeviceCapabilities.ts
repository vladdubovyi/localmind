import { useEffect, useState } from 'react';
import { recommendModelForDevice } from '@/models/catalog';
import type { ModelInfo } from '@/types';
import { detectWebGPUSupport, getDeviceMemoryGb } from '@/utils';

export function useDeviceCapabilities() {
  const [webgpu, setWebgpu] = useState(detectWebGPUSupport());
  const [memoryGb] = useState(getDeviceMemoryGb());
  const [recommended, setRecommended] = useState<ModelInfo>(() =>
    recommendModelForDevice(memoryGb),
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!('gpu' in navigator)) {
        if (!cancelled) setWebgpu(false);
        return;
      }
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!cancelled) setWebgpu(Boolean(adapter));
      } catch {
        if (!cancelled) setWebgpu(false);
      }
    })();
    setRecommended(recommendModelForDevice(memoryGb));
    return () => {
      cancelled = true;
    };
  }, [memoryGb]);

  return { webgpu, memoryGb, recommended };
}
