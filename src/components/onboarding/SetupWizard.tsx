import { useEffect, useState, type ReactNode } from 'react';
import {
  Bot,
  Calendar,
  Check,
  ChevronRight,
  Globe,
  Mail,
  MessageCircle,
  SkipForward,
  Sparkles,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { BrandMark } from '@/components/common/BrandMark';
import {
  getAgentPermissionState,
  requestBrowserPermissions,
  requestCalendarPermissions,
  requestGmailPermissions,
} from '@/agent/permissions';
import { getAgentSettings, saveAgentSettings } from '@/storage/agentSettings';
import { completeOnboarding } from '@/storage/onboarding';
import {
  clearWizardStep,
  getWizardStep,
  saveWizardStep,
} from '@/storage/sessionIntent';
import { cn } from '@/utils';

type StepId = 'welcome' | 'browser' | 'gmail' | 'calendar' | 'ready';

interface SetupWizardProps {
  variant: 'popup' | 'sidebar';
  onFinished: () => void;
}

interface StepResult {
  grantedBrowser: boolean;
  grantedGmail: boolean;
  grantedDebugger: boolean;
  grantedCalendar: boolean;
}

const STEPS: StepId[] = ['welcome', 'browser', 'gmail', 'calendar', 'ready'];

export function SetupWizard({ onFinished }: SetupWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<StepResult>({
    grantedBrowser: false,
    grantedGmail: false,
    grantedDebugger: false,
    grantedCalendar: false,
  });

  const step = STEPS[stepIndex];

  useEffect(() => {
    void (async () => {
      const [savedStep, perms, agent] = await Promise.all([
        getWizardStep(),
        getAgentPermissionState(),
        getAgentSettings(),
      ]);
      setStepIndex(Math.min(savedStep, STEPS.length - 1));
      setResults((r) => ({
        ...r,
        grantedBrowser: perms.tabs && perms.allUrls,
        grantedGmail: perms.identity,
        grantedDebugger: false,
        grantedCalendar: agent.calendarEnabled,
      }));
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    void saveWizardStep(stepIndex);
  }, [stepIndex, ready]);

  const finish = async (skipped: boolean) => {
    setBusy(true);
    try {
      if (results.grantedBrowser) {
        await saveAgentSettings({ enabled: true });
      }
      await saveAgentSettings({ calendarEnabled: results.grantedCalendar });
      await completeOnboarding({
        skipped,
        grantedBrowser: results.grantedBrowser,
        grantedGmail: results.grantedGmail,
        grantedDebugger: results.grantedDebugger,
        grantedCalendar: results.grantedCalendar,
      });
      await clearWizardStep();
      onFinished();
    } finally {
      setBusy(false);
    }
  };

  const goNext = () => {
    setStatus(null);
    if (stepIndex >= STEPS.length - 1) {
      void finish(false);
      return;
    }
    setStepIndex((i) => i + 1);
  };

  const chatNow = () => void finish(true);

  const grantBrowser = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const ok = await requestBrowserPermissions();
      setResults((r) => ({ ...r, grantedBrowser: ok || r.grantedBrowser }));
      setStatus(ok ? 'Browser access granted.' : 'Permission was declined — you can enable later.');
      if (ok) await saveAgentSettings({ enabled: true });
      goNext();
    } finally {
      setBusy(false);
    }
  };

  const grantGmail = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const ok = await requestGmailPermissions();
      setResults((r) => ({ ...r, grantedGmail: ok || r.grantedGmail }));
      setStatus(ok ? 'Gmail permission granted.' : 'Skipped for now.');
      goNext();
    } finally {
      setBusy(false);
    }
  };

  const connectCalendar = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const ok = await requestCalendarPermissions();
      if (ok) {
        await saveAgentSettings({ calendarEnabled: true });
        setResults((r) => ({ ...r, grantedCalendar: true }));
        setStatus('Calendar connected for daily planning.');
      } else {
        setStatus('Calendar connect declined — you can enable later in Privacy.');
      }
      goNext();
    } finally {
      setBusy(false);
    }
  };

  const skipCalendar = async () => {
    setBusy(true);
    setStatus(null);
    try {
      await saveAgentSettings({ calendarEnabled: false });
      setResults((r) => ({ ...r, grantedCalendar: false }));
      goNext();
    } finally {
      setBusy(false);
    }
  };

  if (!ready) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted">
        <div className="animate-pulse-soft">Preparing setup...</div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(20,184,166,0.16),_transparent_55%)]" />

      <div className="relative flex items-center justify-between px-5 pt-5">
        <BrandMark size="sm" />
        <button
          type="button"
          disabled={busy}
          onClick={chatNow}
          className="inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50"
        >
          <MessageCircle size={13} />
          Chat now
        </button>
      </div>

      <div className="relative px-5 pt-4">
        <StepDots current={stepIndex} total={STEPS.length} />
      </div>

      <div className="relative flex-1 overflow-y-auto px-5 py-4">
        {step === 'welcome' && (
          <StepBody
            icon={<Sparkles size={22} />}
            title="Welcome to Phil"
            body="Private on-device AI in your browser. Set up optional permissions — or jump straight into chat."
          >
            <div className="mt-4 space-y-3">
              <LocalityCard
                icon={<WifiOff size={14} />}
                title="Stays on-device"
                items={[
                  'Chat prompts and replies',
                  'Page text you ask about',
                  'Goals, focus, and memory',
                  'Calendar events once synced locally',
                ]}
              />
              <LocalityCard
                icon={<Wifi size={14} />}
                title="Needs the internet"
                items={[
                  'First model download (CDN)',
                  'Optional Google web research',
                  'Optional Gmail',
                  'Optional Calendar sync',
                ]}
              />
            </div>
          </StepBody>
        )}

        {step === 'browser' && (
          <StepBody
            icon={<Globe size={22} />}
            title="Browse & control pages"
            body="Allow Phil to open tabs and interact with websites for Ask this page and Agent mode. You can change this anytime in Chrome settings."
          >
            <PermissionCard
              granted={results.grantedBrowser}
              items={['List and open tabs', 'Read and act on web pages', 'Enable Browser Agent tools']}
            />
          </StepBody>
        )}

        {step === 'gmail' && (
          <StepBody
            icon={<Mail size={22} />}
            title="Gmail (optional)"
            body="Needed only if you want OAuth-based list / draft / send. You can also use session mode while signed into Gmail in a tab — no extra grant required for that."
          >
            <PermissionCard
              granted={results.grantedGmail}
              items={['chrome.identity for Google OAuth', 'Gmail API access when you connect', 'Tokens stay on this device']}
            />
          </StepBody>
        )}

        {step === 'calendar' && (
          <StepBody
            icon={<Calendar size={22} />}
            title="Calendar (optional)"
            body="Connect Calendar so daily planning can see today's events — plan my workday, move deadlines, and brief mornings without inventing a fake schedule."
          >
            <PermissionCard
              granted={results.grantedCalendar}
              items={[
                "Read today's events for daily planning",
                'Workday plans include real meetings when connected',
                'Skip anytime — enable later in Privacy',
              ]}
            />
          </StepBody>
        )}

        {step === 'ready' && (
          <StepBody
            icon={<Bot size={22} />}
            title="You're set"
            body="Next you'll download or load a local model. Permissions you skipped can be enabled later from Privacy or the Agent tab."
          >
            <div className="mt-4 space-y-2 rounded-2xl border border-border bg-panel/70 px-3 py-3 text-sm">
              <StatusRow label="Browser / Agent" ok={results.grantedBrowser} />
              <StatusRow label="Gmail OAuth" ok={results.grantedGmail} />
              <StatusRow label="Calendar" ok={results.grantedCalendar} />
            </div>
          </StepBody>
        )}

        {status && (
          <p className="mt-3 text-xs text-accent animate-fade-up">{status}</p>
        )}
      </div>

      <div className="relative space-y-2 border-t border-border-subtle px-5 py-4">
        {step === 'welcome' && (
          <Primary disabled={busy} onClick={goNext}>
            Get started
            <ChevronRight size={16} />
          </Primary>
        )}

        {step === 'browser' && (
          <>
            <Primary disabled={busy} onClick={() => void grantBrowser()}>
              {results.grantedBrowser ? 'Continue' : 'Allow browser access'}
            </Primary>
            <Secondary disabled={busy} onClick={goNext}>
              <SkipForward size={14} /> Skip for now
            </Secondary>
          </>
        )}

        {step === 'gmail' && (
          <>
            <Primary disabled={busy} onClick={() => void grantGmail()}>
              {results.grantedGmail ? 'Continue' : 'Allow Gmail access'}
            </Primary>
            <Secondary disabled={busy} onClick={goNext}>
              <SkipForward size={14} /> Skip for now
            </Secondary>
          </>
        )}

        {step === 'calendar' && (
          <>
            <Primary disabled={busy} onClick={() => void connectCalendar()}>
              {results.grantedCalendar ? 'Continue' : 'Connect Calendar'}
            </Primary>
            <Secondary disabled={busy} onClick={() => void skipCalendar()}>
              <SkipForward size={14} /> Skip for now
            </Secondary>
          </>
        )}

        {step === 'ready' && (
          <Primary disabled={busy} onClick={() => void finish(false)}>
            Continue to model setup
            <ChevronRight size={16} />
          </Primary>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={chatNow}
          className="w-full py-1 text-center text-xs text-muted transition hover:text-fg disabled:opacity-50"
        >
          Chat now — skip remaining setup
        </button>
      </div>
    </div>
  );
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 rounded-full transition-all',
            i === current ? 'w-6 bg-accent' : i < current ? 'w-3 bg-accent/50' : 'w-3 bg-border',
          )}
        />
      ))}
    </div>
  );
}

function StepBody({
  icon,
  title,
  body,
  children,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="animate-fade-up">
      <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
        {icon}
      </div>
      <h1 className="font-display text-[1.45rem] leading-tight text-fg">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      {children}
    </div>
  );
}

function LocalityCard({
  icon,
  title,
  items,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-panel/70 px-3 py-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
        <span className="text-accent">{icon}</span>
        {title}
      </div>
      <ul className="space-y-1.5 text-xs text-fg-dim">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Check size={12} className="mt-0.5 shrink-0 text-accent" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PermissionCard({ granted, items }: { granted: boolean; items: string[] }) {
  return (
    <div className="mt-4 rounded-2xl border border-border bg-panel/70 px-3 py-3">
      {granted && (
        <div className="mb-2 inline-flex items-center gap-1 rounded-lg bg-accent/15 px-2 py-1 text-[11px] font-medium text-accent">
          <Check size={12} /> Already granted
        </div>
      )}
      <ul className="space-y-1.5 text-xs text-fg-dim">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-accent">·</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatusRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-fg-dim">
      <span>{label}</span>
      <span className={ok ? 'text-accent' : 'text-muted'}>{ok ? 'On' : 'Skipped'}</span>
    </div>
  );
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-ink transition enabled:hover:brightness-110 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Secondary({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-panel px-4 py-2.5 text-sm text-fg-dim transition hover:bg-panel-elevated disabled:opacity-40"
    >
      {children}
    </button>
  );
}
