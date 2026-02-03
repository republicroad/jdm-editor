import React, { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import zh_CN from './zh_CN.json';
import en_US from './en_US.json';

export type Locale = 'zh' | 'en';

export type TranslationKey = keyof typeof zh_CN;

interface I18nContextValue {
  t: (key: TranslationKey) => string;
  locale: Locale;
}

const locales: Record<Locale, Record<string, string>> = {
  zh: zh_CN,
  en: en_US,
};

const I18nContext = createContext<I18nContextValue>({
  t: (key: TranslationKey) => key,
  locale: 'zh',
});

export interface I18nProviderProps {
  locale?: Locale;
  children: ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ locale = 'zh', children }) => {
  const value = useMemo(() => {
    const t = (key: TranslationKey): string => {
      return locales[locale]?.[key] || key;
    };

    return { t, locale };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useTranslation = (): I18nContextValue => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return context;
};
