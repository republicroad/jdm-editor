import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DecisionGraph } from '../decision-graph';
import { DecisionTable } from '../decision-table';

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

describe('component smoke rendering', () => {
  it('mounts an empty decision graph with reactflow canvas', async () => {
    const onChange = vi.fn();
    const { container } = render(<DecisionGraph value={{ nodes: [], edges: [] }} onChange={onChange} />);

    expect(container.querySelector('.grl-dg')).toBeInTheDocument();

    await waitFor(() => {
      expect(container.querySelector('.react-flow')).toBeInTheDocument();
    });
  });

  it('mounts a decision table with an empty grid', () => {
    const onChange = vi.fn();
    const { container } = render(<DecisionTable tableHeight={400} value={undefined} onChange={onChange} />);

    expect(container.querySelector('table')).toBeInTheDocument();
    expect(screen.getByText('Add row')).toBeInTheDocument();
  });
});
