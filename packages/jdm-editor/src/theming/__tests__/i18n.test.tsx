import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { JdmConfigProvider } from '../../theme';
import { createT, useT } from '../i18n';
import { interpolate } from '../i18n-types';

describe('i18n interpolate', () => {
  it('replaces {{param}} placeholders', () => {
    expect(interpolate('Hello, {{name}}!', { name: 'World' })).toBe('Hello, World!');
  });

  it('leaves unknown params untouched', () => {
    expect(interpolate('Hello, {{name}}!', {})).toBe('Hello, {{name}}!');
  });

  it('returns template as-is when no params provided', () => {
    expect(interpolate('static text')).toBe('static text');
  });
});

describe('createT standalone translate', () => {
  it('resolves English by default', () => {
    const t = createT('en');
    expect(t('common.ok')).toBe('OK');
  });

  it('resolves Chinese via locale catalog', () => {
    const t = createT('zh-CN');
    expect(t('common.ok')).toBe('确定');
  });

  it('falls back to English key for unknown locale', () => {
    const t = createT('fr');
    expect(t('common.ok')).toBe('OK');
  });

  it('returns the key itself if not found in any catalog', () => {
    const t = createT('en');
    expect(t('nonexistent.key.path')).toBe('nonexistent.key.path');
  });

  it('supports interpolation', () => {
    const t = createT('en');
    expect(t('Hello, {{name}}!')).toBe('Hello, {{name}}!');
  });
});

describe('I18nProvider integration', () => {
  const Probe: React.FC = () => {
    const t = createT('en');
    return <div>{t('common.ok')}</div>;
  };

  it('renders inside JdmConfigProvider without errors', () => {
    render(
      <JdmConfigProvider>
        <Probe />
      </JdmConfigProvider>,
    );
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});

describe('useT hook locale resolution', () => {
  const HookProbe: React.FC = () => {
    const t = useT();
    return <div>{t('dg.node.deleteNode')}</div>;
  };

  it('renders English without a locale', () => {
    render(
      <JdmConfigProvider>
        <HookProbe />
      </JdmConfigProvider>,
    );
    expect(screen.getByText('Delete node')).toBeInTheDocument();
  });

  it('renders Chinese under zh-CN locale', () => {
    render(
      <JdmConfigProvider locale='zh-CN'>
        <HookProbe />
      </JdmConfigProvider>,
    );
    expect(screen.getByText('删除节点')).toBeInTheDocument();
  });

  it('prefers host message overrides over the locale catalog', () => {
    render(
      <JdmConfigProvider locale='zh-CN' messages={{ 'dg.node.deleteNode': 'Knoten löschen' }}>
        <HookProbe />
      </JdmConfigProvider>,
    );
    expect(screen.getByText('Knoten löschen')).toBeInTheDocument();
  });
});
