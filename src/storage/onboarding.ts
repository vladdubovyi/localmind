/**
 * First-run onboarding completion state.
 */
const KEY = 'onboarding';

export interface OnboardingState {
  /** User finished or skipped the setup wizard */
  completed: boolean;
  completedAt?: number;
  /** Which optional steps they accepted */
  grantedBrowser?: boolean;
  grantedGmail?: boolean;
  grantedDebugger?: boolean;
  /**
   * Calendar connect choice from ONB-08.
   * Live grant for Privacy/planning lives on agentSettings.calendarEnabled;
   * this snapshot records what onboarding recorded at completion.
   */
  grantedCalendar?: boolean;
  skipped?: boolean;
}

const DEFAULT: OnboardingState = { completed: false };

export async function getOnboardingState(): Promise<OnboardingState> {
  const stored = await chrome.storage.local.get(KEY);
  const value = stored[KEY] as Partial<OnboardingState> | undefined;
  return { ...DEFAULT, ...value };
}

export async function saveOnboardingState(
  partial: Partial<OnboardingState>,
): Promise<OnboardingState> {
  const current = await getOnboardingState();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}

export async function completeOnboarding(
  opts: {
    skipped?: boolean;
    grantedBrowser?: boolean;
    grantedGmail?: boolean;
    grantedDebugger?: boolean;
    grantedCalendar?: boolean;
  } = {},
): Promise<OnboardingState> {
  return saveOnboardingState({
    completed: true,
    completedAt: Date.now(),
    skipped: opts.skipped ?? false,
    grantedBrowser: opts.grantedBrowser,
    grantedGmail: opts.grantedGmail,
    grantedDebugger: opts.grantedDebugger,
    grantedCalendar: opts.grantedCalendar,
  });
}
