import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Bot, Keyboard, PanelRightOpen, Settings2 } from 'lucide-react';
import { AgentPanel, type AgentSeedGoal } from '@/components/agent/AgentPanel';
import { BrandMark } from '@/components/common/BrandMark';
import { EmptyState } from '@/components/common/EmptyState';
import { ShortcutsCheatsheet } from '@/components/common/ShortcutsCheatsheet';
import {
  FocusPanel,
  GoalsPanel,
  PhilSettingsPanel,
  RemindersPanel,
  TodayPanel,
} from '@/components/phil/PhilPanels';
import { PrivacyPanel } from '@/components/phil/PrivacyPanel';
import { SetupWizard } from '@/components/onboarding/SetupWizard';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import {
  isRestoringEngine,
  shouldShowFullOnboarding,
} from '@/ai/engineLifecycle';
import { useChat } from '@/hooks/useChat';
import { usePendingSelection } from '@/hooks/usePendingSelection';
import { usePhilQuickIntent } from '@/hooks/usePhilQuickIntent';
import { getSelectionAction } from '@/prompts/selection';
import { getOnboardingState } from '@/storage/onboarding';
import type { PhilQuickIntent } from '@/phil/types';
import type { PendingSelectionAction } from '@/types';
import { openSidePanelFromPage } from '@/utils/sidePanel';
import { cn } from '@/utils';

interface ChatAppProps {
  variant: 'popup' | 'sidebar';
}

type UiTab = 'agent' | 'today' | 'focus' | 'goals' | 'reminders' | 'phil' | 'privacy';

export function ChatApp({ variant }: ChatAppProps) {
  const {
    settings,
    conversation,
    phase,
    progress,
    error,
    loadingFromCache,
    downloadAndLoad,
    updateSettings,
  } = useChat({ surface: variant });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [uiTab, setUiTab] = useState<UiTab>('agent');
  const [setupDone, setSetupDone] = useState<boolean | null>(null);
  const [agentSeed, setAgentSeed] = useState<AgentSeedGoal | null>(null);
  const queuedSelection = useRef<PendingSelectionAction | null>(null);

  useEffect(() => {
    if (phase === 'checking') return;
    void (async () => {
      const state = await getOnboardingState();
      setSetupDone(state.completed);
    })();
  }, [phase]);

  const handlePendingSelection = useCallback(async (pending: PendingSelectionAction) => {
    setUiTab('agent');
    const def = getSelectionAction(pending.action);
    const clipped = pending.text.slice(0, 8000);
    const label = def?.label ?? pending.action;
    const prompt =
      def?.buildPrompt(clipped) ??
      `${label} the following selection:\n\n--- SELECTED TEXT ---\n${clipped}\n--- END ---`;
    setAgentSeed({
      goal: prompt,
      autoRun: true,
    });
  }, []);

  usePendingSelection(variant === 'sidebar' || variant === 'popup', handlePendingSelection);

  const handlePhilIntent = useCallback((intent: PhilQuickIntent) => {
    switch (intent.kind) {
      case 'open_today':
      case 'whats_up':
        setUiTab('today');
        break;
      case 'open_focus':
      case 'focus_status':
        setUiTab('focus');
        break;
      case 'open_goals':
      case 'set_goal':
        setUiTab('goals');
        break;
      case 'open_reminders':
      case 'remind':
        setUiTab('reminders');
        break;
      case 'open_privacy':
        setUiTab('privacy');
        break;
      case 'open_phil_settings':
        setUiTab('phil');
        break;
      case 'summarize_page':
        setUiTab('agent');
        setAgentSeed({ goal: 'Summarize this page', autoRun: true });
        break;
      case 'open_agent':
      default:
        setUiTab('agent');
    }
  }, []);

  usePhilQuickIntent(variant === 'sidebar' || variant === 'popup', handlePhilIntent);

  useEffect(() => {
    if (phase !== 'ready' || !queuedSelection.current) return;
    queuedSelection.current = null;
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) return;
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openSidePanel = async () => {
    await openSidePanelFromPage();
    try {
      window.close();
    } catch {
      // ignore
    }
  };

  if (!settings || !conversation || phase === 'checking' || setupDone === null) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">
        <div className="animate-pulse-soft">Starting Phil…</div>
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

  const modelReady = phase === 'ready';
  const restoring =
    isRestoringEngine(phase, loadingFromCache) ||
    shouldShowFullOnboarding(phase, loadingFromCache);
  const restoreLabel =
    progress?.text ||
    (loadingFromCache
      ? 'Restoring model in the background…'
      : phase === 'downloading'
        ? 'Downloading model in the background…'
        : 'Preparing model in the background…');

  return (
    <div
      className={cn(
        'relative flex h-full max-w-full min-w-0 flex-col overflow-hidden',
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
          <IconButton label="Keyboard shortcuts" onClick={() => setShortcutsOpen(true)}>
            <Keyboard size={15} />
          </IconButton>
          <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings2 size={15} />
          </IconButton>
        </div>
      </header>

      <div className="flex gap-1 overflow-x-auto border-b border-border-subtle px-3 py-1.5 [scrollbar-width:none]">
        <TabChip
          active={uiTab === 'agent'}
          onClick={() => setUiTab('agent')}
          label="Agent"
          icon={<Bot size={12} />}
        />
        <TabChip active={uiTab === 'today'} onClick={() => setUiTab('today')} label="Today" />
        <TabChip active={uiTab === 'focus'} onClick={() => setUiTab('focus')} label="Focus" />
        <TabChip active={uiTab === 'goals'} onClick={() => setUiTab('goals')} label="Goals" />
        <TabChip
          active={uiTab === 'reminders'}
          onClick={() => setUiTab('reminders')}
          label="Reminders"
        />
        <TabChip active={uiTab === 'phil'} onClick={() => setUiTab('phil')} label="Phil" />
        <TabChip
          active={uiTab === 'privacy'}
          onClick={() => setUiTab('privacy')}
          label="Privacy"
        />
      </div>

      {restoring && (
        <div className="shrink-0 border-b border-border-subtle bg-panel/60 px-3 py-1.5 text-[11px] text-muted">
          {restoreLabel}
          {error ? ` · ${error}` : ''}
          {phase === 'error' && (
            <>
              {' '}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={() => void downloadAndLoad(settings.selectedModelId)}
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}

      {uiTab === 'agent' ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <AgentPanel
            modelReady={modelReady}
            seedGoal={agentSeed}
            onSeedConsumed={() => setAgentSeed(null)}
            emptyHint={
              <EmptyState
                title="What should I do in your browser?"
                body="I can summarize this page, dig through Gmail, or help you stay on a goal — say the word."
                ctaLabel="Summarize this page"
                onCta={() => setAgentSeed({ goal: 'Summarize this page', autoRun: true })}
              />
            }
          />
        </div>
      ) : uiTab === 'today' ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <TodayPanel />
        </div>
      ) : uiTab === 'focus' ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <FocusPanel />
        </div>
      ) : uiTab === 'goals' ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <GoalsPanel />
        </div>
      ) : uiTab === 'reminders' ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <RemindersPanel />
        </div>
      ) : uiTab === 'privacy' ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <PrivacyPanel />
        </div>
      ) : (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <PhilSettingsPanel />
        </div>
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
        onOpenPrivacy={() => setUiTab('privacy')}
      />

      <ShortcutsCheatsheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
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
        'inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition',
        active ? 'bg-accent text-ink' : 'text-muted hover:bg-panel hover:text-fg',
      )}
    >
      {icon}
      {label}
    </button>
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
