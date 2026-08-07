import { useCallback, useEffect, useState } from 'react';
import { Brain, Search } from 'lucide-react';
import type { MemoryEntry } from '@/storage/memory';
import { forgetMemory, listMemories, rememberMemory, searchMemories } from '@/storage/memory';
import { searchConversations } from '@/storage/db';
import type { Conversation } from '@/types';
import { cn } from '@/utils';

export function MemoriesPanel({ memoryEnabled }: { memoryEnabled: boolean }) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [memQuery, setMemQuery] = useState('');
  const [convQuery, setConvQuery] = useState('');
  const [convHits, setConvHits] = useState<Conversation[]>([]);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshMemories = useCallback(async (q = memQuery) => {
    setMemories(q.trim() ? await searchMemories(q, 30) : await listMemories());
  }, [memQuery]);

  useEffect(() => {
    void refreshMemories();
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes.philMemories) void refreshMemories();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, [refreshMemories]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!convQuery.trim()) { if (!cancelled) setConvHits([]); return; }
      const hits = await searchConversations(convQuery, 10);
      if (!cancelled) setConvHits(hits);
    })();
    return () => { cancelled = true; };
  }, [convQuery]);

  return (
    <div className="space-y-3 border-b border-border-subtle px-3 py-3" data-testid="memories-panel">
      <div className="flex items-center gap-2 text-sm font-medium text-fg">
        <Brain size={14} className="text-accent" />
        Memories
      </div>
      {!memoryEnabled && (
        <p className="text-[11px] text-muted">Memory is off. Turn it on in Privacy / Settings to store new facts.</p>
      )}
      <p className="text-[11px] text-muted">Remember that… facts stay on this device. Say “Remember that …” in Agent, or use Remember below.</p>
      <div className="flex gap-2">
        <input type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Remember that…" className="min-w-0 flex-1 rounded-lg border border-border bg-ink px-2 py-1.5 text-xs text-fg outline-none focus:border-accent/50" />
        <button type="button" disabled={busy || !draft.trim()} className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-ink disabled:opacity-40" onClick={() => void (async () => {
          const text = draft.trim(); if (!text) return; setBusy(true); setStatus(null);
          try {
            if (!memoryEnabled) { setStatus('Memory is off — enable it in Privacy / Settings first.'); return; }
            const entry = await rememberMemory(text, { source: 'message' });
            setDraft(''); setStatus(`Remembered: ${entry.text}`); setMemQuery(''); setMemories(await listMemories());
          } catch (e) { setStatus(e instanceof Error ? e.message : 'Could not remember'); }
          finally { setBusy(false); }
        })()}>Remember</button>
      </div>
      <label className="relative block">
        <Search size={12} className="pointer-events-none absolute left-2 top-2 text-muted" />
        <input type="search" value={memQuery} onChange={(e) => { const q = e.target.value; setMemQuery(q); void (async () => setMemories(q.trim() ? await searchMemories(q, 30) : await listMemories()))(); }} placeholder="Search memories" className="w-full rounded-lg border border-border bg-ink py-1.5 pl-7 pr-2 text-xs text-fg outline-none focus:border-accent/50" />
      </label>
      <ul className="max-h-36 space-y-1.5 overflow-y-auto">
        {memories.length === 0 ? <li className="text-[11px] text-muted">No memories yet.</li> : memories.map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-2 rounded-lg bg-panel/70 px-2 py-1.5 text-xs text-fg-dim">
            <span className="min-w-0 flex-1 break-words">{m.text}</span>
            <button type="button" disabled={busy} className="shrink-0 text-[11px] text-muted hover:text-danger disabled:opacity-40" onClick={() => void (async () => { setBusy(true); try { await forgetMemory(m.id); await refreshMemories(); } finally { setBusy(false); } })()}>Forget</button>
          </li>
        ))}
      </ul>
      <label className="relative block">
        <Search size={12} className="pointer-events-none absolute left-2 top-2 text-muted" />
        <input type="search" value={convQuery} onChange={(e) => setConvQuery(e.target.value)} placeholder="Search conversations" className="w-full rounded-lg border border-border bg-ink py-1.5 pl-7 pr-2 text-xs text-fg outline-none focus:border-accent/50" />
      </label>
      {convQuery.trim() && (
        <ul className="max-h-28 space-y-1 overflow-y-auto text-[11px] text-muted">
          {convHits.length === 0 ? <li>No matching conversations.</li> : convHits.map((c) => (
            <li key={c.id} className={cn('truncate text-fg-dim')}>{c.title}{c.pageTitle ? ` · ${c.pageTitle}` : ''}</li>
          ))}
        </ul>
      )}
      {status && <p className="text-[11px] text-accent">{status}</p>}
    </div>
  );
}
