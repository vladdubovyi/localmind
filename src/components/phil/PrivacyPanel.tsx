/**
 * Minimal Privacy dashboard shell for SET-07 / POL / PRIV coordination with B4.
 * B4 owns full PRIV and MEM controls; this tab name and heading stay stable.
 */
export function PrivacyPanel() {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-y-auto overflow-x-hidden px-4 py-4">
      <h2 className="font-display text-lg text-fg">Privacy</h2>
      <p className="mt-1 text-xs text-muted">
        What stays on this device versus what may leave — and how to clear it.
      </p>

      <div className="mt-5 space-y-4">
        <section className="min-w-0">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Stays on-device</h3>
          <p className="mt-1 text-sm leading-relaxed text-fg-dim">
            Chats, page text you ask about, goals, reminders, focus history, and local model weights
            stay on this browser profile.
          </p>
        </section>
        <section className="min-w-0">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">May leave the device</h3>
          <p className="mt-1 text-sm leading-relaxed text-fg-dim">
            Model CDN downloads, optional web research, and optional Gmail / Calendar when you
            connect them. Analytics and crash reporting stay off unless you opt in.
          </p>
        </section>
        <section className="min-w-0 rounded-2xl border border-border-subtle bg-panel/40 px-4 py-4">
          <p className="text-sm font-medium text-fg">Nothing to clear yet</p>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            When memories and chat history land here, you&apos;ll clear them from this Privacy view.
            I&apos;ll keep a single clear action — no scavenger hunt across tabs.
          </p>
        </section>
      </div>
    </div>
  );
}
