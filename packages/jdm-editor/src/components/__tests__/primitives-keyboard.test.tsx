import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { Input, Modal, Popconfirm, Select, Tabs } from '../primitives';

// jsdom lacks the pointer-capture APIs Radix Select relies on when opening.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
});

/**
 * Keyboard/a11y alignment audit for the antd→shadcn shims (roadmap follow-up).
 * Radix gives most of this for free; these tests LOCK it so future shim
 * refactors cannot silently regress keyboard parity with antd semantics.
 *
 * DatePicker is intentionally not covered here (dayjs panel navigation is
 * complex and covered by manual QA); add focused tests when it changes.
 */

describe('Tabs keyboard navigation', () => {
  const mount = () =>
    render(
      <Tabs
        items={[
          { key: 'a', label: 'Alpha' },
          { key: 'b', label: 'Beta' },
          { key: 'c', label: 'Gamma' },
        ]}
      />,
    );

  it('ArrowRight moves selection to the next tab', async () => {
    const user = userEvent.setup();
    mount();
    const first = screen.getByRole('tab', { name: 'Alpha' });
    first.focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
  });

  it('ArrowLeft wraps selection backwards', async () => {
    const user = userEvent.setup();
    mount();
    const first = screen.getByRole('tab', { name: 'Alpha' });
    first.focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'Gamma' })).toHaveAttribute('aria-selected', 'true');
  });

  it('click still selects (mouse parity)', async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Select keyboard flow', () => {
  const mount = (onChange = vi.fn()) => {
    render(
      <Select
        placeholder='pick one'
        options={[
          { label: 'Pending', value: 'pending' },
          { label: 'Done', value: 'done' },
        ]}
        onChange={onChange}
      />,
    );
    return onChange;
  };

  it('ArrowDown opens the listbox from the trigger', async () => {
    const user = userEvent.setup();
    mount();
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Done' })).toBeInTheDocument();
  });

  it('ArrowDown + Enter selects the focused option (string passthrough is shim-corrected)', async () => {
    const user = userEvent.setup();
    const onChange = mount();
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    await user.keyboard('{ArrowDown}');
    await user.keyboard('{Enter}');
    // first ArrowDown lands on the first option ("pending"), second moves to "done"
    expect(onChange).toHaveBeenCalledWith('done', expect.anything());
  });

  it('Escape closes without selecting', async () => {
    const user = userEvent.setup();
    const onChange = mount();
    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Modal keyboard flow', () => {
  it('Escape fires onCancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <Modal open title='Confirm' onCancel={onCancel}>
        body
      </Modal>,
    );
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('Popconfirm keyboard flow', () => {
  it('opens on click, Escape dismisses without confirming', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Popconfirm title='Sure?' okText='OK' onConfirm={onConfirm}>
        <button type='button'>delete</button>
      </Popconfirm>,
    );
    await user.click(screen.getByRole('button', { name: 'delete' }));
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('confirm button invokes onConfirm', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Popconfirm title='Sure?' okText='OK' onConfirm={onConfirm}>
        <button type='button'>delete</button>
      </Popconfirm>,
    );
    await user.click(screen.getByRole('button', { name: 'delete' }));
    await user.click(await screen.findByRole('button', { name: 'OK' }));
    expect(onConfirm).toHaveBeenCalled();
  });
});

describe('Input allowClear reachability', () => {
  it('clear control is a real button and emits the antd-style empty-target change', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Input allowClear value='abc' onChange={onChange} />);

    const clear = screen.getByRole('button', { name: /clear/i });
    clear.focus();
    expect(clear).toHaveFocus();
    await user.click(clear);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('');
  });
});
