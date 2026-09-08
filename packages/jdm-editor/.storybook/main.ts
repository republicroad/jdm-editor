import type { StorybookConfig } from '@storybook/react-vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// addon-mcp talks to a local MCP server (127.0.0.1:<ephemeral>) — dev-only:
// bundling it into the static Pages site made every visitor's browser probe
// their own localhost and blocked story readiness. NODE_ENV is unreliable at
// config-eval time, so detect the build command from argv instead.
const isStorybookBuild = process.argv.includes('build') || process.env.NODE_ENV === 'production';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.tsx', '../../appshell/src/**/*.stories.tsx'],
  addons: [
    '@storybook/addon-links',
    'storybook-dark-mode',
    '@storybook/addon-docs',
    ...(isStorybookBuild ? [] : ['@storybook/addon-mcp']),
  ],
  // Relative mount target: works under the Pages project sub-path (an
  // absolute '/zen-engine-wasm' 404s there). Expression evaluation degrades
  // gracefully when the wasm is unreachable, but serving it keeps the
  // variable-type inference working in the static site too.
  staticDirs: [{ from: '../node_modules/@gorules/zen-engine-wasm/dist', to: 'zen-engine-wasm' }],
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
    // `#` subpath imports resolve natively via package.json imports (vite 5.1+);
    // no `@` alias — the kernel migrated to `#` (scheme D).
    // Kernel source passthrough: the appshell stories import
    // `@republicroad/jdm-editor`, which without this alias resolves through
    // appshell's node_modules link to a pnpm peer-variant instance whose dist
    // goes STALE after every `vite build` (hardlink break) — stories then run
    // outdated node code (missing buttons, empty i18n) while tests stay green.
    config.resolve.alias ??= {};
    config.resolve.alias['@republicroad/jdm-editor'] = fileURLToPath(
      new URL('../../jdm-editor/src/index.ts', import.meta.url),
    );
    config.optimizeDeps ??= {};
    config.optimizeDeps.exclude = [...(config.optimizeDeps.exclude ?? []), '@gorules/zen-engine-wasm'];
    // GitHub Pages serves the static build from a project sub-path — asset
    // URLs must be relative or they 404.
    config.base = './';
    return config;
  },
};

export default config;
