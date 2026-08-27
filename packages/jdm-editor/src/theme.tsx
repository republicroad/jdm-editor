import { App } from './components/primitives';
import React, { useContext, useEffect, useMemo } from 'react';
import { Toaster } from 'sonner';

import { computeTheme } from './theming/compute';
import type { ThemeSeeds } from './theming/derive';

export { MODE_EXTRAS, darkTokens, lightTokens } from './theming/presets';
import { useWasmReady } from './helpers/wasm';

export type ThemeConfig = {
  mode?: 'light' | 'dark';
  token?: Record<string, unknown>;
  [key: string]: unknown;
};

export type DictionaryMap = Record<string, { label: string; value: string }[]>;

const ThemeModeContext = React.createContext<'light' | 'dark'>('light');

/** Active color scheme set by <JdmConfigProvider mode>. */
export const useThemeMode = (): 'light' | 'dark' => useContext(ThemeModeContext);

const DictionaryContext = React.createContext<DictionaryMap>({});

export const useDictionaries = (): DictionaryMap => useContext(DictionaryContext);

export const DictionaryProvider: React.FC<React.PropsWithChildren<{ value: DictionaryMap }>> = ({
  value,
  children,
}) => <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>;


/** Mode-scoped constants formerly inline ternaries in GlobalCssVariables
 * (roadmap P0/C4: single source, no branch literals in the render path). */
export type JdmConfigProviderProps = {
  theme?: ThemeConfig;
  /**
   * Brand seed colors (roadmap P0, one-click retheming). Light mode derives
   * the brand families; dark mode currently keeps its calibrated constants.
   * Explicit `theme.token` entries always win over derived values.
   */
  seeds?: ThemeSeeds;
  prefixCls?: string;
  dictionaries?: DictionaryMap;
  children?: React.ReactNode;
};

export const JdmConfigProvider: React.FC<JdmConfigProviderProps> = ({
  theme: { mode = 'light' as const, token = {} } = {},
  seeds,
  dictionaries,
  children,
}) => {
  useWasmReady();

  const dicts = useMemo(() => dictionaries ?? {}, [dictionaries]);

  return (
    <ThemeModeContext.Provider value={mode}>
      <DictionaryContext.Provider value={dicts}>
        <App>
          <GlobalCssVariables mode={mode} overrides={token} seeds={seeds} />
          <Toaster theme={mode} position="bottom-right" richColors />
          {children}
        </App>
      </DictionaryContext.Provider>
    </ThemeModeContext.Provider>
  );
};

const GlobalCssVariables: React.FC<{
  mode: 'light' | 'dark';
  overrides: Record<string, unknown>;
  seeds?: ThemeSeeds;
}> = ({ mode, overrides, seeds }) => {
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    return () => {
      delete document.documentElement.dataset.mode;
    };
  }, [mode]);

  const exposedTokens = useMemo(
    () => computeTheme(mode, seeds, overrides),
    [mode, seeds, overrides],
  );

  const cssBlock = Object.entries(exposedTokens)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  return <style dangerouslySetInnerHTML={{ __html: `:root {\n${cssBlock}\n}` }} />;
};
