import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import * as path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';
import dts from 'unplugin-dts/vite';
import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

import packageJson from './package.json' with { type: 'json' };

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
            filename: path.resolve(import.meta.dirname, '../../docs/bundle-stats.json'),
            template: 'raw-data',
            gzipSize: true,
            brotliSize: false,
          }),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
    dedupe: ['@lezer/common', '@lezer/lr', '@lezer/highlight'],
  },
  build: {
    target: 'esnext',
    sourcemap: true,
    lib: {
      entry: {
        index: path.resolve(import.meta.dirname, 'src', 'index.ts'),
        schema: path.resolve(import.meta.dirname, 'src', 'helpers', 'schema.ts'),
      },
      name: 'JDM Editor',
      formats: ['es'],
      cssFileName: 'style',
    },
    rolldownOptions: {
      // Dependencies AND peerDependencies stay external: hosts provide them.
      // (peerDependencies alone proved insufficient — moving monaco-editor
      // out of dependencies silently inlined the whole monaco bundle.)
      // use-sync-external-store (CJS, reached via zustand/traditional's
      // subpath import) must stay external too: bundled, its require('react')
      // survives rolldown's CJS interop and crashes in the browser. The
      // regex covers subpaths.
      external: [
        'react/jsx-runtime',
        'react',
        'react-dom',
        /^use-sync-external-store(\/.*)?$/,
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
