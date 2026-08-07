import { test, expect, chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * BIZ-* — Wave 0 Agent A3 (Business / GTM).
 * Owned greens: BIZ-01…04, BIZ-09…10 (static site + docs + icons).
 * BIZ-05…08 need Privacy/Settings UI from B4/B5 — skipped + logged.
 */

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const websiteDir = path.join(rootDir, 'website');
const iconsDir = path.join(rootDir, 'public', 'icons');

function fileUrl(...parts: string[]): string {
  return pathToFileURL(path.join(...parts)).href;
}

test.describe('Business (BIZ)', () => {
  test('BIZ-01: Landing page loads with pitch + CTA', async () => {
    const landingPath = path.join(websiteDir, 'index.html');
    expect(fs.existsSync(landingPath), 'website/index.html must exist').toBe(true);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(fileUrl(websiteDir, 'index.html'));

    await expect(page.getByRole('heading', { name: 'Phil', exact: true })).toBeVisible();
    const pitch = page.getByTestId('north-star-pitch');
    await expect(pitch).toBeVisible();
    await expect(pitch).toContainText(/private AI chief of staff/i);
    await expect(pitch).toContainText(/browser/i);
    await expect(page.getByTestId('projects-callout')).toContainText(/Persistent Projects/i);

    const cta = page.getByTestId('install-cta');
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', /#waitlist|chrome|install/i);
    await expect(page.getByRole('link', { name: /Privacy/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Terms/i }).first()).toBeVisible();

    await browser.close();
  });

  test('BIZ-02: Privacy policy page exists and matches claims', async () => {
    const privacyPath = path.join(websiteDir, 'privacy.html');
    expect(fs.existsSync(privacyPath), 'website/privacy.html must exist').toBe(true);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(fileUrl(websiteDir, 'privacy.html'));

    const doc = page.getByTestId('privacy-policy');
    await expect(doc).toBeVisible();
    await expect(page.getByRole('heading', { name: /Privacy Policy/i })).toBeVisible();

    const body = await doc.innerText();
    expect(body).toMatch(/on-device|on your device/i);
    expect(body).toMatch(/chat/i);
    expect(body).toMatch(/page/i);
    expect(body).toMatch(/model download|CDN|Hugging Face/i);
    expect(body).toMatch(/Google/i);
    expect(body).toMatch(/Gmail/i);
    expect(body).toMatch(/Calendar/i);
    expect(body).toMatch(/history/i);
    expect(body).toMatch(/Analytics/i);
    expect(body).toMatch(/[Cc]rash reporting/i);
    expect(body).toMatch(/off by default/i);

    await browser.close();
  });

  test('BIZ-03: Terms of service page exists', async () => {
    const termsPath = path.join(websiteDir, 'terms.html');
    expect(fs.existsSync(termsPath), 'website/terms.html must exist').toBe(true);

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(fileUrl(websiteDir, 'terms.html'));

    const doc = page.getByTestId('terms-of-service');
    await expect(doc).toBeVisible();
    await expect(page.getByRole('heading', { name: /Terms of Service/i })).toBeVisible();
    const text = await doc.innerText();
    expect(text.length).toBeGreaterThan(400);
    expect(text).toMatch(/Phil/i);
    expect(text).not.toMatch(/TODO|lorem ipsum|coming soon/i);

    await browser.close();
  });

  test('BIZ-04: Chrome Web Store assets exist', async () => {
    const listingPath = path.join(rootDir, 'docs', 'cws-listing.md');
    expect(fs.existsSync(listingPath), 'docs/cws-listing.md must exist').toBe(true);
    const listing = fs.readFileSync(listingPath, 'utf8');
    expect(listing).toMatch(/##\s*Name/i);
    expect(listing).toMatch(/\bPhil\b/);
    expect(listing).toMatch(/##\s*Short description/i);
    expect(listing).toMatch(/Detailed description|long description/i);
    expect(listing).toMatch(/privacy/i);
    expect(listing).toMatch(/Persistent Projects/i);

    const required = [
      { name: 'icon16.png', minBytes: 200, w: 16 },
      { name: 'icon32.png', minBytes: 400, w: 32 },
      { name: 'icon48.png', minBytes: 800, w: 48 },
      { name: 'icon128.png', minBytes: 2000, w: 128 },
    ] as const;

    for (const icon of required) {
      const p = path.join(iconsDir, icon.name);
      expect(fs.existsSync(p), `${icon.name} must exist`).toBe(true);
      const stat = fs.statSync(p);
      expect(
        stat.size,
        `${icon.name} looks placeholder-sized (${stat.size} bytes)`,
      ).toBeGreaterThanOrEqual(icon.minBytes);

      const buf = fs.readFileSync(p);
      expect(buf[0]).toBe(0x89);
      expect(buf.toString('ascii', 1, 4)).toBe('PNG');
      expect(buf.readUInt32BE(16)).toBe(icon.w);
      expect(buf.readUInt32BE(20)).toBe(icon.w);
    }
  });

  // TODO(B4/B5): Feedback channel + analytics/crash toggles in Privacy/Settings.
  // A2 preferred fail-on-missing; A3 uses skip so static BIZ greens stay CI-clean until B4/B5.
  test.skip('BIZ-05: Feedback button in extension', async () => {
    // Requires in-extension Feedback control (B4/B5 / D2).
  });

  test.skip('BIZ-06: Analytics default off', async () => {
    // Requires Privacy/Settings analytics control; policy documents default OFF.
  });

  test.skip('BIZ-07: Crash reporting default off', async () => {
    // Requires Privacy/Settings crash reporting control; policy documents default OFF.
  });

  test.skip('BIZ-08: Opt-in analytics can be enabled explicitly', async () => {
    // Requires opt-in UI + persistence from B4/B5.
  });

  });

  test('BIZ-09: Demo video script exists and matches suite order', async () => {
    const scriptPath = path.join(rootDir, 'docs', 'demo-script.md');
    expect(fs.existsSync(scriptPath), 'docs/demo-script.md must exist').toBe(true);
    const script = fs.readFileSync(scriptPath, 'utf8');

    expect(script).toMatch(/90\s*seconds|≤\s*90|<=\s*90|~85/i);
    expect(script).toMatch(/[Oo]nboarding/);
    expect(script).toMatch(/[Cc]alendar/);
    expect(script).toMatch(/[Ss]ummarize/);
    expect(script).toMatch(/[Ss]election|[Hh]ighlight/);
    expect(script).toMatch(/[Gg]oal|[Pp]laybook/);
    expect(script).toMatch(/[Pp]roactive/);
    expect(script).toMatch(/[Pp]rivacy/);
    expect(script).toMatch(/Where am I\?/);
    expect(script).toMatch(/[Pp]roject/);
  });

  test('BIZ-10: Waitlist or newsletter capture on landing', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(fileUrl(websiteDir, 'index.html'));

    const form = page.getByTestId('waitlist-form');
    await expect(form).toBeVisible();
    await expect(page.getByTestId('waitlist-email')).toBeVisible();
    await expect(page.getByTestId('waitlist-email')).toHaveAttribute('type', 'email');
    await expect(page.getByTestId('waitlist-submit')).toBeVisible();

    await browser.close();
  });
});
