import { JdmConfigProvider } from '@republicroad/jdm-editor';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { match } from 'ts-pattern';

import { Toaster } from '../components/ui/sonner';
import { readStorage, writeStorage } from '../lib/storage-key';
import type { SkinDefinition } from '../skin/types';

const colorMediaQuery = () => window.matchMedia('(prefers-color-scheme: dark)');

export enum ThemePreference {
  Automatic = 'automatic',
  Dark = 'dark',
  Light = 'light',
}

export type ThemeProviderOptions = {
  /** 可切换皮肤集合：seeds/tokens 驱动换肤，nodeOverrides 驱动节点 UI 劫持 */
  skins?: SkinDefinition[];
  /** 初始皮肤 id（缺省取 skins[0]） */
  defaultSkinId?: string;
};

type ThemeContextState = {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
  isDarkTheme: boolean;
  skins: SkinDefinition[];
  skinId: string;
  setSkinId: (id: string) => void;
  activeSkin?: SkinDefinition;
};

export const ThemeContext = createContext<ThemeContextState>({} as any);

export const ThemeContextProvider: React.FC<{ children: React.ReactNode; options?: ThemeProviderOptions }> = ({
  children,
  options,
}) => {
  const [themePreference, setThemePreferenceInternal] = useState<ThemePreference>(() => {
    return match(readStorage('themePreference'))
      .with('dark', () => ThemePreference.Dark)
      .with('light', () => ThemePreference.Light)
      .otherwise(() => ThemePreference.Automatic);
  });

  const [isAutomaticDark, setIsAutomaticDark] = useState(() => colorMediaQuery().matches);

  const isDarkTheme = useMemo<boolean>(() => {
    return match(themePreference)
      .with(ThemePreference.Dark, () => true)
      .with(ThemePreference.Light, () => false)
      .otherwise(() => isAutomaticDark);
  }, [themePreference, isAutomaticDark]);

  useEffect(() => {
    const eventTarget = colorMediaQuery();
    const listener = (event: MediaQueryListEvent) => {
      setIsAutomaticDark(event.matches);
    };

    eventTarget.addEventListener('change', listener);
    return () => {
      eventTarget.removeEventListener('change', listener);
    };
  }, []);

  useEffect(() => {
    document.body.setAttribute('data-theme', isDarkTheme ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', isDarkTheme);
  }, [isDarkTheme]);

  const setThemePreference = (preference: ThemePreference) => {
    setThemePreferenceInternal(preference);
    writeStorage('themePreference', preference);
  };

  /* ── 皮肤（一键换肤/换UI）──────────────────────────────────────────────
   * skins 由宿主注入；activeSkin 的 seeds/tokens 喂给 JdmConfigProvider，
   * nodeOverrides 经 useCustomNodes 劫持节点 UI 槽位。无 skins 时行为与
   * 纯主题模式完全一致。 */
  const skins = options?.skins;
  const [skinId, setSkinId] = useState<string>(() => options?.defaultSkinId ?? skins?.[0]?.id ?? '');
  const activeSkin = useMemo(() => skins?.find((skin) => skin.id === skinId) ?? skins?.[0], [skins, skinId]);

  return (
    <ThemeContext.Provider
      value={{
        themePreference,
        setThemePreference,
        isDarkTheme,
        skins: skins ?? [],
        skinId: activeSkin?.id ?? '',
        setSkinId,
        activeSkin,
      }}
    >
      <JdmConfigProvider
        theme={{ mode: isDarkTheme ? 'dark' : 'light', token: activeSkin?.tokens }}
        seeds={activeSkin?.seeds}
      >
        {children}
        <Toaster />
      </JdmConfigProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
