import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { crx } from '@crxjs/vite-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import manifest from './manifest.config.ts';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss(), crx({ manifest })],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  build: {
    target: 'esnext',
    chunkSizeWarningLimit: 7000,
    rollupOptions: {
      input: {
        popup: path.resolve(rootDir, 'src/popup/index.html'),
        sidebar: path.resolve(rootDir, 'src/sidebar/index.html'),
      },
    },
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
  },
  worker: {
    format: 'es',
  },
});
