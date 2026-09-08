import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DecisionGraph } from '../decision-graph';
import { createJdmNode } from '../decision-graph/nodes/custom-node';

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

const debugSpec = {
  ...createJdmNode({ kind: 'test-debug', displayName: 'Debug' }),
  renderTab: () => <div>custom-tab-marker</div>,
};

const graph = {
  nodes: [
    {
      id: 'n1',
      type: 'customNode',
      name: 'Debug',
      position: { x: 0, y: 0 },
      content: { kind: 'test-debug', config: {} },
    },
  ],
  edges: [],
};

describe('custom node renderTab', () => {
  it('renders the node renderTab content when its tab opens', async () => {
    const { container } = render(
      <DecisionGraph value={graph as never} customNodes={[debugSpec as never]} onChange={vi.fn()} />,
    );

    // canvas node renders through the custom spec (default renderNode)
    await waitFor(() => expect(container.querySelector('.react-flow__node')).toBeInTheDocument());
    expect(screen.getByText('Edit Expression')).toBeInTheDocument();

    // the node's edit-expression button is the tab entry: click it to open
    // the tab, which should render renderTab content
    fireEvent.click(screen.getByText('Edit Expression'));

    await waitFor(() => {
      expect(screen.getByText('custom-tab-marker')).toBeInTheDocument();
    });
  });
});
