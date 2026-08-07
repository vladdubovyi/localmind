/**
 * Default Router Factory singleton — registry SoT for routing.
 * Other pods call `registerSkill` / `getDefaultRouter()`; do not add if/else in useAgent.
 */

import { createRouterFactory } from '../router/factory';
import type { RouterFactory } from '../router/types';
import { registerCoreSkills } from './coreSkills';
import { registerBrowserMemorySkill } from './browserMemorySkill';
import { registerProjectTemplateSkills } from './projects';
import { registerWorkflowSkills } from './workflowSkills';

let defaultRouter: RouterFactory | null = null;

function seedDefaultSkills(router: RouterFactory): void {
  registerCoreSkills(router);
  registerBrowserMemorySkill(router);
  registerProjectTemplateSkills(router);
  registerWorkflowSkills(router);
}

/** Lazily create and seed the process-wide router with core + project + browser memory + workflow skills. */
export function getDefaultRouter(): RouterFactory {
  if (!defaultRouter) {
    defaultRouter = createRouterFactory({
      defaultSearchEngine: 'google',
      enableStage2: false,
    });
    seedDefaultSkills(defaultRouter);
  }
  return defaultRouter;
}

/** Replace the default router (tests). */
export function resetDefaultRouter(router?: RouterFactory): RouterFactory {
  defaultRouter =
    router ??
    createRouterFactory({
      defaultSearchEngine: 'google',
      enableStage2: false,
    });
  if (!router) seedDefaultSkills(defaultRouter);
  return defaultRouter;
}

/** Convenience: registerSkill on the default factory. */
export function registerSkill(
  ...args: Parameters<RouterFactory['registerSkill']>
): void {
  getDefaultRouter().registerSkill(...args);
}
