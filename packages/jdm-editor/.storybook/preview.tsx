import * as ZenEngineWasm from '@gorules/zen-engine-wasm';
import type { Preview } from '@storybook/react-vite';
import * as React from 'react';
import { useDarkMode } from 'storybook-dark-mode';

import { JdmConfigProvider } from '../src';

// The wasm binary is served from a static dir registered in main.ts; an explicit
// module_or_path keeps loading deterministic across dev server and static builds.
// Resolved against document.baseURI so it works on the root dev server AND the
// GitHub Pages project sub-path (an absolute /zen-engine-wasm path 404s there,
// and this top-level await would block EVERY story — the "always pending" bug).
await ZenEngineWasm.default({
  module_or_path: new URL('zen-engine-wasm/zen_engine_wasm_bg.wasm', document.baseURI).href,
});

(window as any).VariableType = ZenEngineWasm.VariableType;
(window as any).Variable = ZenEngineWasm.Variable;

export const parameters = {
  actions: { argTypesRegex: '^on[A-Z].*' },
  parameters: {
    controls: { expanded: true },
  },
  controls: {
    matchers: {
      color: /(background|color)$/i,
      date: /Date$/,
    },
  },
};

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',

    docs: {
      codePanel: true,
    },
  },
  decorators: [
    (Story) => {
      const isDark = useDarkMode();

      return (
        <div className='grl-root' style={{ height: '100%' }}>
          <style
            dangerouslySetInnerHTML={{
              __html: `html { background-color: ${isDark ? '#1f1f1f' : 'white'} }
              body {
                height: 100vh;
              }
              #storybook-root {
                height: 100%;
              }
              `,
            }}
          />
          <JdmConfigProvider theme={{ mode: isDark ? 'dark' : 'light' }}>
            <Story />
          </JdmConfigProvider>
        </div>
      );
    },
  ],
};

export default preview;
