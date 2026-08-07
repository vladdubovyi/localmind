import type {
  RegisteredSkill,
  RouteConfidence,
  RouteContext,
  Skill,
  SkillPlan,
  SkillPlanStep,
} from '../skills/types';
import type {
  CreateRouterFactoryOptions,
  RegisterSkillOptions,
  RouterFactory,
} from './types';

const DEFAULT_SHORT_CIRCUIT = 0.75;
const DEFAULT_MIN_ACCEPT = 0.55;
const DEFAULT_MARGIN = 0.15;

function confidenceFor(score: number): RouteConfidence {
  if (score >= 0.9) return 'high';
  if (score >= 0.7) return 'medium';
  return 'low';
}

function normalizeUtterance(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function localHourFrom(nowMs: number, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone,
    }).formatToParts(new Date(nowMs));
    const h = parts.find((p) => p.type === 'hour')?.value;
    const n = h != null ? Number(h) : NaN;
    return Number.isFinite(n) ? n % 24 : new Date(nowMs).getHours();
  } catch {
    return new Date(nowMs).getHours();
  }
}

/** Build a complete RouteContext from utterance + partial caller context. */
export function buildRouteContext(
  utterance: string,
  partial: Partial<RouteContext> = {},
): RouteContext {
  const goal = (partial.goal ?? partial.utterance ?? utterance).trim();
  const text = utterance.trim() || goal;
  const nowMs = partial.nowMs ?? Date.now();
  const timeZone = partial.timeZone ?? deviceTimeZone();
  return {
    ...partial,
    goal,
    utterance: text,
    utteranceNorm: partial.utteranceNorm ?? normalizeUtterance(text).toLowerCase(),
    nowMs,
    timeZone,
    localHour: partial.localHour ?? localHourFrom(nowMs, timeZone),
    trigger: partial.trigger ?? 'chat',
    calendarConnected: partial.calendarConnected ?? false,
    memoryEnabled: partial.memoryEnabled ?? true,
    historyAvailable: partial.historyAvailable,
    debugRouting: partial.debugRouting ?? partial.testMode ?? false,
    testMode: partial.testMode ?? partial.debugRouting ?? false,
  };
}

function scoreSkill(skill: RegisteredSkill, ctx: RouteContext): number {
  if (skill.canHandle && skill.canHandle(ctx) === false) return 0;
  if (typeof skill.score === 'function') {
    const raw = skill.score(ctx);
    if (typeof raw === 'number') return clamp01(raw);
    if (raw && typeof raw === 'object' && typeof raw.score === 'number') {
      return clamp01(raw.score);
    }
  }
  return clamp01(skill.routeScore(ctx));
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function idsOf(skill: RegisteredSkill): string[] {
  return [skill.id, ...(skill.aliases ?? [])];
}

function looksAmbiguousAnaphora(ctx: RouteContext): boolean {
  const u = ctx.utteranceNorm ?? ctx.goal.toLowerCase();
  if (
    /\b(that thing|the thing|what we discussed|you know what i mean|help me with that)\b/i.test(
      u,
    )
  ) {
    const hasReferent =
      (ctx.recentTurns?.length ?? 0) > 0 ||
      Boolean(ctx.activeProjectId) ||
      Boolean(ctx.selection?.trim()) ||
      Boolean(ctx.priorPlan?.steps?.length);
    return !hasReferent;
  }
  return false;
}

function correctionToReminder(ctx: RouteContext): boolean {
  const hint = (ctx.correctionHint ?? ctx.goal ?? '').toLowerCase();
  return (
    /\b(no,?\s*i meant|actually|instead).{0,40}\bremind/i.test(hint) ||
    /\bi meant set a reminder\b/i.test(hint)
  );
}

function buildPlan(opts: {
  steps: SkillPlanStep[];
  confidence: RouteConfidence;
  shortCircuit: boolean;
  stage: NonNullable<SkillPlan['debug']>['stage'];
  ranked: Array<{ id: string; score: number }>;
  llmRouteCalls?: number;
  clarification?: string | null;
}): SkillPlan {
  const skills = opts.steps.map((s) => s.skillId);
  return {
    steps: opts.steps,
    confidence: opts.confidence,
    lightweight: opts.shortCircuit,
    shortCircuit: opts.shortCircuit,
    clarification: opts.clarification ?? null,
    clarifyQuestion: opts.clarification ?? undefined,
    debug: {
      skills,
      scores: opts.ranked,
      ranked: opts.ranked,
      stage: opts.stage,
      llmRouteCalls: opts.llmRouteCalls ?? 0,
    },
  };
}

/**
 * Create a Router Factory. Registry is the SoT for routing — pods only registerSkill.
 */
export function createRouterFactory(opts: CreateRouterFactoryOptions = {}): RouterFactory {
  const shortCircuitThreshold = opts.shortCircuitThreshold ?? DEFAULT_SHORT_CIRCUIT;
  const minAcceptThreshold = opts.minAcceptThreshold ?? DEFAULT_MIN_ACCEPT;
  const scoreMargin = opts.scoreMargin ?? DEFAULT_MARGIN;
  const enableStage2 = opts.enableStage2 === true && Boolean(opts.llmRouter);

  const byId = new Map<string, RegisteredSkill>();
  const aliasToId = new Map<string, string>();

  function resolveId(idOrAlias: string): string | undefined {
    if (byId.has(idOrAlias)) return idOrAlias;
    return aliasToId.get(idOrAlias);
  }

  function registerSkill(skill: Skill, options?: RegisterSkillOptions): void {
    const registered = skill as RegisteredSkill;
    const existingCanon = resolveId(registered.id);
    if (existingCanon && !options?.replace) {
      throw new Error(`Skill already registered: ${registered.id}`);
    }
    if (options?.replace && existingCanon) {
      const old = byId.get(existingCanon);
      if (old) {
        for (const a of idsOf(old)) aliasToId.delete(a);
        byId.delete(existingCanon);
      }
    }
    byId.set(registered.id, registered);
    for (const a of idsOf(registered)) {
      aliasToId.set(a, registered.id);
    }
  }

  function unregisterSkill(skillId: string): void {
    const canon = resolveId(skillId);
    if (!canon) return;
    const skill = byId.get(canon);
    if (!skill) return;
    for (const a of idsOf(skill)) aliasToId.delete(a);
    byId.delete(canon);
  }

  function listSkills(): readonly Skill[] {
    return Array.from(byId.values());
  }

  function getSkill(skillId: string): Skill | undefined {
    const canon = resolveId(skillId);
    return canon ? byId.get(canon) : undefined;
  }

  function rankAll(ctx: RouteContext): Array<{ skill: RegisteredSkill; score: number }> {
    const ranked: Array<{ skill: RegisteredSkill; score: number }> = [];
    for (const skill of byId.values()) {
      let score = scoreSkill(skill, ctx);
      if (ctx.pageUrl && skill.category === 'page' && score > 0) {
        score = Math.min(1, score + 0.08);
      }
      if (
        ctx.activeProject?.template &&
        skill.projectTemplate === ctx.activeProject.template &&
        score > 0
      ) {
        score = Math.min(1, score + 0.1);
      }
      if (score > 0) {
        ranked.push({ skill, score: clamp01(score + (skill.priority ?? 0) * 0.001) });
      }
    }
    ranked.sort((a, b) => b.score - a.score || (b.skill.priority ?? 0) - (a.skill.priority ?? 0));
    return ranked;
  }

  function stepFor(
    skill: RegisteredSkill,
    ctx: RouteContext,
    extraArgs?: Record<string, unknown>,
  ): SkillPlanStep {
    const extracted = skill.extractArgs?.(ctx) ?? null;
    const args = { ...(extracted ?? {}), ...(extraArgs ?? {}) };
    return {
      skillId: skill.id,
      params: args,
      args,
      confirmationLevel: skill.confirmationLevel,
      confidence: confidenceFor(scoreSkill(skill, ctx)),
    };
  }

  function findById(id: string): RegisteredSkill | undefined {
    const canon = resolveId(id);
    return canon ? byId.get(canon) : undefined;
  }

  function maybeMultiSkillPlan(
    ctx: RouteContext,
    ranked: Array<{ skill: RegisteredSkill; score: number }>,
  ): SkillPlan | null {
    const u = ctx.utteranceNorm ?? ctx.goal.toLowerCase();
    const compareSkill = findById('research.compare_decide');
    if (!compareSkill) return null;
    const wantsCompare =
      /\bcompare\b/i.test(u) &&
      /\b(recommend|decide|best option|which (one|should))\b/i.test(u);
    if (!wantsCompare) return null;
    const topCompare = ranked.find((r) => r.skill.id === compareSkill.id);
    if (!topCompare || topCompare.score < minAcceptThreshold) return null;

    const steps: SkillPlanStep[] = [stepFor(compareSkill, ctx)];
    if (/\bsave (this|it|the comparison)\b/i.test(u)) {
      const mem = findById('memory.remember') ?? findById('memory.save');
      if (mem) steps.push(stepFor(mem, ctx));
    }
    const debugRanked = ranked.map((r) => ({ id: r.skill.id, score: r.score }));
    return buildPlan({
      steps,
      confidence: confidenceFor(topCompare.score),
      shortCircuit: false,
      stage: 'stage1',
      ranked: debugRanked,
    });
  }

  function routeSync(
    utterance: string,
    partial: Partial<RouteContext> | RouteContext = {},
  ): SkillPlan {
    const ctx = buildRouteContext(utterance, partial as Partial<RouteContext>);
    const ranked = rankAll(ctx);
    const debugRanked = ranked.map((r) => ({ id: r.skill.id, score: r.score }));

    if (correctionToReminder(ctx)) {
      const reminder = findById('reminder.create') ?? findById('reminder');
      if (reminder) {
        return buildPlan({
          steps: [stepFor(reminder, ctx)],
          confidence: 'high',
          shortCircuit: true,
          stage: 'stage0',
          ranked: debugRanked,
        });
      }
    }

    if (looksAmbiguousAnaphora(ctx)) {
      const clarify = findById('meta.clarify');
      if (clarify) {
        const q =
          'Happy to help — which thing do you mean? Share a bit more context (project, page, or what we discussed).';
        return buildPlan({
          steps: [stepFor(clarify, ctx)],
          confidence: 'low',
          shortCircuit: true,
          stage: 'clarify',
          ranked: debugRanked,
          clarification: q,
        });
      }
    }

    const multi = maybeMultiSkillPlan(ctx, ranked);
    if (multi) return multi;

    const top = ranked[0];
    const second = ranked[1];

    if (top && top.score >= shortCircuitThreshold) {
      const alone = !second || top.score - second.score >= scoreMargin || top.score >= 0.95;
      if (alone) {
        return buildPlan({
          steps: [stepFor(top.skill, ctx)],
          confidence: confidenceFor(top.score),
          shortCircuit: true,
          stage: 'stage0',
          ranked: debugRanked,
        });
      }
    }

    if (
      top &&
      top.score >= minAcceptThreshold &&
      (!second || top.score - second.score >= scoreMargin || top.score >= shortCircuitThreshold)
    ) {
      return buildPlan({
        steps: [stepFor(top.skill, ctx)],
        confidence: confidenceFor(top.score),
        shortCircuit: top.score >= shortCircuitThreshold,
        stage: 'stage1',
        ranked: debugRanked,
      });
    }

    if (!top || top.score < minAcceptThreshold) {
      const clarify = findById('meta.clarify');
      const fallback =
        findById('assistant.general') ??
        findById('chat') ??
        ranked.find((r) => r.skill.category === 'fallback' || r.skill.category === 'meta')?.skill;

      const vague =
        /\b(help|something|stuff|idk|not sure)\b/i.test(ctx.utteranceNorm ?? '') &&
        (ctx.utteranceNorm?.split(/\s+/).length ?? 0) < 8;

      if (vague && clarify && (!top || top.score < 0.35)) {
        const q = 'Could you clarify what you need help with?';
        return buildPlan({
          steps: [stepFor(clarify, ctx)],
          confidence: 'low',
          shortCircuit: true,
          stage: 'clarify',
          ranked: debugRanked,
          clarification: q,
        });
      }

      if (fallback) {
        return buildPlan({
          steps: [stepFor(fallback, ctx)],
          confidence: 'low',
          shortCircuit: false,
          stage: 'fallback',
          ranked: debugRanked,
        });
      }
    }

    if (top) {
      return buildPlan({
        steps: [stepFor(top.skill, ctx)],
        confidence: confidenceFor(top.score),
        shortCircuit: false,
        stage: 'stage1',
        ranked: debugRanked,
      });
    }

    const emptyFallback = findById('assistant.general');
    return buildPlan({
      steps: emptyFallback ? [stepFor(emptyFallback, ctx)] : [],
      confidence: 'low',
      shortCircuit: false,
      stage: 'fallback',
      ranked: debugRanked,
    });
  }

  async function route(
    utterance: string,
    partial: Partial<RouteContext> | RouteContext = {},
  ): Promise<SkillPlan> {
    const syncPlan = routeSync(utterance, partial);
    if (
      !enableStage2 ||
      !opts.llmRouter ||
      syncPlan.shortCircuit ||
      syncPlan.debug?.stage === 'clarify' ||
      syncPlan.debug?.stage === 'stage0' ||
      syncPlan.confidence === 'high'
    ) {
      return syncPlan;
    }

    if (
      syncPlan.debug?.stage === 'fallback' ||
      syncPlan.confidence === 'low' ||
      syncPlan.confidence === 'medium'
    ) {
      try {
        const ctx = buildRouteContext(utterance, partial as Partial<RouteContext>);
        const catalog = listSkills().map((s) => ({
          id: s.id,
          description: s.description,
          examples: s.examples,
          inputSchema: s.inputSchema,
        }));
        const llm = await opts.llmRouter.route({ utterance, context: ctx, catalog });
        const ids = (llm.skillIds ?? [])
          .map((id) => resolveId(id))
          .filter(Boolean) as string[];
        if (ids.length && llm.confidence >= minAcceptThreshold) {
          const steps: SkillPlanStep[] = ids.map((id) => {
            const skill = byId.get(id)!;
            return stepFor(skill, ctx, llm.argsBySkill?.[id] ?? llm.argsBySkill?.[skill.id]);
          });
          return buildPlan({
            steps,
            confidence: confidenceFor(llm.confidence),
            shortCircuit: false,
            stage: 'stage2',
            ranked: syncPlan.debug?.ranked ?? [],
            llmRouteCalls: 1,
            clarification: llm.clarify ?? null,
          });
        }
        if (llm.clarify) {
          const clarify = findById('meta.clarify');
          if (clarify) {
            return buildPlan({
              steps: [stepFor(clarify, ctx)],
              confidence: 'low',
              shortCircuit: true,
              stage: 'clarify',
              ranked: syncPlan.debug?.ranked ?? [],
              llmRouteCalls: 1,
              clarification: llm.clarify,
            });
          }
        }
      } catch {
        // Fall through to sync plan
      }
    }
    return syncPlan;
  }

  void opts.defaultSearchEngine;

  return {
    registerSkill,
    unregisterSkill,
    listSkills,
    getSkill,
    route,
    routeSync,
  };
}
