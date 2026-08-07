import { useEffect, useState } from 'react';
import { recommendModelForDevice } from '@/models/catalog';
import type { ModelInfo } from '@/types';
import { getDeviceMemoryGb, probeWebGPU } from '@/utils';

export function useDeviceCapabilities() {
  const [webgpu, setWebgpu] = useState<boolean | null>(null);
  const [memoryGb] = useState(getDeviceMemoryGb());
  const [recommended, setRecommended] = useState<ModelInfo>(() =>
    recommendModelForDevice(memoryGb),
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await probeWebGPU();
      if (cancelled) return;
      setWebgpu(ok);
      setRecommended(recommendModelForDevice(memoryGb));
    })();
    return () => {
      cancelled = true;
    };
  }, [memoryGb]);

  return {
    /** null while probing; true/false after requestAdapter resolves */
    webgpu,
    webgpuReady: webgpu !== null,
    memoryGb,
    recommended,
  };
}
