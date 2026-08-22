import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-links',
    '@storybook/addon-essentials',
    '@storybook/addon-interactions',
    'storybook-dark-mode',
    '@storybook/addon-storysource',
  ],
  staticDirs: [{ from: '../node_modules/@gorules/zen-engine-wasm/dist', to: '/zen-engine-wasm' }],
  framework: {
    name: '@storybook/react-vite',
    options: {
      strictMode: true,
    },
  },
  async viteFinal(config) {
    config.optimizeDeps ??= {};
    config.optimizeDeps.exclude = [...(config.optimizeDeps.exclude ?? []), '@gorules/zen-engine-wasm'];
    return config;
  },
};

export default config;
