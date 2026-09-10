import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DecisionGraph } from '../decision-graph';
import type { ToolbarItem } from '../decision-graph/graph/toolbar-anchor';
import { clusterToolbarItems } from '../decision-graph/graph/toolbar-anchor';

vi.mock('../../helpers/wasm', () => ({
  ensureWasmLoaded: vi.fn(() => Promise.resolve()),
  isWasmAvailable: vi.fn(() => false),
  useWasmReady: vi.fn(() => true),
}));

vi.mock('@gorules/zen-engine-wasm', () => {
  class VariableType {}
  const init = Object.assign(() => Promise.resolve(), { isReady: () => false });
  return { default: init, isReady: init.isReady, VariableType };
});

const graph = {
  nodes: [{ id: 'in-1', type: 'inputNode', position: { x: 0, y: 0 }, name: 'Request' }],
  edges: [],
};

const item = (id: string, extra: Partial<ToolbarItem> = {}): ToolbarItem => ({
  id,
  render: () => (
    <button type='button' onClick={() => undefined}>
      {id}
    </button>
  ),
  ...extra,
});

const renderGraph = (toolbarItems?: ToolbarItem[]) =>
  render(<DecisionGraph value={graph as never} toolbarItems={toolbarItems} onChange={vi.fn()} />);

const anchor = (container: HTMLElement) => container.querySelector('[aria-label="toolbar-items"]');

describe('DecisionGraph toolbarItems', () => {
  it('零注入：锚点不落 DOM（零开销保证）', async () => {
    const { container } = renderGraph(undefined);
    await waitFor(() => expect(container.querySelector('.react-flow__node')).toBeInTheDocument());
    expect(anchor(container)).toBeNull();
  });

  it('注入项渲染在锚点内，点击触发回调', async () => {
    const onClick = vi.fn();
    const { container } = renderGraph([
      {
        id: 'host:publish',
        render: () => (
          <button type='button' onClick={onClick}>
            publish
          </button>
        ),
      },
    ]);
    await waitFor(() => expect(anchor(container)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'publish' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('group 变化处渲染分隔线（N 组 → N-1 条）', async () => {
    const { container } = renderGraph([item('a-export', { group: 'export' }), item('b-free'), item('c-free')]);
    await waitFor(() => expect(anchor(container)).toBeInTheDocument());

    // export 组 + 匿名独立组（缺省组共享一个桶）→ 1 条分隔线
    expect(anchor(container)?.querySelectorAll('span[aria-hidden]')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'a-export' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'b-free' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'c-free' })).toBeInTheDocument();
  });

  it('组内 order 排序 + 同 order 数组序稳定（缺省 order=0 排最前）', async () => {
    const { clusterToolbarItems: cluster } = await import('../decision-graph/graph/toolbar-anchor');
    const sorted = cluster([
      item('late', { group: 'g', order: 9 }),
      item('first', { group: 'g', order: 1 }),
      item('tie-a', { group: 'g' }),
      item('tie-b', { group: 'g' }),
    ]);
    expect(sorted.map((i) => i.id)).toEqual(['tie-a', 'tie-b', 'first', 'late']);
    expect(cluster).toBeDefined();
  });

  it('槽位抛错：该槽位降级不渲染，兄弟槽位与画布不受影响', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { container } = renderGraph([
        {
          id: 'host:boom',
          render: () => {
            throw new Error('slot boom');
          },
        },
        item('host:survivor'),
      ]);
      await waitFor(() => expect(anchor(container)).toBeInTheDocument());

      expect(screen.getByRole('button', { name: 'host:survivor' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'host:boom' })).not.toBeInTheDocument();
      expect(container.querySelector('.react-flow__node')).toBeInTheDocument();
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('host:boom'), expect.any(Error));
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('disabled 态透传给渲染回调', async () => {
    const seen: boolean[] = [];
    render(
      <DecisionGraph
        value={graph as never}
        disabled
        toolbarItems={[
          {
            id: 'probe',
            render: (ctx) => {
              seen.push(ctx.disabled);
              return null;
            },
          },
        ]}
        onChange={vi.fn()}
      />,
    );
    expect(seen).toContain(true);
  });

  it('clusterToolbarItems 纯函数：组间按首次出现序', () => {
    const sorted = clusterToolbarItems([item('x', { group: 'b' }), item('y'), item('z', { group: 'a' })]);
    expect(sorted.map((i) => i.id)).toEqual(['x', 'y', 'z']);
  });
});
