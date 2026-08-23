import { App } from './components/antd-compat';
import React, { useContext, useEffect, useMemo } from 'react';
import { Toaster } from 'sonner';

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

const fontFamily =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', sans-serif";

const lightTokens: Record<string, string | number> = {
  colorPrimary: '#1677ff',
  colorPrimaryHover: '#4096ff',
  colorPrimaryActive: '#0958d9',
  colorPrimaryBg: '#e6f4ff',
  colorPrimaryBgHover: '#bae0ff',
  colorPrimaryBorder: '#91caff',
  colorPrimaryBorderHover: '#69b1ff',
  colorPrimaryTextHover: '#4096ff',
  colorSuccess: '#52c41a',
  colorSuccessBg: '#f6ffed',
  colorSuccessBorder: '#b7eb8f',
  colorError: '#ff4d4f',
  colorErrorBg: '#fff2f0',
  colorErrorBorder: '#ffccc7',
  colorWarning: '#faad14',
  colorWarningBg: '#fffbe6',
  colorWarningBorder: '#ffe58f',
  colorWarningText: '#d48806',
  colorInfo: '#1677ff',
  colorInfoBg: '#e6f4ff',
  colorInfoBorder: '#91caff',
  colorInfoText: '#1677ff',
  colorBgLayout: '#f5f5f5',
  colorBgMask: 'rgba(0, 0, 0, 0.45)',
  colorBgElevated: '#ffffff',
  colorBgContainer: '#ffffff',
  colorBgContainerDisabled: 'rgba(0, 0, 0, 0.04)',
  colorBgTextHover: 'rgba(0, 0, 0, 0.06)',
  colorBorder: '#d9d9d9',
  colorText: 'rgba(0, 0, 0, 0.88)',
  colorTextPlaceholder: 'rgba(0, 0, 0, 0.25)',
  colorTextBase: '#000000',
  colorTextDisabled: 'rgba(0, 0, 0, 0.25)',
  colorTextSecondary: 'rgba(0, 0, 0, 0.65)',
  controlOutline: 'rgba(5, 145, 255, 0.1)',
  fontFamily,
  lineHeight: 1.5714285714285714,
  borderRadius: 6,
};

const darkTokens: Record<string, string | number> = {
  ...lightTokens,
  colorPrimary: '#1668dc',
  colorPrimaryHover: '#3c89e8',
  colorPrimaryActive: '#11a8cd',
  colorPrimaryBg: '#111a2c',
  colorPrimaryBgHover: '#112545',
  colorPrimaryBorder: '#15325b',
  colorPrimaryBorderHover: '#3170b9',
  colorPrimaryTextHover: '#3c89e8',
  colorSuccess: '#49aa19',
  colorSuccessBg: '#162312',
  colorSuccessBorder: '#274902',
  colorError: '#dc4446',
  colorErrorBg: '#2c1618',
  colorErrorBorder: '#58181c',
  colorWarning: '#d89614',
  colorWarningBg: '#2b2111',
  colorWarningBorder: '#594214',
  colorWarningText: '#d89614',
  colorInfo: '#1668dc',
  colorInfoBg: '#111a2c',
  colorInfoBorder: '#15325b',
  colorInfoText: '#1668dc',
  colorBgLayout: '#000000',
  colorBgElevated: '#1d1d1d',
  colorBgContainer: '#141414',
  colorBgContainerDisabled: 'rgba(255, 255, 255, 0.08)',
  colorBgTextHover: 'rgba(255, 255, 255, 0.08)',
  colorBorder: '#424242',
  colorText: 'rgba(255, 255, 255, 0.85)',
  colorTextPlaceholder: 'rgba(255, 255, 255, 0.25)',
  colorTextBase: '#ffffff',
  colorTextDisabled: 'rgba(255, 255, 255, 0.25)',
  colorTextSecondary: 'rgba(255, 255, 255, 0.65)',
  controlOutline: 'rgba(22, 104, 220, 0.25)',
};

export type JdmConfigProviderProps = {
  theme?: ThemeConfig;
  prefixCls?: string;
  dictionaries?: DictionaryMap;
  children?: React.ReactNode;
};

export const JdmConfigProvider: React.FC<JdmConfigProviderProps> = ({
  theme: { mode = 'light' as const, token = {} } = {},
  dictionaries,
  children,
}) => {
  useWasmReady();

  const dicts = useMemo(() => dictionaries ?? {}, [dictionaries]);

  return (
    <ThemeModeContext.Provider value={mode}>
      <DictionaryContext.Provider value={dicts}>
        <App>
          <GlobalCssVariables mode={mode} overrides={token} />
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
}> = ({ mode, overrides }) => {
  useEffect(() => {
    document.documentElement.dataset.mode = mode;
    return () => {
      delete document.documentElement.dataset.mode;
    };
  }, [mode]);

  const exposedTokens = useMemo(() => {
    const base = mode === 'dark' ? darkTokens : lightTokens;
    const t = { ...base, ...(overrides as Record<string, string | number>) };
    return {
      '--grl-color-border': t.colorBorder,
      '--grl-color-border-hover': mode === 'light' ? '#c3c3c3' : '#555555',
      '--grl-color-border-fade': mode === 'light' ? '#eef0f5' : '#333333',
      '--grl-color-primary': t.colorPrimary,
      '--grl-color-primary-bg': t.colorPrimaryBg,
      '--grl-color-primary-bg-fade': mode === 'light' ? '#f8fafc' : '#141414',
      '--grl-color-primary-bg-hover': t.colorPrimaryBgHover,
      '--grl-color-primary-border': t.colorPrimaryBorder,
      '--grl-color-primary-border-hover': t.colorPrimaryBorderHover,
      '--grl-color-primary-text-hover': t.colorPrimaryTextHover,
      '--grl-color-success': t.colorSuccess,
      '--grl-color-success-bg': t.colorSuccessBg,
      '--grl-color-success-border': t.colorSuccessBorder,
      '--grl-color-error': t.colorError,
      '--grl-color-error-bg': t.colorErrorBg,
      '--grl-color-error-border': t.colorErrorBorder,
      '--grl-color-warning': t.colorWarning,
      '--grl-color-warning-bg': t.colorWarningBg,
      '--grl-color-warning-border': t.colorWarningBorder,
      '--grl-color-warning-text': t.colorWarningText,
      '--grl-color-info': t.colorInfo,
      '--grl-color-info-bg': t.colorInfoBg,
      '--grl-color-info-border': t.colorInfoBorder,
      '--grl-color-info-text': t.colorInfoText,
      '--grl-color-bg-layout': t.colorBgLayout,
      '--grl-color-bg-mask': t.colorBgMask,
      '--grl-color-bg-elevated': t.colorBgElevated,
      '--grl-color-bg-container': t.colorBgContainer,
      '--grl-color-bg-container-disabled': t.colorBgContainerDisabled,
      '--grl-color-bg-text-hover': t.colorBgTextHover,
      '--grl-color-primary-hover': t.colorPrimaryHover,
      '--grl-color-primary-active': t.colorPrimaryActive,
      '--grl-color-text': t.colorText,
      '--grl-color-text-placeholder': t.colorTextPlaceholder,
      '--grl-color-text-base': t.colorTextBase,
      '--grl-color-text-disabled': t.colorTextDisabled,
      '--grl-color-text-secondary': t.colorTextSecondary,
      '--grl-control-outline': t.controlOutline,
      '--grl-primary-color': t.colorPrimary,
      '--grl-primary-color-bg': t.colorPrimaryBg,
      '--grl-font-family': t.fontFamily,
      '--grl-line-height': t.lineHeight,
      '--grl-border-radius': `${t.borderRadius}px`,
      ...Object.fromEntries(
        Object.entries(overrides)
          .filter(([key]) => key.startsWith('--'))
          .map(([key, value]) => [key, String(value)]),
      ),
    };
  }, [mode, overrides]);

  const cssBlock = Object.entries(exposedTokens)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  return <style dangerouslySetInnerHTML={{ __html: `:root {\n${cssBlock}\n}` }} />;
};
