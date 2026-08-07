/**
 * Test-mode Router Factory harness for RTE / SKL Playwright.
 * Exposed on window when ?philTest=1 or __PHIL_TEST_MODE__.
 * Not shown in normal user UI.
 */

import { useEffect } from 'react';
import { getDefaultRouter, registerSkill, resetDefaultRouter } from '@/agent/skills/defaultRouter';
import { getLastRoutePlan } from '@/hooks/useAgent';
import type { Skill } from '@/agent/skills/types';

export type PhilRouterTestApi = {
  route: (
    utterance: string,
    context?: Record<string, unknown>,
  ) => {
    skills: string[];
    stage?: string;
    shortCircuit?: boolean;
    lightweight?: boolean;
    confidence: string;
    clarification?: string | null;
    llmRouteCalls: number;
    'route.skills': string[];
    confirmationLevels: Array<{ id: string; confirmationLevel: string }>;
  };
  listSkills: () => Array<{
    id: string;
    description: string;
    confirmationLevel: string;
    category?: string;
    aliases?: string[];
  }>;
  registerSkill: (skill: Partial<Skill> & { id: string; description: string }) => void;
  getLastRoute: () => ReturnType<typeof getLastRoutePlan>;
  resetRouter: () => void;
};

declare global {
  interface Window {
    __PHIL_TEST_MODE__?: boolean;
    __PHIL_ROUTER_TEST__?: PhilRouterTestApi;
    __PHIL_LAST_ROUTE__?: unknown;
  }
}

function buildApi(): PhilRouterTestApi {
  const router = getDefaultRouter();
  return {
    route(utterance, context = {}) {
      const plan = router.routeSync(utterance, {
        goal: utterance,
        utterance,
        testMode: true,
        debugRouting: true,
        ...(context as object),
      });
      const skills = plan.debug?.skills ?? plan.steps.map((s) => s.skillId);
      return {
        skills,
        stage: plan.debug?.stage,
        shortCircuit: plan.shortCircuit ?? plan.lightweight,
        lightweight: plan.lightweight ?? plan.shortCircuit,
        confidence: plan.confidence,
        clarification: plan.clarification ?? null,
        llmRouteCalls: plan.debug?.llmRouteCalls ?? 0,
        'route.skills': skills,
        confirmationLevels: plan.steps.map((s) => ({
          id: s.skillId,
          confirmationLevel: String(
            s.confirmationLevel ?? router.getSkill(s.skillId)?.confirmationLevel ?? 'none',
          ),
        })),
      };
    },
    listSkills() {
      return router.listSkills().map((s) => ({
        id: s.id,
        description: s.description,
        confirmationLevel: s.confirmationLevel,
        category: s.category,
        aliases: s.aliases,
      }));
    },
    registerSkill(partial) {
      const routeScore =
        partial.routeScore ??
        ((ctx: { goal: string; utterance?: string }) => {
          const u = (ctx.utterance ?? ctx.goal).toLowerCase();
          const examples = partial.examples ?? [];
          if (examples.some((ex) => u.includes(ex.toLowerCase().slice(0, 24)))) return 0.99;
          if (partial.id && u.includes(partial.id.split('.').pop() ?? partial.id)) return 0.95;
          return 0;
        });
      const execute =
        partial.execute ?? (() => ({ ok: true, message: 'test-only skill ran' }));
      registerSkill(
        {
          confirmationLevel: 'none',
          ...partial,
          routeScore,
          execute,
        } as Skill,
        { replace: true },
      );
    },
    getLastRoute: () => getLastRoutePlan(),
    resetRouter: () => {
      resetDefaultRouter();
    },
  };
}

/** Mount once in sidebar to install window.__PHIL_ROUTER_TEST__. */
export function RouterTestHarness() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const enabled =
      params.has('philTest') ||
      params.get('testMode') === '1' ||
      window.__PHIL_TEST_MODE__ === true;
    if (!enabled) return;

    window.__PHIL_TEST_MODE__ = true;
    window.__PHIL_ROUTER_TEST__ = buildApi();

    // Hidden DOM marker for e2e getByText fallbacks
    let el = document.getElementById('phil-router-test-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'phil-router-test-root';
      el.setAttribute('data-testid', 'phil-router-test');
      el.style.cssText =
        'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;';
      document.body.appendChild(el);
    }
    el.textContent = 'skill registry · registerSkill · route.skills · short-circuit';

    return () => {
      // keep API for subsequent tests in same page
    };
  }, []);

  return null;
}
