import type { Meta, StoryObj } from '@storybook/react-vite';
import json5 from 'json5';
import React, { useState } from 'react';

import { Typography } from '../../primitives';
import { DecisionGraph } from '../dg';
import type { DecisionGraphType } from '../dg-types';
import { SimulatorRequestPanel } from './simulator-request-panel';

const meta: Meta<typeof SimulatorRequestPanel> = {
  title: 'Decision Graph/Simulator Request Panel',
  component: SimulatorRequestPanel,
};

export default meta;

type Story = StoryObj<typeof SimulatorRequestPanel>;

const buildGraph = (withInput: boolean): DecisionGraphType => ({
  nodes: [
    ...(withInput
      ? [
          {
            id: 'input-1',
            type: 'inputNode' as const,
            position: { x: 70, y: 250 },
            name: 'Request',
            content: {
              schema: JSON.stringify({
                'type': 'object',
                'properties': { customer: { type: 'object' }, cart: { type: 'object' } },
                'examples': [
                  { customer: { country: 'US' }, cart: { weight: 50 } },
                  { customer: { country: 'DE' }, cart: { weight: 120 } },
                ],
                'x-examples-meta': [{ name: 'US Light' }, { name: 'DE Heavy' }],
              }),
              expressions: [],
              inputField: null,
              outputPath: null,
            },
          },
        ]
      : []),
    {
      id: 'dt-1',
      type: 'decisionTableNode',
      position: { x: 370, y: 250 },
      name: 'Shipping Fees',
      content: {
        hitPolicy: 'first',
        inputs: [
          { id: 'i1', field: 'cart.weight', name: 'Cart Weight (Kg)', fieldType: { type: 'number' } },
          { id: 'i2', field: 'customer.country', name: 'Customer Country', fieldType: { type: 'string' } },
        ],
        outputs: [{ id: 'o1', field: 'shippingFee', name: 'Shipping Fee', outputFieldType: { type: 'number' } }],
        rules: [],
      },
    },
    { id: 'output-1', type: 'outputNode', position: { x: 670, y: 250 }, name: 'Response' },
  ],
  edges: [
    ...(withInput ? [{ id: 'e1', type: 'edge' as const, sourceId: 'input-1', targetId: 'dt-1' }] : []),
    { id: 'e2', type: 'edge', sourceId: 'dt-1', targetId: 'output-1' },
  ],
});

const DEFAULT_REQUEST = json5.stringify(
  {
    customer: { country: 'US' },
    cart: { weight: 50 },
  },
  null,
  2,
);

const RequestPanelStory: React.FC<{ withInput: boolean }> = ({ withInput }) => {
  const [value, setValue] = useState<DecisionGraphType>(() => buildGraph(withInput));
  const [lastPayload, setLastPayload] = useState<string>('');

  return (
    <div style={{ height: '100%', display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <DecisionGraph
          value={value}
          onChange={(val) => setValue(val)}
          defaultActivePanel='simulator'
          panels={[
            {
              id: 'simulator',
              title: 'Simulator',
              icon: null,
              hideHeader: true,
              renderPanel: () => (
                <SimulatorRequestPanel
                  defaultRequest={DEFAULT_REQUEST}
                  onChange={() => {
                    /* 持久化由宿主应用负责 */
                  }}
                  onRun={({ graph, context }) => {
                    setLastPayload(JSON.stringify({ graph, context }, null, 2));
                  }}
                />
              ),
            },
          ]}
        />
      </div>
      <div
        style={{
          width: 320,
          borderLeft: '1px solid #ddd',
          padding: 8,
          overflow: 'auto',
          fontSize: 11,
          fontFamily: 'var(--mono-font-family, monospace)',
        }}
      >
        <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
          Last run payload
        </Typography.Text>
        <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {lastPayload || '// click Run in the simulator'}
        </pre>
      </div>
    </div>
  );
};

export const WithInputBinding: Story = {
  render: () => <RequestPanelStory withInput />,
};

export const WithoutInputNode: Story = {
  render: () => <RequestPanelStory withInput={false} />,
};
