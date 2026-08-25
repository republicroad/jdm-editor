import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InputNumber, Select } from '../primitives';

// Radix Select relies on PointerEvent APIs jsdom does not implement.
beforeEach(() => {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.releasePointerCapture = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
});

const openDropdown = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(document.querySelector('[data-slot="select-trigger"]')!);
};

const pickOption = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click([...document.querySelectorAll('[role="option"]')].find((o) => o.textContent === label)!);
};

describe('Select shim value semantics (antd contract)', () => {
  it('emits the raw boolean option value, not the Radix string', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select
        value
        onChange={onChange}
        options={[
          { value: true, label: 'true' },
          { value: false, label: 'false' },
        ]}
      />,
    );

    await openDropdown(user);
    await pickOption(user, 'false');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(false, expect.objectContaining({ value: false }));
    expect(typeof onChange.mock.calls[0][0]).toBe('boolean');
  });

  it('emits the raw number option value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select
        value={10}
        onChange={onChange}
        options={[
          { value: 10, label: 'ten' },
          { value: 20, label: 'twenty' },
        ]}
      />,
    );

    await openDropdown(user);
    await pickOption(user, 'twenty');

    expect(onChange).toHaveBeenCalledWith(20, expect.objectContaining({ value: 20 }));
    expect(typeof onChange.mock.calls[0][0]).toBe('number');
  });

  it('passes string option values through unchanged', async () => {
    const onSelect = vi.fn();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select
        value='Pending'
        onChange={onChange}
        onSelect={onSelect as never}
        options={[
          { value: 'Pending', label: 'Pending' },
          { value: 'Shipped', label: 'Shipped' },
        ]}
      />,
    );

    await openDropdown(user);
    await pickOption(user, 'Shipped');

    expect(onChange).toHaveBeenCalledWith('Shipped', expect.objectContaining({ value: 'Shipped' }));
    expect(onSelect).toHaveBeenCalledWith('Shipped', expect.objectContaining({ value: 'Shipped' }));
  });

  it('clear button emits undefined per antd semantics, not empty string', async () => {
    const onClear = vi.fn();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Select
        allowClear
        value='x'
        onClear={onClear}
        onChange={onChange}
        options={[{ value: 'x', label: 'x' }]}
      />,
    );

    await user.click(document.querySelector('button[aria-label="Clear"]')!);

    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(undefined, undefined);
  });
});

describe('Select multi/tags shim', () => {
  it('splits comma-separated text into a string array', () => {
    const onChange = vi.fn();
    render(<Select mode='tags' value={['a']} onChange={onChange} />);

    fireEvent.change(document.querySelector('input')!, { target: { value: 'alpha, beta' } });

    expect(onChange).toHaveBeenLastCalledWith(['alpha', 'beta']);
  });
});

describe('InputNumber shim', () => {
  it('coerces typed text to number and empty to null', () => {
    const onChange = vi.fn();
    render(<InputNumber value={1} onChange={onChange} />);

    const input = document.querySelector('input')!;
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);

    fireEvent.change(input, { target: { value: '42' } });
    expect(onChange).toHaveBeenLastCalledWith(42);
  });
});
