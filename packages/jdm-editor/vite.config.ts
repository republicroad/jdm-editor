import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import * as path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import wasm from 'vite-plugin-wasm';

import packageJson from './package.json';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    dts({ include: ['src/**/*.ts', 'src/**/*.tsx'], bundleTypes: true }),
    tailwindcss(),
    // Bundle composition report for docs/bundle-analysis.md; written outside
    // dist/ so it never reaches the tarball. Opt in via BUILD_ANALYZE=1.
    ...(process.env.BUILD_ANALYZE
      ? [
          visualizer({
            filename: path.resolve(__dirname, '../../docs/bundle-stats.json'),
            template: 'raw-data',
            gzipSize: true,
            brotliSize: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['@lezer/common', '@lezer/lr', '@lezer/highlight'],
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    lib: {
      entry: {
        index: path.resolve(__dirname, 'src', 'index.ts'),
        schema: path.resolve(__dirname, 'src', 'helpers', 'schema.ts'),
      },
      name: 'JDM Editor',
      formats: ['es'],
      cssFileName: 'style',
    },
    rollupOptions: {
      // Dependencies AND peerDependencies stay external: hosts provide them.
      // (peerDependencies alone proved insufficient — moving monaco-editor
      // out of dependencies silently inlined the whole monaco bundle.)
      external: [
        'react/jsx-runtime',
        'react',
        'react-dom',
        ...Object.keys(packageJson.dependencies),
        ...Object.keys(packageJson.peerDependencies ?? {}),
      ],
      output: {
        globals: {
          'react-dom': 'ReactDOM',
          'react': 'React',
        },
      },
    },
  },
});
