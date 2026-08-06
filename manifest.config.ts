import { defineManifest } from '@crxjs/vite-plugin';

const version = '0.2.0';

export default defineManifest({
  manifest_version: 3,
  name: 'LocalMind',
  description:
    'Private AI that lives inside your browser. Chat, page tools, and optional local browser agent.',
  version,
  icons: {
    '16': 'public/icons/icon16.png',
    '32': 'public/icons/icon32.png',
    '48': 'public/icons/icon48.png',
    '128': 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: 'LocalMind',
    default_icon: {
      '16': 'public/icons/icon16.png',
      '32': 'public/icons/icon32.png',
      '48': 'public/icons/icon48.png',
    },
  },
  side_panel: {
    default_path: 'src/sidebar/index.html',
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  content_scripts: [
    {
      matches: ['http://*/*', 'https://*/*'],
      js: ['src/content/content-script.ts'],
      run_at: 'document_idle',
    },
  ],
  permissions: [
    'activeTab',
    'storage',
    'sidePanel',
    'contextMenus',
    'scripting',
  ],
  // Granted at runtime when Agent / Gmail is enabled.
  // Note: chrome.debugger cannot be optional in MV3 — do not list it here.
  optional_permissions: ['tabs', 'identity'],
  optional_host_permissions: [
    'http://*/*',
    'https://*/*',
    'https://mail.google.com/*',
    'https://gmail.googleapis.com/*',
    'https://www.googleapis.com/*',
    'https://accounts.google.com/*',
  ],
  // Required for WebLLM model + wasm artifact downloads (then works offline from cache).
  host_permissions: [
    'https://huggingface.co/*',
    'https://*.huggingface.co/*',
    'https://*.hf.co/*',
    'https://raw.githubusercontent.com/*',
  ],
  content_security_policy: {
    extension_pages:
      "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'; worker-src 'self'",
  },
});
