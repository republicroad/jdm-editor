import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: ['@storybook/addon-links', 'storybook-dark-mode', '@storybook/addon-docs', '@storybook/addon-mcp'],
  staticDirs: [{ from: '../node_modules/@gorules/zen-engine-wasm/dist', to: '/zen-engine-wasm' }],
  framework: {
    name: '@storybook/react-vite',
    options: {
      strictMode: true,
    },
  },
  async viteFinal(config) {
    config.plugins ??= [];
    // Storybook does not need declaration bundling; the project's
    // vite-plugin-dts instance depends on an api-extractor temp config whose
    // lifecycle is build-local and races in CI.
    config.plugins = config.plugins.filter((p) => !(p as { name?: string }).name?.includes('dts'));
    config.plugins.push(tailwindcss());
    config.resolve ??= {};
    config.resolve.alias = {
      ...(config.resolve.alias && !Array.isArray(config.resolve.alias) ? config.resolve.alias : {}),
      '@': fileURLToPath(new URL('../src', import.meta.url)),
    };
    config.optimizeDeps ??= {};
    config.optimizeDeps.exclude = [...(config.optimizeDeps.exclude ?? []), '@gorules/zen-engine-wasm'];
    // GitHub Pages serves the static build from a project sub-path — asset
    // URLs must be relative or they 404.
    config.base = './';
    return config;
  },
};

export default config;
