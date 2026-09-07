import { initSync } from '@gorules/zen-engine-wasm';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { ColumnFieldType } from '../../../../helpers/schema';
import { getOp } from './constants';
import { ExpressionBuilder } from './index';

// Real wasm (same pinned artifact the app ships) so projections exercise the
// actual parse/serialize path, not mocks.
beforeAll(() => {
  initSync({
    module: readFileSync(resolve(process.cwd(), 'node_modules/@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm')),
  });
});

const NUMBER_FIELD: ColumnFieldType = { type: 'number' };
const DATE_FIELD: ColumnFieldType = { type: 'date' };
const ENUM_FIELD: ColumnFieldType = {
  type: 'string',
  enum: {
    type: 'inline',
    values: [
      { label: '金牌会员', value: 'GOLD' },
      { label: '银牌会员', value: 'SILVER' },
    ],
  },
};

describe('ExpressionBuilder business-view projections (real wasm)', () => {
  it('projects an interval condition and toggles bracket inclusivity', () => {
    const onChange = vi.fn();
    render(<ExpressionBuilder value='[200000..1000000]' onChange={onChange} fieldType={NUMBER_FIELD} />);

    expect(screen.getByText('..')).toBeInTheDocument();
    fireEvent.click(screen.getByText('['));
    expect(onChange).toHaveBeenLastCalledWith('(200000..1000000]');

    fireEvent.click(screen.getByText(']'));
    expect(onChange).toHaveBeenLastCalledWith('[200000..1000000)');
  });

  it('projects weekday chips and writes them back sorted', () => {
    const onChange = vi.fn();
    render(<ExpressionBuilder value='d($).weekday() in [1, 5]' onChange={onChange} fieldType={DATE_FIELD} />);

    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) {
      expect(screen.getByText(day)).toBeInTheDocument();
    }

    // Selecting Sunday appends sorted after Friday; deselecting Monday leaves [5].
    fireEvent.click(screen.getByText('Sun'));
    expect(onChange).toHaveBeenLastCalledWith('d($).weekday() in [1, 5, 7]');

    fireEvent.click(screen.getByText('Mon'));
    expect(onChange).toHaveBeenLastCalledWith('d($).weekday() in [5]');
  });

  it('renders enum labels instead of raw values for enum string fields', () => {
    const onChange = vi.fn();
    render(<ExpressionBuilder value='"GOLD"' onChange={onChange} fieldType={ENUM_FIELD} />);

    expect(screen.getByText('金牌会员')).toBeInTheDocument();
    expect(screen.queryByText('"GOLD"')).not.toBeInTheDocument();
  });

  it('renders no-value operators as a plain label without inputs', () => {
    const onChange = vi.fn();
    render(<ExpressionBuilder value='!= null' onChange={onChange} fieldType={NUMBER_FIELD} />);

    expect(screen.getByText(getOp('notNull').label)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('forces the custom (CodeMirror) view for unstructurable expressions', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ExpressionBuilder value='customer.tier == "GOLD" && amount > 100' onChange={onChange} />,
    );

    expect(container.querySelector('.cm-editor')).toBeInTheDocument();
  });
});
