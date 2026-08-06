import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PanelRightOpen, Plus, Settings2 } from 'lucide-react';
import { BrandMark } from '@/components/common/BrandMark';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { useChat } from '@/hooks/useChat';
import { cn } from '@/utils';

interface ChatAppProps {
  variant: 'popup' | 'sidebar';
}

export function ChatApp({ variant }: ChatAppProps) {
  const {
    settings,
    conversation,
    phase,
    progress,
    error,
    isGenerating,
    downloadAndLoad,
    updateSettings,
    send,
    stop,
    regenerate,
    newChat,
  } = useChat();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation?.messages, isGenerating]);

  const openSidePanel = async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
      window.close();
    } catch {
      // ignore when not in extension context
    }
  };

  if (!settings || !conversation || phase === 'checking') {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">
        <div className="animate-pulse-soft">Starting LocalMind…</div>
      </div>
    );
  }

  if (
    phase === 'needs_download' ||
    phase === 'cached' ||
    phase === 'downloading' ||
    phase === 'error'
  ) {
    return (
      <div className={cn('relative h-full', variant === 'popup' ? 'w-[380px]' : 'w-full')}>
        <Onboarding
          selectedModelId={settings.selectedModelId}
          progress={progress}
          error={error}
          isDownloading={phase === 'downloading'}
          alreadyCached={phase === 'cached'}
          onSelectModel={(id) => void updateSettings({ selectedModelId: id })}
          onDownload={(id) => void downloadAndLoad(id)}
        />
      </div>
    );
  }

  const messages = conversation.messages;

  return (
    <div
      className={cn(
        'relative flex h-full flex-col overflow-hidden',
        variant === 'popup' ? 'w-[380px]' : 'w-full',
      )}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2.5">
        <BrandMark size="sm" />
        <div className="flex items-center gap-1">
          {variant === 'popup' && (
            <IconButton label="Open side panel" onClick={() => void openSidePanel()}>
              <PanelRightOpen size={15} />
            </IconButton>
          )}
          <IconButton label="New chat" onClick={newChat}>
            <Plus size={15} />
          </IconButton>
          <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings2 size={15} />
          </IconButton>
        </div>
      </header>

      <div ref={scrollerRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState onPrompt={(p) => void send(p)} />
        ) : (
          messages.map((m, idx) => (
            <MessageBubble
              key={m.id}
              message={m}
              showRegenerate={
                !isGenerating &&
                m.role === 'assistant' &&
                idx === messages.length - 1
              }
              onRegenerate={() => void regenerate()}
            />
          ))
        )}
      </div>

      {error && (
        <div className="mx-3 mb-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      <ChatInput
        isGenerating={isGenerating}
        onSend={(v) => void send(v)}
        onStop={() => void stop()}
      />

      <SettingsPanel
        settings={settings}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onChange={(partial) => void updateSettings(partial)}
        onReloadModel={(id) => {
          setSettingsOpen(false);
          void downloadAndLoad(id);
        }}
      />
    </div>
  );
}

function EmptyState({ onPrompt }: { onPrompt: (p: string) => void }) {
  const prompts = [
    'Explain quantum entanglement simply',
    'Write a TypeScript debounce helper',
    'Give me 5 creative side-project ideas',
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <h2 className="font-display text-xl text-fg">What do you want to explore?</h2>
      <p className="mt-2 max-w-[28ch] text-sm text-muted">
        Your model is ready. Everything stays on this device.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        {prompts.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPrompt(p)}
            className="rounded-2xl border border-border bg-panel/70 px-3 py-2.5 text-left text-sm text-fg-dim transition hover:border-accent/40 hover:bg-panel hover:text-fg"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-panel hover:text-fg"
    >
      {children}
    </button>
  );
}
