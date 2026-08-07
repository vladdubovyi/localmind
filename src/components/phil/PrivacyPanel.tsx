/**
 * Privacy tab — mounts the full Privacy dashboard (inventory, clears, opt-ins).
 */
import type { AppSettings } from '@/types';
import { PrivacyDashboard } from '@/components/settings/PrivacyDashboard';

interface PrivacyPanelProps {
  settings: AppSettings;
  onChange: (partial: Partial<AppSettings>) => void;
}

export function PrivacyPanel({ settings, onChange }: PrivacyPanelProps) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
      <PrivacyDashboard settings={settings} onChange={onChange} />
    </div>
  );
}
