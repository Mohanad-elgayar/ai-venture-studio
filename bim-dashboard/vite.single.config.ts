/** Builds the whole app into ONE self-contained HTML file: npm run build:single -> release/BIM-Coordination-Center.html */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

const escapeReplacementChar = () => ({
  name: 'escape-replacement-char',
  enforce: 'pre' as const,
  generateBundle(_: unknown, bundle: Record<string, { type: string; code?: string }>) {
    for (const f of Object.values(bundle)) if (f.type === 'chunk' && f.code) f.code = f.code.replace(/�/g, '\\uFFFD');
  },
});

export default defineConfig({
  plugins: [react(), escapeReplacementChar(), viteSingleFile({ removeViteModuleLoader: true })],
  base: './',
  publicDir: false,
  build: { outDir: 'release', emptyOutDir: true, chunkSizeWarningLimit: 5000, assetsInlineLimit: 100_000_000 },
});
