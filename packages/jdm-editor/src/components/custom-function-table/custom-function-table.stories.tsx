import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';

import type { ExpressionEntry } from './context/expression-store.context';
import { CustomFunction } from './expression';

const meta: Meta<typeof CustomFunction> = {
  title: 'Custom Function Table',
  component: CustomFunction,
  // The prop types pull in wasm/zod structures that crash argTypes inference,
  // and the component manages its own store — controls have nothing to drive.
  parameters: {
    controls: { disable: true },
    docs: { disable: true },
  },
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

export const Empty: Story = {
  render: () => (
    <div style={{ height: 480, padding: 12 }}>
      <CustomFunction />
    </div>
  ),
};

export const WithRows: Story = {
  render: () => (
    <div style={{ height: 480, padding: 12 }}>
      <CustomFunction defaultValue={SAMPLE_EXPRESSIONS} />
    </div>
  ),
};

export const Disabled: Story = {
  render: () => (
    <div style={{ height: 480, padding: 12 }}>
      <CustomFunction defaultValue={SAMPLE_EXPRESSIONS} disabled />
    </div>
  ),
};
