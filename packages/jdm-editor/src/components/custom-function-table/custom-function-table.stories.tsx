import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useState } from 'react';

import type { ExpressionEntry } from './context/expression-store.context';
import { CustomFunction } from './expression';

const meta: Meta<typeof CustomFunction> = {
  title: 'Custom Function Table',
  component: CustomFunction,
};

export default meta;

type Story = StoryObj<typeof CustomFunction>;

const entry = (id: string, key: string, value: string): ExpressionEntry => ({
  id,
  key,
  value,
  type: undefined,
});

const SAMPLE_EXPRESSIONS: ExpressionEntry[] = [
  entry('e1', 'cart.weight', '$.cart.weight'),
  entry('e2', 'shippingFee', '$.shippingFee ?? 0'),
  entry('e3', 'discount', '$.customer.country === "US" ? 0.1 : 0'),
];

const FunctionTableStory: React.FC<{ initial?: ExpressionEntry[]; disabled?: boolean }> = ({ initial, disabled }) => {
  const [value, setValue] = useState<ExpressionEntry[]>(() => initial ?? []);

  return (
    <div style={{ height: 480, padding: 12 }}>
      <CustomFunction value={value} onChange={setValue} disabled={disabled} />
    </div>
  );
};

export const Empty: Story = {
  render: () => <FunctionTableStory />,
};

export const WithRows: Story = {
  render: () => <FunctionTableStory initial={SAMPLE_EXPRESSIONS} />,
};

export const Disabled: Story = {
  render: () => <FunctionTableStory initial={SAMPLE_EXPRESSIONS} disabled />,
};
