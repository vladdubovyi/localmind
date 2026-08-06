import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const distManifest = path.resolve(rootDir, '../dist/manifest.json');

/**
 * Promote optional agent/Gmail permissions to required so Chromium grants them
 * on load — avoids interactive chrome.permissions.request dialogs in CI.
 */
export default function globalSetup(): void {
  if (!fs.existsSync(distManifest)) {
    throw new Error(
      'dist/manifest.json missing. Run `npm run build` before e2e tests.',
    );
  }

  const manifest = JSON.parse(fs.readFileSync(distManifest, 'utf8')) as {
    permissions?: string[];
    host_permissions?: string[];
    optional_permissions?: string[];
    optional_host_permissions?: string[];
  };

  const permissions = new Set(manifest.permissions ?? []);
  for (const p of manifest.optional_permissions ?? []) permissions.add(p);

  const hosts = new Set(manifest.host_permissions ?? []);
  for (const h of manifest.optional_host_permissions ?? []) hosts.add(h);

  manifest.permissions = [...permissions];
  manifest.host_permissions = [...hosts];
  delete manifest.optional_permissions;
  delete manifest.optional_host_permissions;

  fs.writeFileSync(distManifest, `${JSON.stringify(manifest, null, 2)}\n`);
}
