import { test, expect } from './fixtures/extension';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** BIZ-* — business / GTM (Wave0 A3 owns assets; specs live here). */
test.describe('Business (BIZ)', () => {
  test('BIZ-01: Landing page loads with pitch + CTA', async ({ page }) => {
    const candidates = [
      path.join(rootDir, 'website/index.html'),
      path.join(rootDir, 'docs/landing/index.html'),
      path.join(rootDir, 'website/index.md'),
    ];
    const hit = candidates.find((p) => fs.existsSync(p));
    expect(hit, 'landing page missing — expected website/ or docs/landing/').toBeTruthy();
    if (hit!.endsWith('.html')) {
      await page.goto('file://' + hit);
      await expect(page.getByText(/chief of staff|private AI|Phil/i).first()).toBeVisible();
      await expect(page.getByText(/Install|Waitlist|Get Phil|Chrome/i).first()).toBeVisible();
    }
  });

  test('BIZ-02: Privacy policy page exists and matches claims', async () => {
    const candidates = [
      path.join(rootDir, 'website/privacy.html'),
      path.join(rootDir, 'docs/privacy-policy.md'),
      path.join(rootDir, 'website/privacy.md'),
    ];
    const hit = candidates.find((p) => fs.existsSync(p));
    expect(hit, 'privacy policy missing').toBeTruthy();
    const text = fs.readFileSync(hit!, 'utf8');
    expect(text).toMatch(/on-device|on device/i);
    expect(text).toMatch(/model download|Gmail|research/i);
  });

  test('BIZ-03: Terms of service page exists', async () => {
    const candidates = [
      path.join(rootDir, 'website/terms.html'),
      path.join(rootDir, 'docs/terms.md'),
      path.join(rootDir, 'website/terms.md'),
    ];
    const hit = candidates.find((p) => fs.existsSync(p));
    expect(hit, 'terms of service missing').toBeTruthy();
    const text = fs.readFileSync(hit!, 'utf8');
    expect(text.length).toBeGreaterThan(40);
  });

  test('BIZ-04: Chrome Web Store assets exist', async () => {
    const icons = ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'].map((n) =>
      path.join(rootDir, 'public/icons', n),
    );
    for (const icon of icons) {
      expect(fs.existsSync(icon), `missing ${icon}`).toBeTruthy();
      expect(fs.statSync(icon).size).toBeGreaterThan(100);
    }
    const copyCandidates = [
      path.join(rootDir, 'docs/cws-listing.md'),
      path.join(rootDir, 'store/description.md'),
      path.join(rootDir, 'website/cws-listing.md'),
    ];
    const copy = copyCandidates.find((p) => fs.existsSync(p));
    expect(copy, 'CWS listing copy file missing').toBeTruthy();
  });

  test('BIZ-05: Feedback button in extension', async ({ philPage }) => {
    await expect(philPage.getByRole('button', { name: /Feedback/i })).toBeVisible({ timeout: 5_000 });
  });

  test('BIZ-06: Analytics default off', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /Settings/i }).click();
    await expect(philPage.getByText(/Analytics/i)).toBeVisible({ timeout: 5_000 });
  });

  test('BIZ-07: Crash reporting default off', async ({ philPage }) => {
    await philPage.getByRole('button', { name: /Settings/i }).click();
    await expect(philPage.getByText(/Crash reporting|crash reports/i)).toBeVisible({ timeout: 5_000 });
  });

  test('BIZ-08: Opt-in analytics can be enabled explicitly', async ({ philPage }) => {
    await expect(philPage.getByText(/opt.?in|Enable analytics|what is collected/i)).toBeVisible({
      timeout: 5_000,
    });
  });

  test('BIZ-09: Demo video script exists and matches suite order', async () => {
    const candidates = [
      path.join(rootDir, 'docs/demo-script.md'),
      path.join(rootDir, 'website/demo-script.md'),
    ];
    const hit = candidates.find((p) => fs.existsSync(p));
    expect(hit, 'docs/demo-script.md missing').toBeTruthy();
    const text = fs.readFileSync(hit!, 'utf8');
    for (const section of ['onboarding', 'page', 'selection', 'goal', 'proactive', 'privacy']) {
      expect(text.toLowerCase()).toContain(section);
    }
  });

  test('BIZ-10: Waitlist or newsletter capture on landing', async () => {
    const candidates = [
      path.join(rootDir, 'website/index.html'),
      path.join(rootDir, 'docs/landing/index.html'),
    ];
    const hit = candidates.find((p) => fs.existsSync(p));
    expect(hit, 'landing page missing for waitlist check').toBeTruthy();
    const text = fs.readFileSync(hit!, 'utf8');
    expect(text).toMatch(/waitlist|newsletter|type=["']email["']|email/i);
  });
});
