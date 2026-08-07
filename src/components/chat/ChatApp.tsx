import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Bot, Keyboard, PanelRightOpen, Settings2 } from 'lucide-react';
import { AgentPanel, type AgentSeedGoal } from '@/components/agent/AgentPanel';
import { RouterTestHarness } from '@/components/agent/RouterTestHarness';
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
import { ProjectsPanel } from '@/components/phil/ProjectsPanel';
import { PrivacyPanel } from '@/components/phil/PrivacyPanel';
import { ModelRestoring } from '@/components/onboarding/ModelRestoring';
import { Onboarding } from '@/components/onboarding/Onboarding';
import { SetupWizard } from '@/components/onboarding/SetupWizard';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import {
  isRestoringEngine,
  shouldShowFullOnboarding,
} from '@/ai/engineLifecycle';
import { useChat } from '@/hooks/useChat';
import { useDeviceCapabilities } from '@/hooks/useDeviceCapabilities';
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

type UiTab = 'agent' | 'today' | 'focus' | 'goals' | 'reminders' | 'projects' | 'phil' | 'privacy';

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

  const { webgpu, webgpuReady } = useDeviceCapabilities();
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
        <div className="animate-pulse-soft">Starting Phil...</div>
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
  const showFullOnboarding = shouldShowFullOnboarding(phase, loadingFromCache);
  const showRestoring = isRestoringEngine(phase, loadingFromCache);
  const webgpuBlocked = webgpuReady && webgpu === false;
  const philTestMode =
    typeof window !== 'undefined' &&
    (new URLSearchParams(window.location.search).has('philTest') ||
      Boolean((window as unknown as { __PHIL_TEST_MODE__?: boolean }).__PHIL_TEST_MODE__));
  // E2E / router harness: Agent fast-path skills (reminders, browser memory, …) must
  // remain reachable without WebGPU. Production still shows the model gate.
  const showModelGate =
    uiTab === 'agent' &&
    !philTestMode &&
    (webgpuBlocked || showFullOnboarding || showRestoring);

  return (
    <div
      className={cn(
        'relative flex h-full max-w-full min-w-0 flex-col overflow-hidden',
        variant === 'popup' ? 'w-[380px]' : 'w-full',
      )}
    >
      <RouterTestHarness />
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
        <TabChip
          active={uiTab === 'projects'}
          onClick={() => setUiTab('projects')}
          label="Projects"
        />
        <TabChip active={uiTab === 'phil'} onClick={() => setUiTab('phil')} label="Phil" />
        <TabChip
          active={uiTab === 'privacy'}
          onClick={() => setUiTab('privacy')}
          label="Privacy"
        />
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-2 overflow-x-hidden border-b border-border-subtle px-3 py-1 text-[11px] text-muted">
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className="shrink-0 font-medium text-accent hover:underline"
        >
          Shortcuts
        </button>
        <span className="min-w-0 truncate">
          Focus Agent · Summarize page · Open Phil — press ? for the command cheatsheet
        </span>
      </div>

      {uiTab === 'agent' ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          {showModelGate ? (
            webgpuBlocked || showFullOnboarding ? (
              <Onboarding
                selectedModelId={settings.selectedModelId}
                progress={progress}
                error={
                  webgpuBlocked
                    ? 'WebGPU is not available. Local AI needs Chrome/Edge with working GPU hardware.'
                    : error
                }
                isDownloading={phase === 'downloading'}
                alreadyCached={loadingFromCache}
                onSelectModel={(id) => void updateSettings({ selectedModelId: id })}
                onDownload={(id) => void downloadAndLoad(id)}
                onContinueWithoutModel={() => setUiTab('goals')}
              />
            ) : (
              <ModelRestoring
                progress={progress}
                error={error}
                selectedModelId={settings.selectedModelId}
                onRetry={() => void downloadAndLoad(settings.selectedModelId)}
                onTrySmaller={(id) => {
                  void updateSettings({ selectedModelId: id });
                  void downloadAndLoad(id);
                }}
              />
            )
          ) : (
            <AgentPanel
              modelReady={modelReady}
              seedGoal={agentSeed}
              onSeedConsumed={() => setAgentSeed(null)}
              memoryEnabled={settings.memoryEnabled}
              emptyHint={
                <EmptyState
                  title="What should I do in your browser?"
                  body="I can summarize this page, dig through Gmail, or help you stay on a goal — say the word."
                  ctaLabel="Summarize this page"
                  onCta={() => setAgentSeed({ goal: 'Summarize this page', autoRun: true })}
                />
              }
            />
          )}
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
      ) : uiTab === 'projects' ? (
        <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <ProjectsPanel />
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
