// @vitest-environment jsdom
// DecisionGraph 内部走源码直通（workspace main → src），kernel 的 wasm 加载器
// 经 helpers/wasm 依赖被 mock 的 @gorules/zen-engine-wasm，无需再 mock。
import { DecisionGraph } from '@republicroad/jdm-editor';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ThemeContextProvider } from '../../context/theme.provider';
import { mapToolbarSlots } from '../../skin/layout';
import type { SkinDefinition, SkinSlotHostContext, SkinToolbarLayout } from '../../skin/types';
import { SkinnedDecisionGraph } from '../skinned-decision-graph';

vi.mock('@gorules/zen-engine-wasm', () => {
  class VariableType {}
  const init = Object.assign(() => Promise.resolve(), { isReady: () => false });
  return { default: init, isReady: init.isReady, VariableType };
});

// kernel 经 workspace 链接解析到 dist 产物，monaco 是 kernel 的 peerDep、
// appshell 测试环境未安装——桩掉即可（本测试不触达 monaco 代码路径）。
vi.mock('monaco-editor', () => ({}));

afterEach(cleanup);

const graph = { nodes: [], edges: [] };

const oceanSkin: SkinDefinition = {
  id: 'ocean',
  label: 'Ocean',
  seeds: { primary: '#0ea5e9' },
  layout: {
    toolbar: {
      slots: {
        'publish': () => <button type='button'>publish-action</button>,
        'host:snapshot': () => <button type='button'>snapshot-action</button>,
      },
      order: ['host:snapshot', 'publish'],
    },
  },
};

const renderSkinned = (skins?: SkinDefinition[], skinId?: string) =>
  render(
    <ThemeContextProvider options={skins ? { skins, defaultSkinId: skinId } : undefined}>
      <SkinnedDecisionGraph value={graph as never} onChange={vi.fn()} />
    </ThemeContextProvider>,
  );

describe('mapToolbarSlots', () => {
  const host: SkinSlotHostContext = { graph: graph as never, disabled: false, graphRef: null };

  it('无槽位返回 undefined（零注入透传）', () => {
    expect(mapToolbarSlots(undefined, host)).toBeUndefined();
    expect(mapToolbarSlots({}, host)).toBeUndefined();
    expect(mapToolbarSlots({ slots: {} }, host)).toBeUndefined();
  });

  it('裸名 id 自动补 host: 前缀', () => {
    const items = mapToolbarSlots({ slots: { publish: () => null } }, host)!;
    expect(items.map((i) => i.id)).toEqual(['host:publish']);
  });

  it('order 数组序优先，未列出者按字典序排后', () => {
    const layout: SkinToolbarLayout = {
      slots: { 'zeta': () => null, 'alpha': () => null, 'host:snapshot': () => null },
      order: ['host:snapshot'],
    };
    const items = mapToolbarSlots(layout, host)!;
    expect(items.map((i) => i.id)).toEqual(['host:snapshot', 'host:alpha', 'host:zeta']);
  });

  it('render 闭包注入 host 上下文并透传 kernel disabled', () => {
    const seen: Array<{ disabled: boolean; graph: unknown }> = [];
    const items = mapToolbarSlots(
      { slots: { probe: (ctx) => (seen.push({ disabled: ctx.disabled, graph: ctx.graph }), null) } },
      { ...host, graph: { nodes: [{ id: 'n1' }], edges: [] } as never },
    )!;
    items[0].render({ disabled: true });
    expect(seen[0]).toEqual({ disabled: true, graph: { nodes: [{ id: 'n1' }], edges: [] } });
  });
});

describe('SkinnedDecisionGraph', () => {
  it('无皮肤：行为等价直渲染 DecisionGraph（无注入锚点）', async () => {
    const { container } = renderSkinned();
    await waitFor(() => expect(container.querySelector('.grl-graph, .react-flow')).toBeTruthy());
    expect(container.querySelector('[aria-label="toolbar-items"]')).toBeNull();
  });

  it('皮肤槽位注入页签条工具栏，order 生效', async () => {
    const { container } = renderSkinned([oceanSkin], 'ocean');
    await waitFor(() => expect(container.querySelector('[aria-label="toolbar-items"]')).toBeInTheDocument());

    const buttons = [...container.querySelectorAll('[aria-label="toolbar-items"] button')].map((b) => b.textContent);
    expect(buttons).toEqual(['snapshot-action', 'publish-action']);
  });

  it('皮肤槽位可经 ctx.graphRef / graph 工作（点击读取图文档）', async () => {
    const onSnapshot = vi.fn();
    const skin: SkinDefinition = {
      id: 'ocean',
      label: 'Ocean',
      layout: {
        toolbar: {
          slots: {
            'host:snapshot': ({ graph: g }) => (
              <button type='button' onClick={() => onSnapshot(g.nodes.length)}>
                snapshot
              </button>
            ),
          },
        },
      },
    };
    render(
      <ThemeContextProvider options={{ skins: [skin], defaultSkinId: 'ocean' }}>
        <SkinnedDecisionGraph
          value={{ nodes: [{ id: 'a', type: 'inputNode', position: { x: 0, y: 0 }, name: 'A' }], edges: [] } as never}
          onChange={vi.fn()}
        />
      </ThemeContextProvider>,
    );
    const button = await screen.findByRole('button', { name: 'snapshot' });
    fireEvent.click(button);
    expect(onSnapshot).toHaveBeenCalledWith(1);
  });

  it('宿主自有 toolbarItems 在皮肤槽位之前', async () => {
    const own = [{ id: 'host:own', render: () => <button type='button'>own-item</button> }];
    render(
      <ThemeContextProvider options={{ skins: [oceanSkin], defaultSkinId: 'ocean' }}>
        <DecisionGraph value={graph as never} onChange={vi.fn()} toolbarItems={own} />
      </ThemeContextProvider>,
    );
    await screen.findByRole('button', { name: 'own-item' });
  });
});
