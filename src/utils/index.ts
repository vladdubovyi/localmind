export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

export function getDeviceMemoryGb(): number | undefined {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return nav.deviceMemory;
}

export function detectWebGPUSupport(): boolean {
  return 'gpu' in navigator;
}

/**
 * Real WebGPU probe via `navigator.gpu.requestAdapter()`.
 * Never throws — Chrome surfaces adapter rejection on the extension Errors page
 * if uncaught; we swallow and return false.
 */
export async function probeWebGPU(): Promise<boolean> {
  if (!('gpu' in navigator) || !navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

export function truncate(text: string, max = 80): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 1)}…`;
}

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
