// @vitest-environment jsdom
// 独立成文件：头部与右缘轨道同树渲染时依赖 resizable 组测量，与其他图挂载隔离。
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeContextProvider } from '../../context/theme.provider';
import type { SkinDefinition } from '../../skin/types';
import { ShellHeader } from '../shell-header';
import { SkinnedDecisionGraph } from '../skinned-decision-graph';

vi.mock('@gorules/zen-engine-wasm', () => {
  class VariableType {}
  const init = Object.assign(() => Promise.resolve(), { isReady: () => false });
  return { default: init, isReady: init.isReady, VariableType };
});
vi.mock('monaco-editor', () => ({}));

afterEach(cleanup);

const graph = { nodes: [{ id: 'a', type: 'inputNode', position: { x: 0, y: 0 }, name: 'A' }], edges: [] };

const skinWithHeader: SkinDefinition = {
  id: 'ocean',
  label: 'Ocean',
  layout: {
    header: {
      slots: {
        left: ({ graph: g }) => <div>OCEAN · {(g.nodes ?? []).length} nodes</div>,
        right: ({ disabled }) => <div>env:{disabled ? 'locked' : 'open'}</div>,
      },
    },
  },
};

const renderSkinned = (skins?: SkinDefinition[]) =>
  render(
    <ThemeContextProvider options={skins ? { skins, defaultSkinId: skins[0]?.id } : undefined}>
      <SkinnedDecisionGraph value={graph as never} onChange={vi.fn()} />
    </ThemeContextProvider>,
  );

describe('ShellHeader', () => {
  it('无槽位返回 null', () => {
    const { container } = render(
      <ThemeContextProvider>
        <ShellHeader />
      </ThemeContextProvider>,
    );
    expect(container.querySelector('header')).toBeNull();
  });

  it('有槽位渲染 left/right 并注入 ctx', () => {
    const { container } = render(
      <ThemeContextProvider options={{ skins: [skinWithHeader], defaultSkinId: 'ocean' }}>
        <ShellHeader graph={graph as never} disabled={false} />
      </ThemeContextProvider>,
    );
    const header = container.querySelector('header');
    expect(header).toBeTruthy();
    expect(header?.textContent).toContain('OCEAN · 1 nodes');
    expect(header?.textContent).toContain('env:open');
  });
});

describe('SkinnedDecisionGraph header', () => {
  it('无 header 槽位：不渲染 ShellHeader（零注入）', async () => {
    const { container } = renderSkinned();
    await waitFor(() => expect(container.querySelector('.grl-dg')).toBeTruthy());
    expect(container.querySelector('header')).toBeNull();
  });

  it('header 槽位：头部出现在画布上方并注入图数据', async () => {
    const { container } = renderSkinned([skinWithHeader]);

    const header = await waitFor(() => {
      const header = container.querySelector('header');
      if (!header) throw new Error('header not mounted yet');
      return header;
    });
    expect(header.textContent).toContain('OCEAN · 1 nodes');
    expect(container.querySelector('.grl-dg')).toBeTruthy();
  });

  it('header + right panels 组合：头部与右缘轨道共存', async () => {
    const skin: SkinDefinition = {
      id: 'ocean',
      label: 'Ocean',
      layout: {
        header: { slots: { left: () => <div>OCEAN-HEADER</div> } },
        panels: {
          right: { slots: { 'host:notes': () => <div>notes-body</div> } },
        },
      },
    };
    const { container } = renderSkinned([skin]);

    const header = await waitFor(() => {
      const header = container.querySelector('header');
      if (!header) throw new Error('header not mounted yet');
      return header;
    });
    expect(header.textContent).toContain('OCEAN-HEADER');
    expect(container.querySelector('[aria-label="skin-panel-rail"]')).toBeTruthy();

    // 右缘轨道仍可打开 Sheet
    fireEvent.click(container.querySelector('button[aria-label="Open host:notes"]')!);
    await waitFor(() => {
      if (![...document.querySelectorAll('body div')].some((d) => d.textContent === 'notes-body')) {
        throw new Error('sheet not open');
      }
    });
  });
});
