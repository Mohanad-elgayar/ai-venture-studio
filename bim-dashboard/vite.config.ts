import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
