import { ThemeContextProvider, ThemePreference, useTheme } from '@republicroad/jdm-appshell';
import React from 'react';

/** 主题三态循环：auto → dark → light → auto（持久化在 ThemeContextProvider，跨实例共享键） */
export const ThemeToggle: React.FC = () => {
  const { themePreference, setThemePreference } = useTheme();
  const next =
    themePreference === ThemePreference.Automatic
      ? ThemePreference.Dark
      : themePreference === ThemePreference.Dark
        ? ThemePreference.Light
        : ThemePreference.Automatic;
  const label =
    themePreference === ThemePreference.Automatic
      ? 'Auto'
      : themePreference === ThemePreference.Dark
        ? 'Dark'
        : 'Light';
  return (
    <button onClick={() => setThemePreference(next)} title={`Theme: ${label} (click to switch)`}>
      ◐ {label}
    </button>
  );
};

/**
 * 实例壳：顶栏（返回目录 + 标题 + 右侧动作区）+ 主区。
 * 每个 MPA 实例页自带一个 ThemeContextProvider（无皮肤注入，皮肤演示专属 graph 实例）。
 */
export const InstanceShell: React.FC<{
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  banner?: React.ReactNode;
}> = ({ title, children, actions, banner }) => (
  <ThemeContextProvider>
    <div className='pg-root'>
      <header className='pg-header'>
        <a className='pg-back' href='./index.html'>
          ← 目录
        </a>
        <strong>{title}</strong>
        {banner}
        <div className='pg-actions'>
          {actions}
          <ThemeToggle />
        </div>
      </header>
      <main className='pg-main'>{children}</main>
    </div>
  </ThemeContextProvider>
);
