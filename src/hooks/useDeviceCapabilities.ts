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
    // Avoid calling requestAdapter() on popup open — without a GPU Chrome
    // reports "No available adapters" on the extension Errors page.
    setWebgpu('gpu' in navigator);
    setRecommended(recommendModelForDevice(memoryGb));
  }, [memoryGb]);

  return { webgpu, memoryGb, recommended };
}
