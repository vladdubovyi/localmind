import { useEffect, useState, type ReactNode } from 'react';
import {
  Bot,
  Check,
  ChevronRight,
  Globe,
  Mail,
  MessageCircle,
  Shield,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { BrandMark } from '@/components/common/BrandMark';
import {
  getAgentPermissionState,
  requestBrowserPermissions,
  requestDebuggerPermission,
  requestGmailPermissions,
} from '@/agent/permissions';
import { saveAgentSettings } from '@/storage/agentSettings';
import { completeOnboarding } from '@/storage/onboarding';
import { cn } from '@/utils';

type StepId = 'welcome' | 'browser' | 'gmail' | 'debugger' | 'ready';

interface SetupWizardProps {
  onFinished: () => void;
}

interface StepResult {
  grantedBrowser: boolean;
  grantedGmail: boolean;
  grantedDebugger: boolean;
}

const STEPS: StepId[] = ['welcome', 'browser', 'gmail', 'debugger', 'ready'];

export function SetupWizard({ onFinished }: SetupWizardProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [results, setResults] = useState<StepResult>({
    grantedBrowser: false,
    grantedGmail: false,
    grantedDebugger: false,
  });

  const step = STEPS[stepIndex];

  useEffect(() => {
    void getAgentPermissionState().then((p) => {
      setResults((r) => ({
        ...r,
        grantedBrowser: p.tabs && p.allUrls,
        grantedGmail: p.identity,
        grantedDebugger: p.debugger,
      }));
    });
  }, []);

  const finish = async (skipped: boolean) => {
    setBusy(true);
    try {
      if (results.grantedBrowser) {
        await saveAgentSettings({ enabled: true });
      }
      await completeOnboarding({
        skipped,
        grantedBrowser: results.grantedBrowser,
        grantedGmail: results.grantedGmail,
        grantedDebugger: results.grantedDebugger,
      });
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

  const grantDebugger = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const ok = await requestDebuggerPermission();
      setResults((r) => ({ ...r, grantedDebugger: ok || r.grantedDebugger }));
      if (ok) await saveAgentSettings({ allowDebugger: true });
      setStatus(ok ? 'Debugger permission granted.' : 'Skipped for now.');
      goNext();
    } finally {
      setBusy(false);
    }
  };

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
            title="Welcome to LocalMind"
            body="Private AI in your browser. Set up optional permissions for page tools, Agent, and Gmail — or jump straight into chat."
          >
            <ul className="mt-4 space-y-2 text-sm text-fg-dim">
              <Bullet>Everything optional — skip any step</Bullet>
              <Bullet>Chat works with just a local model</Bullet>
              <Bullet>Nothing leaves your device by default</Bullet>
            </ul>
          </StepBody>
        )}

        {step === 'browser' && (
          <StepBody
            icon={<Globe size={22} />}
            title="Browse & control pages"
            body="Allow LocalMind to open tabs and interact with websites for Ask this page and Agent mode. You can change this anytime in Chrome settings."
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

        {step === 'debugger' && (
          <StepBody
            icon={<Shield size={22} />}
            title="Advanced debugger (optional)"
            body="Only for hard sites where normal page tools fail. Chrome will show a strong warning. Most people should skip this."
          >
            <PermissionCard
              granted={results.grantedDebugger}
              items={['chrome.debugger attach', 'Deep DOM snapshots', 'Not required for chat or Gmail']}
            />
          </StepBody>
        )}

        {step === 'ready' && (
          <StepBody
            icon={<Bot size={22} />}
            title="You're set"
            body="Next you'll download or load a local model. Permissions you skipped can be enabled later from the Agent tab."
          >
            <div className="mt-4 space-y-2 rounded-2xl border border-border bg-panel/70 px-3 py-3 text-sm">
              <StatusRow label="Browser / Agent" ok={results.grantedBrowser} />
              <StatusRow label="Gmail OAuth" ok={results.grantedGmail} />
              <StatusRow label="Debugger" ok={results.grantedDebugger} />
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

        {step === 'debugger' && (
          <>
            <Primary disabled={busy} onClick={() => void grantDebugger()}>
              {results.grantedDebugger ? 'Continue' : 'Allow debugger'}
            </Primary>
            <Secondary disabled={busy} onClick={goNext}>
              <SkipForward size={14} /> Skip (recommended)
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

function Bullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={14} className="mt-0.5 shrink-0 text-accent" />
      <span>{children}</span>
    </li>
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
