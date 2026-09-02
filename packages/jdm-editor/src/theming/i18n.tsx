import * as React from 'react';

import { type InterpolationParams, interpolate } from './i18n-types';
import { type TranslationKey, en } from './messages/en';
import { zhCN } from './messages/zh-CN';

export type { TranslationKey };

/** Built-in locale catalogs. */
const BUILTIN: Record<string, Record<string, string>> = {
  en,
  'zh-CN': zhCN,
};

/** Consumer-supplied overrides keyed by locale. */
export type I18nMessages = Record<string, string>;

type I18nContextValue = {
  locale: string;
  overrides: I18nMessages | undefined;
};

type MessageLookup = (key: string) => string | undefined;

const I18nContext = React.createContext<I18nContextValue | undefined>(undefined);

function getLookup(locale: string, overrides: I18nMessages | undefined): MessageLookup {
  const builtin = BUILTIN[locale] ?? BUILTIN[locale.split('-')[0]] ?? BUILTIN.en;
  return (key: string) => overrides?.[key] ?? builtin[key] ?? en[key as TranslationKey];
}

/**
 * i18n translate hook. Returns a `t(key, params?)` function.
 *
 * Resolution chain: consumer `messages` overrides → locale catalog → English → key.
 * Supports `{{param}}` interpolation.
 *
 * @example
 * const t = useT();
 * t('dt.toolbar.import') // 'Import Excel'
 */
export const useT = (): ((key: TranslationKey | string, params?: InterpolationParams) => string) => {
  const ctx = React.useContext(I18nContext);
  return React.useCallback(
    (key: string, params?: InterpolationParams) => {
      if (!ctx) return interpolate(en[key as TranslationKey] ?? key, params);
      const lookup = getLookup(ctx.locale, ctx.overrides);
      return interpolate(lookup(key) ?? key, params);
    },
    [ctx],
  );
};

/**
 * Creates a standalone translate function (outside React tree, e.g. for
 * non-component utilities). Does NOT react to context changes.
 */
export const createT = (locale: string, overrides?: I18nMessages) => {
  const lookup = getLookup(locale, overrides);
  return (key: string, params?: InterpolationParams) => interpolate(lookup(key) ?? key, params);
};

/** Internal provider — used by JdmConfigProvider to publish locale + overrides. */
export const I18nProvider: React.FC<{
  locale: string;
  overrides?: I18nMessages;
  children: React.ReactNode;
}> = ({ locale, overrides, children }) => {
  const value = React.useMemo(() => ({ locale, overrides }), [locale, overrides]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};
