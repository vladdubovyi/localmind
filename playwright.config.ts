import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 8 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: path.join(rootDir, 'e2e/global-setup.ts'),
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 30_000,
  },
  projects: [
    {
      name: 'chromium-extension',
      use: {
        // Extensions require Playwright's bundled Chromium + persistent context
        // (wired in e2e/fixtures/extension.ts). Model downloads into e2e/.browser-profile.
      },
    },
  ],
});
