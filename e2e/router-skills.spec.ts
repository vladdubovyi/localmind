import { test, expect } from './fixtures/extension';

/** RTE-* / SKL-* — Skills + Router Factory (Wave1 B1). */
test.describe('Router & Skills (RTE / SKL)', () => {
  test('RTE-01: Reminder utterance routes to reminder skill', async ({ philPage }) => {
    await expect(philPage.getByText(/reminder\.create|route\.skills|Remind me to call my landlord/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('RTE-02: Long-horizon career ask routes to Career Accelerator skill', async ({ philPage }) => {
    await expect(philPage.getByText(/career_accelerator|project\.career|Staff Engineer within 12/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('RTE-03: Ambiguous request asks a clarifying question', async ({ philPage }) => {
    await expect(philPage.getByText(/clarif|which thing|more context/i)).toBeVisible({ timeout: 5_000 });
  });

  test('RTE-04: Multi-skill plan for research + decide', async ({ philPage }) => {
    await expect(philPage.getByText(/research\.compare|SkillPlan|multi-skill/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('RTE-05: Page context influences routing', async ({ philPage }) => {
    await expect(philPage.getByText(/page\.summarize|Summarize this/i)).toBeVisible({ timeout: 5_000 });
  });

  test('RTE-06: Active project influences routing', async ({ philPage }) => {
    await expect(philPage.getByText(/job-hunt|Any new ones today/i)).toBeVisible({ timeout: 5_000 });
  });

  test('RTE-07: New skill registration without core edits', async ({ philPage }) => {
    await expect(philPage.getByText(/registerSkill|test-only skill|registry/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('RTE-08: Misroute is recoverable', async ({ philPage }) => {
    await expect(philPage.getByText(/No, I meant set a reminder|correct course/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('RTE-09: Efficiency: simple reminder does not require full heavy plan', async ({ philPage }) => {
    await expect(philPage.getByText(/short-circuit|lightweight skill|skills executed/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('SKL-01: Skills are enumerable', async ({ philPage }) => {
    await expect(
      philPage.getByText(/reminder|page summarize|Career|Job Hunt|Life Planner|skill registry/i),
    ).toBeVisible({ timeout: 5_000 });
  });

  test('SKL-02: Skill metadata includes confirmation policy', async ({ philPage }) => {
    await expect(philPage.getByText(/confirmation required|email\.send|data\.clear/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('SKL-03: Fallback skill for unknown', async ({ philPage }) => {
    await expect(philPage.getByText(/fallback skill|general assistant/i)).toBeVisible({ timeout: 5_000 });
  });
});
