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

const keyByFixtureId = (id: string) => document.querySelector(`[data-testid="cf-key-${id}"]`)?.textContent ?? null;

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
    await vi.waitFor(() => expect(keyByFixtureId('e2')).toBe('country'));
    expect(keyByFixtureId('e1')).toBe('weight');
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
    await vi.waitFor(() => expect(keyByFixtureId('e1')).toBe('mode'));
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

  it('editing the key dispatches onChange with the updated key', async () => {
    const onChange = vi.fn();
    render(<CustomFunction defaultValue={[entry('e1', 'weight')]} onChange={onChange} />);
    await vi.waitFor(() => expect(keyByFixtureId('e1')).toBe('weight'));

    // 键单元格是 contentEditable 的 AutosizeTextArea：写入文本后触发 input
    const keyCell = document.querySelector('[data-testid="cf-key-e1"]') as HTMLElement;
    keyCell.textContent = 'edited';
    fireEvent.input(keyCell);

    await vi.waitFor(() => {
      const list = onChange.mock.calls.at(-1)?.[0] as ExpressionEntry[];
      expect(list[0]?.key).toBe('edited');
    });
  });

  it('double-click confirm removes the row and reports the shorter list', async () => {
    const onChange = vi.fn();
    const { container } = render(<CustomFunction defaultValue={[entry('e1', 'weight')]} onChange={onChange} />);
    await vi.waitFor(() => expect(container.querySelector('.expression-list-item')).not.toBeNull());

    const actionButton = container.querySelector('.expression-list-item__action button') as HTMLButtonElement;
    expect(actionButton).not.toBeNull();
    fireEvent.click(actionButton); // arm confirmation
    fireEvent.click(actionButton); // confirm

    await vi.waitFor(() => {
      const list = onChange.mock.calls.at(-1)?.[0] as ExpressionEntry[];
      expect(list).toHaveLength(0);
    });
  });

  it('disabled locks the key editor and the remove affordance', async () => {
    const { container } = render(<CustomFunction defaultValue={[entry('e1', 'weight')]} disabled />);
    await vi.waitFor(() => expect(keyByFixtureId('e1')).toBe('weight'));

    const keyCell = document.querySelector('[data-testid="cf-key-e1"]') as HTMLElement;
    expect(keyCell.getAttribute('contenteditable')).toBe('false');
    expect((container.querySelector('.expression-list-item__action button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('Add Row')).toBeNull(); // 写路径整体锁定
  });

  it("permission 'edit:values' reads back as view-only rows", async () => {
    const { container } = render(<CustomFunction defaultValue={[entry('e1', 'weight')]} permission='edit:values' />);
    await vi.waitFor(() => expect(keyByFixtureId('e1')).toBe('weight'));

    const keyCell = document.querySelector('[data-testid="cf-key-e1"]') as HTMLElement;
    expect(keyCell.getAttribute('contenteditable')).toBe('false');
    expect((container.querySelector('.expression-list-item__action button') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText('Add Row')).toBeNull();
  });

  it('add-row affordance appears only for edit:full permission', async () => {
    render(<CustomFunction defaultValue={[entry('e1', 'weight')]} permission='edit:full' />);
    await vi.waitFor(() => expect(keyByFixtureId('e1')).toBe('weight'));
    expect(screen.getByText('Add Row')).toBeInTheDocument();
  });
});
