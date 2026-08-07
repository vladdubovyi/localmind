import { useEffect, useState } from 'react';
import { BrandMark } from '@/components/common/BrandMark';
import { openSidePanelFromPage } from '@/utils/sidePanel';

/**
 * Toolbar popup is a redirect-only shell. All product UI (setup, model,
 * chat, agent) lives in the side panel so permissions and downloads stay
 * consistent in one durable surface.
 */
export function RedirectToSidePanel() {
  const [status, setStatus] = useState('Opening Phil…');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const ok = await openSidePanelFromPage();
      if (cancelled) return;
      if (ok) {
        setStatus('Opened in the side panel');
        try {
          window.close();
        } catch {
          // Some hosts ignore window.close(); user can dismiss the popup.
        }
        return;
      }
      setStatus('Could not open the side panel. Use the puzzle menu → Phil → side panel.');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex h-[160px] w-[300px] flex-col items-center justify-center gap-3 px-5 text-center">
      <BrandMark size="sm" />
      <p className="text-sm text-muted">{status}</p>
    </div>
  );
}
