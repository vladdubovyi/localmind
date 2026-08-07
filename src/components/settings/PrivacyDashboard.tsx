import { useCallback, useEffect, useState } from 'react';
import type { AppSettings } from '@/types';
import {
  clearAllMemories,
  clearBrowserMemory,
  clearChats,
  clearFocusHistory,
  connectCalendarFromPrivacy,
  enableHistoryFromPrivacy,
  getPermissionInventory,
  leavesDeviceRows,
  localDataRows,
  revokeOptionalPermission,
  type PermissionRow,
} from '@/storage/privacy';
import { cn } from '@/utils';

interface PrivacyDashboardProps {
  settings: AppSettings;
  onChange: (partial: Partial<AppSettings>) => void;
}

export function PrivacyDashboard({ settings, onChange }: PrivacyDashboardProps) {
  const [perms, setPerms] = useState<PermissionRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setPerms(await getPermissionInventory());
  }, []);

  useEffect(() => {
    void refresh();
    const onChanged = () => void refresh();
    chrome.permissions?.onAdded?.addListener(onChanged);
    chrome.permissions?.onRemoved?.addListener(onChanged);
    const storageListener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area === 'local' && (changes.philCalendar || changes.onboarding)) void refresh();
    };
    chrome.storage.onChanged.addListener(storageListener);
    return () => {
      chrome.permissions?.onAdded?.removeListener(onChanged);
      chrome.permissions?.onRemoved?.removeListener(onChanged);
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, [refresh]);

  const calendarOn = perms.find((p) => p.id === 'calendar')?.granted ?? false;
  const gmailOn = perms.find((p) => p.id === 'gmail')?.granted ?? false;

  const runClear = async (kind: 'chats' | 'memories' | 'focus' | 'browser') => {
    const labels = {
      chats: 'Clear all saved chats?',
      memories: 'Clear all memories?',
      focus: 'Clear focus history?',
      browser: 'Clear browser memory?',
    };
    if (!window.confirm(labels[kind])) return;
    setBusy(true);
    setStatus(null);
    try {
      if (kind === 'chats') { await clearChats(); setStatus('Chats cleared.'); }
      else if (kind === 'memories') { await clearAllMemories(); setStatus('Memories cleared.'); }
      else if (kind === 'browser') { const n = await clearBrowserMemory(); setStatus(`Browser memory cleared (${n} entries).`); }
      else { await clearFocusHistory(); setStatus('Focus history cleared.'); }
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Clear failed');
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: PermissionRow['id']) => {
    if (id !== 'gmail' && id !== 'hosts' && id !== 'calendar' && id !== 'history') return;
    setBusy(true);
    try {
      const ok = await revokeOptionalPermission(id);
      await refresh();
      setStatus(ok ? `${id} revoked.` : `Could not revoke ${id}.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="privacy-dashboard">
      <div>
        <h2 className="text-sm font-semibold text-fg">Privacy</h2>
        <p className="mt-1 text-xs text-muted">
          Phil keeps your work on this device. Review permissions, data flow, and clear local data anytime.
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Memory</h3>
        <div className="space-y-2 rounded-2xl border border-border bg-panel p-3">
          <Toggle
            label={settings.memoryEnabled ? 'Memory on' : 'Memory is off'}
            checked={settings.memoryEnabled}
            onChange={(memoryEnabled) => {
              onChange({ memoryEnabled });
              if (!memoryEnabled) {
                void clearBrowserMemory().then((n) => {
                  setStatus(
                    n > 0
                      ? 'Memory is off — browser memory index cleared.'
                      : 'Memory is off — Phil will not store new facts or browser memory hits.',
                  );
                });
              }
            }}
          />
          <p className="text-[11px] text-muted">
            {settings.memoryEnabled
              ? 'New “remember that…” facts and browser memory indexing stay on this device.'
              : 'Memory is off — Phil will not store new facts or return browser memory hits until you turn it on.'}
          </p>
          {!settings.memoryEnabled && (
            <button
              type="button"
              disabled={busy}
              className="rounded-lg px-2 py-1 text-[11px] text-danger ring-1 ring-border hover:bg-panel-elevated disabled:opacity-40"
              onClick={() => void runClear('browser')}
            >
              Disable browser memory
            </button>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Permission inventory</h3>
        <ul className="space-y-2 rounded-2xl border border-border bg-panel p-3">
          {perms.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-2 border-b border-border-subtle pb-2 last:border-0 last:pb-0">
              <div className="min-w-0">
                <div className="text-sm text-fg">
                  {p.label}{' '}
                  <span className={cn('text-[11px] font-medium', p.granted ? 'text-accent' : 'text-muted')}>
                    {p.granted ? 'granted' : 'not granted'}
                  </span>
                </div>
                <div className="text-[11px] text-muted">{p.detail}</div>
              </div>
              {p.optional && (p.id === 'gmail' || p.id === 'hosts' || p.id === 'calendar' || p.id === 'history') && (
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {p.id === 'calendar' && !p.granted && (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg px-2 py-1 text-[11px] text-accent ring-1 ring-accent/30 hover:bg-accent/10 disabled:opacity-40"
                      onClick={() => {
                        void (async () => {
                          setBusy(true);
                          await connectCalendarFromPrivacy();
                          await refresh();
                          setBusy(false);
                          setStatus('Calendar marked enabled. Full OAuth is completed in onboarding.');
                        })();
                      }}
                    >
                      Enable
                    </button>
                  )}
                  {p.id === 'history' && !p.granted && (
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-lg px-2 py-1 text-[11px] text-accent ring-1 ring-accent/30 hover:bg-accent/10 disabled:opacity-40"
                      onClick={() => {
                        void (async () => {
                          setBusy(true);
                          const ok = await enableHistoryFromPrivacy();
                          await refresh();
                          setBusy(false);
                          setStatus(
                            ok
                              ? 'History enabled — Phil can index recent visits for browser memory.'
                              : 'Could not enable History. Check the Chrome permission prompt.',
                          );
                        })();
                      }}
                    >
                      Enable
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={busy || (!p.granted && p.id !== 'gmail' && p.id !== 'hosts')}
                    className="rounded-lg px-2 py-1 text-[11px] text-danger ring-1 ring-border hover:bg-panel-elevated disabled:opacity-40"
                    onClick={() => void revoke(p.id)}
                  >
                    {p.id === 'gmail' || p.id === 'calendar' ? 'Disconnect' : 'Revoke'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Stays on device</h3>
        <ul className="space-y-1.5 rounded-2xl border border-border bg-panel p-3 text-xs text-fg-dim">
          {localDataRows(calendarOn).map((r) => (
            <li key={r.label}>
              <span className="text-fg">{r.label}</span> — {r.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">May leave device</h3>
        <ul className="space-y-1.5 rounded-2xl border border-border bg-panel p-3 text-xs text-fg-dim">
          {leavesDeviceRows({ gmail: gmailOn, calendar: calendarOn }).map((r) => (
            <li key={r.label}>
              <span className="text-fg">{r.label}</span> — {r.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Clear data</h3>
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-panel p-3">
          <button type="button" disabled={busy} className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-xs text-fg hover:border-accent/40 disabled:opacity-40" onClick={() => void runClear('chats')}>Clear chats</button>
          <button type="button" disabled={busy} className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-xs text-fg hover:border-accent/40 disabled:opacity-40" onClick={() => void runClear('memories')}>Clear memories</button>
          <button type="button" disabled={busy} className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-xs text-fg hover:border-accent/40 disabled:opacity-40" onClick={() => void runClear('focus')}>Clear focus history</button>
          <button type="button" disabled={busy} className="rounded-xl border border-border bg-panel-elevated px-3 py-2 text-xs text-fg hover:border-accent/40 disabled:opacity-40" onClick={() => void runClear('browser')}>Clear browser memory</button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Diagnostics (opt-in)</h3>
        <div className="space-y-2 rounded-2xl border border-border bg-panel p-3">
          <Toggle label="Analytics" checked={Boolean(settings.analyticsEnabled)} onChange={(analyticsEnabled) => onChange({ analyticsEnabled })} />
          <Toggle label="Crash reporting" checked={Boolean(settings.crashReportingEnabled)} onChange={(crashReportingEnabled) => onChange({ crashReportingEnabled })} />
          <p className="text-[11px] text-muted">Both default off. Nothing is sent unless you opt in.</p>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted">Feedback</h3>
        <div className="rounded-2xl border border-border bg-panel p-3">
          <a href="https://github.com/vladdubovyi/localmind/issues/new" target="_blank" rel="noreferrer" className="inline-flex rounded-xl border border-border bg-panel-elevated px-3 py-2 text-xs text-accent hover:border-accent/40">Feedback</a>
          <p className="mt-2 text-[11px] text-muted">
            Opens GitHub issues. Or email <a className="text-accent hover:underline" href="mailto:feedback@phil.local">feedback@phil.local</a>.
          </p>
        </div>
      </section>

      {status && <p className="text-xs text-accent">{status}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-fg-dim">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
    </label>
  );
}
