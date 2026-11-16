import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Some bundled libraries (ExcelJS/sax) contain a literal U+FFFD inside string literals.
 * Emit it as the equivalent escape so the output is plain, portable text.
 */
const escapeReplacementChar = () => ({
  name: 'escape-replacement-char',
  generateBundle(_: unknown, bundle: Record<string, { type: string; code?: string }>) {
    for (const f of Object.values(bundle)) if (f.type === 'chunk' && f.code) f.code = f.code.replace(/\uFFFD/g, '\\uFFFD');
  },
});

export default defineConfig({
  plugins: [react(), escapeReplacementChar()],
  base: './',
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          excel: ['exceljs'],
          pdf: ['jspdf', 'jspdf-autotable'],
        },
      },
    },
  },
  test: { environment: 'jsdom' },
} as any);
