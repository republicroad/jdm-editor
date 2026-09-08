import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DecisionGraph } from '../decision-graph';

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

const baseNode = (id: string, name: string) => ({
  id,
  type: 'inputNode',
  name,
  position: { x: 0, y: 0 },
});

const current = {
  nodes: [baseNode('in', 'Request'), baseNode('out', 'Response'), baseNode('new-1', 'Added')],
  edges: [],
};

const baseline = {
  nodes: [baseNode('in', 'Request'), baseNode('out', 'Response'), baseNode('gone', 'Removed')],
  edges: [],
};

describe('DecisionGraph diffBaseline (P2 canvas diff mode)', () => {
  it('renders diff markers for added/removed nodes against the baseline', async () => {
    const { container } = render(
      <DecisionGraph value={current as never} diffBaseline={baseline as never} disabled onChange={vi.fn()} />,
    );

    // 新增节点带 added 标记，基线中被删除的节点以 removed 灰显渲染
    await waitForDiff(container);
    const diffs = [...container.querySelectorAll('[data-diff]')].map((el) => el.getAttribute('data-diff'));
    expect(diffs).toContain('added');
    expect(diffs).toContain('removed');
    expect(container.textContent).toContain('Added');
    expect(container.textContent).toContain('Removed');
  });

  it('does not annotate anything without diffBaseline', async () => {
    const { container } = render(<DecisionGraph value={current as never} disabled onChange={vi.fn()} />);

    await waitForDiff(container);
    expect(container.querySelector('[data-diff]')).toBeNull();
  });
});

function waitForDiff(container: HTMLElement) {
  // xyflow 挂载后节点经 store 同步出现
  return new Promise<void>((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (container.querySelector('.react-flow__node') || Date.now() - started > 3000) {
        resolve();
        return;
      }
      setTimeout(tick, 50);
    };
    tick();
  });
}
