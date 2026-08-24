import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import type { Simulation } from './simulation.types';
import { SimulatorNodesPanel } from './simulator-nodes-panel';

const meta: Meta<typeof SimulatorNodesPanel> = {
  title: 'Decision Graph/Simulator Nodes Panel',
  component: SimulatorNodesPanel,
};

export default meta;

type Story = StoryObj<typeof SimulatorNodesPanel>;

const trace = (
  nodeId: string,
  name: string,
  order: number,
  performance = '0.4ms',
): Simulation['result']['trace'][string] => ({
  id: nodeId,
  name,
  order,
  performance,
  input: null,
  output: null,
  traceData: null,
});

const SUCCESS_SIMULATION: Simulation = {
  result: {
    performance: '2.1ms',
    result: { shippingFee: 10 },
    snapshot: { nodes: [], edges: [] },
    trace: {
      'input-1': trace('input-1', 'Request', 0),
      'dt-1': trace('dt-1', 'Shipping Fees', 1, '1.2ms'),
      'fn-1': trace('fn-1', 'Notify Webhook', 2),
      'output-1': trace('output-1', 'Response', 3),
    },
  },
};

const ERROR_SIMULATION: Simulation = {
  error: {
    title: 'Execution failed',
    message: 'Node "Notify Webhook" failed',
    data: { nodeId: 'fn-1' },
  },
};

const NodesPanelStory: React.FC<{ simulate?: Simulation; loading?: boolean }> = ({ simulate, loading }) => {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState('');

  return (
    <div style={{ width: 320, height: 480, display: 'flex', flexDirection: 'column' }}>
      <SimulatorNodesPanel
        search={search}
        onSearchChange={setSearch}
        loading={loading}
        simulate={simulate}
        nodeTypes={{ 'input-1': 'inputNode' }}
        selectedNode={selected}
        onSelectNode={setSelected}
        onGoToNode={() => {}}
        onClear={() => setSearch('')}
      />
    </div>
  );
};

export const EmptyState: Story = {
  render: () => <NodesPanelStory />,
};

export const WithSuccessfulTrace: Story = {
  render: () => <NodesPanelStory simulate={SUCCESS_SIMULATION} />,
};

export const WithErrorTrace: Story = {
  render: () => <NodesPanelStory simulate={ERROR_SIMULATION} />,
};

export const Loading: Story = {
  render: () => <NodesPanelStory loading simulate={SUCCESS_SIMULATION} />,
};
