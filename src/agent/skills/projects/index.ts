
/**
 * Register Persistent Project template skills (Wave 2 C1).
 */
import type { RouterFactory } from '../../router/types';
import {
  buildCareerAcceleratorSkill,
  buildGoalAwareBrowseSkill,
  buildJobHuntSkill,
  buildLifePlannerSkill,
  buildResearchManagerSkill,
} from './allSkills';

export function buildProjectTemplateSkills() {
  return [
    buildCareerAcceleratorSkill(),
    buildJobHuntSkill(),
    buildResearchManagerSkill(),
    buildLifePlannerSkill(),
    buildGoalAwareBrowseSkill(),
  ];
}

export function registerProjectTemplateSkills(router: RouterFactory): void {
  for (const skill of buildProjectTemplateSkills()) {
    router.registerSkill(skill, { replace: true });
  }
}

export {
  buildCareerAcceleratorSkill,
  buildJobHuntSkill,
  buildResearchManagerSkill,
  buildLifePlannerSkill,
  buildGoalAwareBrowseSkill,
};
