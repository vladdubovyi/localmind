import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Bot, PanelRightOpen, Plus, Settings2 } from 'lucide-react';
import { AgentPanel } from '@/components/agent/AgentPanel';
import { BrandMark } from '@/components/common/BrandMark';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { PageActions } from '@/components/chat/PageActions';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { SetupWizard } from '@/components/onboarding/SetupWizard';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { useChat } from '@/hooks/useChat';
import { usePageContext } from '@/hooks/usePageContext';
import { usePendingSelection } from '@/hooks/usePendingSelection';
import { getOnboardingState } from '@/storage/onboarding';
import type { ChatMessage, PendingSelectionAction } from '@/types';
import { openSidePanelFromPage } from '@/utils/sidePanel';
import { cn } from '@/utils';

interface ChatAppProps {
  variant: 'popup' | 'sidebar';
}

type UiTab = 'chat' | 'agent';

function plainReplacementText(content: string): string {
  let text = content.trim();
  const fence = text.match(/^```(?:\w+)?\n([\s\S]*?)\n```$/);
  if (fence) text = fence[1].trim();
  if (
    (text.startsWith('"') && text.endsWith('"')) ||
    (text.startsWith('“') && text.endsWith('”'))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

export function ChatApp({ variant }: ChatAppProps) {
  const {
    settings,
    conversation,
    phase,
    progress,
    error,
    isGenerating,
    loadingFromCache,
    mode,
    setMode,
    downloadAndLoad,
    updateSettings,
    send,
    summarizePage,
    runSelectionAction,
    stop,
    regenerate,
    newChat,
    setError,
  } = useChat({ surface: variant });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [uiTab, setUiTab] = useState<UiTab>('chat');
  const [setupDone, setSetupDone] = useState<boolean | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const queuedSelection = useRef<PendingSelectionAction | null>(null);

  const pageCtx = usePageContext(mode === 'page');
  const autoSummarizeFired = useRef(false);

  useEffect(() => {
    if (phase === 'checking') return;
    void (async () => {
      const state = await getOnboardingState();
      // Only skip the wizard when the user has actually finished or skipped it.
      // Do NOT auto-complete just because a model is cached — that omitted
      // permission steps and made popup/side-panel flows diverge.
      setSetupDone(state.completed);
    })();
  }, [phase]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [conversation?.messages, isGenerating]);

  useEffect(() => {
    if (
      !settings?.autoSummarize ||
      mode !== 'page' ||
      pageCtx.status !== 'ready' ||
      !pageCtx.page ||
      !conversation ||
      conversation.messages.length > 0 ||
      isGenerating ||
      autoSummarizeFired.current
    ) {
      return;
    }
    autoSummarizeFired.current = true;
    void summarizePage(pageCtx.page);
  }, [
    settings?.autoSummarize,
    mode,
    pageCtx.status,
    pageCtx.page,
    conversation,
    isGenerating,
    summarizePage,
  ]);

  useEffect(() => {
    if (mode !== 'page') {
      autoSummarizeFired.current = false;
    }
  }, [mode]);

  const handlePendingSelection = useCallback(
    async (pending: PendingSelectionAction) => {
      setUiTab('chat');
      if (phase !== 'ready') {
        queuedSelection.current = pending;
        setError('Load the model first, then the selection action will run.');
        return;
      }
      await runSelectionAction(pending);
    },
    [phase, runSelectionAction, setError],
  );

  usePendingSelection(variant === 'sidebar' || variant === 'popup', handlePendingSelection);

  useEffect(() => {
    if (phase !== 'ready' || !queuedSelection.current) return;
    const pending = queuedSelection.current;
    queuedSelection.current = null;
    void runSelectionAction(pending);
  }, [phase, runSelectionAction]);

  const openSidePanel = async () => {
    await openSidePanelFromPage();
    try {
      window.close();
    } catch {
      // ignore
    }
  };

  const ensurePage = useCallback(async () => {
    if (pageCtx.status === 'ready' && pageCtx.page) return pageCtx.page;
    return pageCtx.refresh();
  }, [pageCtx]);

  const handleSend = useCallback(
    async (text: string) => {
      if (mode === 'page') {
        const page = await ensurePage();
        if (!page) {
          setError(pageCtx.error ?? 'Could not read the current page.');
          return;
        }
        await send(text, page);
        return;
      }
      await send(text);
    },
    [mode, ensurePage, send, setError, pageCtx.error],
  );

  const handleSummarize = useCallback(async () => {
    const page = await ensurePage();
    if (!page) {
      setError(pageCtx.error ?? 'Could not read the current page.');
      return;
    }
    await summarizePage(page);
  }, [ensurePage, summarizePage, setError, pageCtx.error]);

  const handleReplaceSelection = useCallback(async (message: ChatMessage) => {
    const tabId = message.selection?.tabId;
    if (tabId == null) {
      throw new Error('No tab linked to this selection. Try selecting again from the page.');
    }
    const text = plainReplacementText(message.content);
    const result = await chrome.runtime.sendMessage({
      type: 'REPLACE_SELECTION_IN_TAB',
      tabId,
      text,
    });
    if (!result?.ok) {
      throw new Error(result?.error ?? 'Could not replace selection on the page.');
    }
  }, []);

  const handleModeChange = useCallback(
    (next: typeof mode) => {
      setMode(next);
      setError(null);
    },
    [setMode, setError],
  );

  if (!settings || !conversation || phase === 'checking' || setupDone === null) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">
        <div className="animate-pulse-soft">Starting LocalMind…</div>
      </div>
    );
  }

  if (!setupDone) {
    return (
      <div className={cn('relative h-full', variant === 'popup' ? 'w-[380px]' : 'w-full')}>
        <SetupWizard variant={variant} onFinished={() => setSetupDone(true)} />
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
          alreadyCached={loadingFromCache || phase === 'cached'}
          onSelectModel={(id) => void updateSettings({ selectedModelId: id })}
          onDownload={(id) => void downloadAndLoad(id)}
        />
      </div>
    );
  }

  const messages = conversation.messages;
  const modelReady = phase === 'ready';

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

      <div className="flex gap-1 border-b border-border-subtle px-3 py-1.5">
        <TabChip active={uiTab === 'chat'} onClick={() => setUiTab('chat')} label="Chat" />
        <TabChip
          active={uiTab === 'agent'}
          onClick={() => setUiTab('agent')}
          label="Agent"
          icon={<Bot size={12} />}
        />
      </div>

      {uiTab === 'agent' ? (
        <div className="min-h-0 flex-1 overflow-hidden">
          <AgentPanel modelReady={modelReady} />
        </div>
      ) : (
        <>
          <PageActions
            mode={mode}
            onModeChange={handleModeChange}
            page={pageCtx.page}
            status={pageCtx.status}
            stats={pageCtx.stats}
            error={pageCtx.error}
            disabled={isGenerating}
            onRefresh={() => void pageCtx.refresh()}
            onSummarize={() => void handleSummarize()}
          />

          <div ref={scrollerRef} className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <EmptyState
                mode={mode}
                pageTitle={pageCtx.page?.title}
                onPrompt={(p) => void handleSend(p)}
                onSummarize={() => void handleSummarize()}
                onOpenAgent={() => setUiTab('agent')}
              />
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
                  onRegenerate={() => void regenerate(pageCtx.page)}
                  onReplaceSelection={handleReplaceSelection}
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
            onSend={(v) => void handleSend(v)}
            onStop={() => void stop()}
            placeholder={
              mode === 'page' ? 'Ask anything about this page…' : 'Message LocalMind…'
            }
          />
        </>
      )}

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

function TabChip({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition',
        active ? 'bg-accent text-ink' : 'text-muted hover:bg-panel hover:text-fg',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function EmptyState({
  mode,
  pageTitle,
  onPrompt,
  onSummarize,
  onOpenAgent,
}: {
  mode: 'chat' | 'page';
  pageTitle?: string;
  onPrompt: (p: string) => void;
  onSummarize: () => void;
  onOpenAgent: () => void;
}) {
  if (mode === 'page') {
    const prompts = [
      'What is this page about?',
      'Extract the main claims',
      'What should I pay attention to?',
    ];

    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <h2 className="font-display text-xl text-fg">Ask this page</h2>
        <p className="mt-2 max-w-[30ch] text-sm text-muted">
          {pageTitle
            ? `Answers use only “${pageTitle}”. Nothing is uploaded.`
            : 'Answers use only the open tab. Nothing is uploaded.'}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={onSummarize}
            className="rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-left text-sm text-accent transition hover:bg-accent/20"
          >
            Summarize this page
          </button>
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

  const prompts = [
    'Explain quantum entanglement simply',
    'Write a TypeScript debounce helper',
    'Give me 5 creative side-project ideas',
  ];

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <h2 className="font-display text-xl text-fg">What do you want to explore?</h2>
      <p className="mt-2 max-w-[32ch] text-sm text-muted">
        Select text for rewrite tools, or open the Agent tab to control tabs and Gmail locally.
      </p>
      <div className="mt-6 flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={onOpenAgent}
          className="rounded-2xl border border-accent/40 bg-accent/10 px-3 py-2.5 text-left text-sm text-accent transition hover:bg-accent/20"
        >
          Open Browser Agent
        </button>
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
