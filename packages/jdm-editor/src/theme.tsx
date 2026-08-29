import React, { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Toaster } from 'sonner';

import { App } from './components/primitives';
import { useWasmReady } from './helpers/wasm';
import { computeTheme } from './theming/compute';
import type { ThemeSeeds } from './theming/derive';
import { I18nProvider } from './theming/i18n';
import { GrlContainerProvider } from './theming/portal-context';

export { MODE_EXTRAS, darkTokens, lightTokens } from './theming/presets';

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

export type JdmConfigProviderProps = {
  theme?: ThemeConfig;
  /**
   * Brand seed colors (roadmap P0, one-click retheming). Both modes derive
   * brand families; explicit `theme.token` entries always win.
   */
  seeds?: ThemeSeeds;
  /** BCP 47 locale tag (e.g. `'en'`, `'zh-CN'`). Defaults to `'en'`. */
  locale?: string;
  /** Consumer i18n overrides — highest priority in the resolution chain. */
  messages?: Record<string, string>;
  prefixCls?: string;
  dictionaries?: DictionaryMap;
  children?: React.ReactNode;
};

export const JdmConfigProvider: React.FC<JdmConfigProviderProps> = ({
  theme: { mode = 'light' as const, token = {} } = {},
  seeds,
  locale = 'en',
  messages,
  dictionaries,
  children,
}) => {
  useWasmReady();

  const dicts = useMemo(() => dictionaries ?? {}, [dictionaries]);

  /* ── Scoped injection (roadmap P3) ─────────────────────────────────────────
   * When the provider mounts inside a `.grl-root` island, tokens become inline
   * properties on THAT container and `data-mode` lives there too — multiple
   * independently-themed islands can coexist, and Radix portals (via
   * GrlContainerProvider) stay inside the island's variable scope, which also
   * brings the scoped preflight over portaled nodes (HK-14).
   * Legacy fallback: no `.grl-root` ancestor → global `:root` style tag +
   * documentElement dataset, exactly as before P3. */
  const anchorRef = useRef<HTMLSpanElement>(null);
  const styleRef = useRef<HTMLStyleElement>(null);
  const [container, setContainer] = useState<HTMLElement | undefined>(undefined);

  const exposedTokens = useMemo(() => computeTheme(mode, seeds, token), [mode, seeds, token]);

  useLayoutEffect(() => {
    const root = (anchorRef.current?.closest?.('.grl-root') as HTMLElement | null) ?? undefined;
    setContainer(root);
  }, []);

  useLayoutEffect(() => {
    const target = (container ?? document.documentElement) as HTMLElement & {
      dataset: Record<string, string>;
    };
    target.dataset.mode = mode;
    return () => {
      delete target.dataset.mode;
    };
  }, [container, mode]);

  useLayoutEffect(() => {
    if (container) {
      const keys = Object.keys(exposedTokens);
      for (const key of keys) {
        container.style.setProperty(key, exposedTokens[key]);
      }
      // Text color must be scoped alongside the variables: nothing else in the
      // cascade sets `color` (antd used to do it globally), so in dark mode
      // every input/editor would inherit UA black-on-dark and go invisible.
      container.style.setProperty('color', 'var(--foreground)');
      return () => {
        for (const key of keys) {
          container.style.removeProperty(key);
        }
        container.style.removeProperty('color');
      };
    }

    const el = styleRef.current;
    if (el) {
      const cssBlock = Object.entries(exposedTokens)
        .map(([key, value]) => `  ${key}: ${value};`)
        .join('\n');
      el.textContent = `:root {\n${cssBlock}\n  color: var(--foreground);\n}`;
    }
  }, [container, exposedTokens]);

  return (
    <ThemeModeContext.Provider value={mode}>
      <DictionaryContext.Provider value={dicts}>
        <App>
          <span ref={anchorRef} style={{ display: 'none' }} data-grl-anchor='' />
          {!container && (
            <style
              ref={styleRef}
              dangerouslySetInnerHTML={{
                __html: (() => {
                  const cssBlock = Object.entries(exposedTokens)
                    .map(([key, value]) => `  ${key}: ${value};`)
                    .join('\n');
                  return `:root {\n${cssBlock}\n  color: var(--foreground);\n}`;
                })(),
              }}
            />
          )}
          <GrlContainerProvider container={container}>
            <I18nProvider locale={locale} overrides={messages}>
              <Toaster theme={mode} position='bottom-right' richColors />
              {children}
            </I18nProvider>
          </GrlContainerProvider>
        </App>
      </DictionaryContext.Provider>
    </ThemeModeContext.Provider>
  );
};
