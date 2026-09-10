// @vitest-environment jsdom
// 独立成文件：面板/Sheet 内容依赖 radix portal 与 resizable 组测量，与其他图挂载隔离。
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeContextProvider } from '../../context/theme.provider';
import { mapPanelSlotIds } from '../../skin/layout';
import type { SkinDefinition } from '../../skin/types';
import { SkinnedDecisionGraph } from '../skinned-decision-graph';

vi.mock('@gorules/zen-engine-wasm', () => {
  class VariableType {}
  const init = Object.assign(() => Promise.resolve(), { isReady: () => false });
  return { default: init, isReady: init.isReady, VariableType };
});
vi.mock('monaco-editor', () => ({}));

afterEach(cleanup);

const graph = { nodes: [{ id: 'a', type: 'inputNode', position: { x: 0, y: 0 }, name: 'A' }], edges: [] };

const skinWithPanels: SkinDefinition = {
  id: 'ocean',
  label: 'Ocean',
  layout: {
    panels: {
      right: {
        slots: {
          'host:notes': ({ graph: g }) => <div>notes-panel:{(g.nodes ?? []).length} nodes</div>,
        },
        order: ['host:notes'],
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

describe('mapPanelSlotIds', () => {
  it('空槽位返回 undefined', () => {
    expect(mapPanelSlotIds(undefined)).toBeUndefined();
    expect(mapPanelSlotIds({ slots: {} })).toBeUndefined();
  });

  it('裸名补 host: 前缀，order 数组序优先', () => {
    const ids = mapPanelSlotIds({
      slots: { 'zeta': () => null, 'host:alpha': () => null },
      order: ['host:alpha'],
    });
    expect(ids).toEqual(['host:alpha', 'host:zeta']);
  });
});

describe('SkinnedDecisionGraph right panels', () => {
  it('无 right 槽位：无轨道 DOM（零注入）', async () => {
    const { container } = renderSkinned();
    await waitFor(() => expect(container.querySelector('.react-flow, .grl-dg')).toBeTruthy());
    expect(container.querySelector('[aria-label="skin-panel-rail"]')).toBeNull();
  });

  it('right 槽位：轨道按钮出现，点击打开 Sheet 渲染槽位内容（ctx 注入图）', async () => {
    const { container } = renderSkinned([skinWithPanels]);

    const rail = await waitFor(() => {
      const rail = container.querySelector('[aria-label="skin-panel-rail"]');
      if (!rail) throw new Error('rail not mounted yet');
      return rail;
    });
    const openButton = rail.querySelector('button[aria-label="Open host:notes"]');
    expect(openButton).toBeTruthy();

    fireEvent.click(openButton!);

    // Sheet 是 radix portal，内容挂在 body 下
    const notes = await waitFor(() => {
      const el = [...document.querySelectorAll('body div')].find((d) => d.textContent?.startsWith('notes-panel:'));
      if (!el) throw new Error('sheet content not mounted yet');
      return el;
    });
    expect(notes.textContent).toBe('notes-panel:1 nodes');
    expect(openButton!.getAttribute('aria-expanded')).toBe('true');
  });

  it('再次点击同一槽位关闭 Sheet', async () => {
    const { container } = renderSkinned([skinWithPanels]);
    const rail = await waitFor(() => {
      const rail = container.querySelector('[aria-label="skin-panel-rail"]');
      if (!rail) throw new Error('rail not mounted yet');
      return rail;
    });
    const button = rail.querySelector('button[aria-label="Open host:notes"]')!;
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute('aria-expanded')).toBe('true'));

    const closeButton = rail.querySelector('button[aria-label="Close host:notes"]')!;
    fireEvent.click(closeButton);
    await waitFor(() => expect(button.getAttribute('aria-expanded')).toBe('false'));
  });
});
