import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ExpressionEntry } from '../context/expression-store.context';
import { CustomFunction } from '../expression';

vi.mock('@monaco-editor/react', () => ({
  Editor: () => <div data-testid='monaco-stub' />,
}));

const entry = (id: string, key: string, value = '1'): ExpressionEntry => ({
  id,
  key,
  value,
  type: undefined,
});

const keyCellText = (index: number) =>
  document.querySelectorAll('.expression-list-item__key [contenteditable="true"]')[index]?.textContent ?? null;

describe('CustomFunction (component)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading row and the add-row affordance', async () => {
    render(<CustomFunction defaultValue={[entry('e1', 'weight', '$.weight')]} />);
    await vi.waitFor(() => expect(screen.getByText('Key')).toBeInTheDocument());
    expect(screen.getByText('Expression')).toBeInTheDocument();
    expect(screen.getByText('Add Row')).toBeInTheDocument();
  });

  it('renders provided rows with their keys', async () => {
    render(<CustomFunction defaultValue={[entry('e1', 'weight'), entry('e2', 'country')]} />);
    await vi.waitFor(() => expect(keyCellText(1)).toBe('country'));
    expect(keyCellText(0)).toBe('weight');
  });

  it('add-row dispatches a new entry through onChange', async () => {
    const onChange = vi.fn();
    render(<CustomFunction defaultValue={[entry('e1', 'weight')]} onChange={onChange} />);
    fireEvent.click(screen.getByText('Add Row'));
    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    const list = onChange.mock.calls.at(-1)?.[0] as ExpressionEntry[];
    expect(list).toHaveLength(2);
    expect(list.at(-1)?.key).toBe('');
  });

  it('legacy ;; values load without crashing and render the value editor', async () => {
    render(<CustomFunction defaultValue={[entry('e1', 'mode', 'a;;b')]} />);
    await vi.waitFor(() => expect(keyCellText(0)).toBe('mode'));
    // migrated array value renders through the value cell editor
    await vi.waitFor(() => {
      expect(document.querySelector('.expression-list-item__value')).not.toBeNull();
    });
  });

  it('view permission renders the row with its action cell', async () => {
    const { container } = render(<CustomFunction defaultValue={[entry('e1', 'weight')]} permission='view' />);
    await vi.waitFor(() => {
      expect(container.querySelectorAll('.expression-list-item').length).toBe(1);
    });
    expect(container.querySelector('.expression-list-item__action')).not.toBeNull();
  });

  it('exposes function and code tabs when custom functions are available', async () => {
    const customFunctions = [
      {
        name: 'now',
        description: 'current time',
        definitions: [],
        returns: { type: 'string' },
      },
    ];
    render(<CustomFunction defaultValue={[entry('e1', 'ts')]} customFunctions={customFunctions} />);
    await vi.waitFor(() => expect(screen.getByText('Function')).toBeInTheDocument());
    expect(screen.getByText('Code')).toBeInTheDocument();
  });

  it('renders only the code tab without custom functions', async () => {
    render(<CustomFunction defaultValue={[entry('e1', 'ts')]} />);
    await vi.waitFor(() => expect(screen.getByText('Code')).toBeInTheDocument());
    expect(screen.queryByText('Function')).toBeNull();
  });
});
