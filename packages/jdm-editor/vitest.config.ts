import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ['@lezer/common', '@lezer/lr', '@lezer/highlight'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'monaco-editor': fileURLToPath(new URL('./src/test-stubs/monaco-editor-stub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
