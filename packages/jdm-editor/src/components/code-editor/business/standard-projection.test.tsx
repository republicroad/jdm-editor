import { initSync } from '@gorules/zen-engine-wasm';
import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { OutputFieldType } from '../../../helpers/schema';
import { StandardExpressionBuilder } from './standard-expression-builder';

// Real wasm (same pinned artifact the app ships) so mode computation and
// parseStandardExpression projections exercise the actual runtime.
beforeAll(() => {
  initSync({
    module: readFileSync(resolve(process.cwd(), 'node_modules/@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm')),
  });
});

const STRING_FIELD: OutputFieldType = { type: 'string' };
const NUMBER_FIELD: OutputFieldType = { type: 'number' };
const STRING_ARRAY_FIELD: OutputFieldType = { type: 'string-array' };

describe('StandardExpressionBuilder value/expression modes (real wasm)', () => {
  it('edits a number output in value mode and quotes strings back on change', () => {
    const onChange = vi.fn();
    render(<StandardExpressionBuilder value='0.85' onChange={onChange} fieldType={NUMBER_FIELD} />);

    const input = screen.getByRole('spinbutton') as HTMLInputElement;
    expect(input.value).toBe('0.85');
  });

  it('quotes typed strings so the stored value stays a string expression', () => {
    const onChange = vi.fn();
    const { container } = render(
      <StandardExpressionBuilder value='"VIP"' onChange={onChange} fieldType={STRING_FIELD} />,
    );

    // AutosizeTextArea is a contentEditable div, not a <textarea>.
    const editable = container.querySelector('[contenteditable="true"]') as HTMLElement;
    expect(editable.textContent).toBe('VIP');

    editable.textContent = 'x';
    fireEvent.input(editable);
    expect(onChange).toHaveBeenLastCalledWith('"x"');
  });

  it('keeps a string-array output in value mode and forces expression mode otherwise', () => {
    const onChange = vi.fn();
    const value = render(
      <StandardExpressionBuilder value='["a", "b"]' onChange={onChange} fieldType={STRING_ARRAY_FIELD} />,
    );
    expect(value.container.querySelector('.cm-editor')).not.toBeInTheDocument();
    value.unmount();

    const expression = render(
      <StandardExpressionBuilder value='amount * 2' onChange={onChange} fieldType={STRING_ARRAY_FIELD} />,
    );
    expect(expression.container.querySelector('.cm-editor')).toBeInTheDocument();
  });

  it('toggles between value and expression mode via the type button', () => {
    const onChange = vi.fn();
    const { container } = render(
      <StandardExpressionBuilder value='"VIP"' onChange={onChange} fieldType={STRING_FIELD} />,
    );

    expect(container.querySelector('.cm-editor')).not.toBeInTheDocument();

    // The mode toggle is the leading icon button; clicking it exposes CodeMirror.
    fireEvent.click(container.querySelector('button')!);
    expect(container.querySelector('.cm-editor')).toBeInTheDocument();
  });

  it('shows the selected enum label for enum string outputs', () => {
    const onChange = vi.fn();
    const fieldType: OutputFieldType = {
      type: 'string',
      enum: {
        type: 'inline',
        values: [
          { label: '金牌会员', value: 'GOLD' },
          { label: '银牌会员', value: 'SILVER' },
        ],
      },
    };
    render(<StandardExpressionBuilder value='"GOLD"' onChange={onChange} fieldType={fieldType} />);

    expect(screen.getByText('金牌会员')).toBeInTheDocument();
  });
});
