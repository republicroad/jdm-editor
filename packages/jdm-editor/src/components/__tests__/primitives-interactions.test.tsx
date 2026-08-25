import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { focusBuilderRoot } from '../code-editor/business/focus-helper';
import { App, DatePicker, Input, TimePicker } from '../primitives';
import type { AntdConfirmOptions } from '../primitives/app';

describe('App.confirm imperative flow', () => {
  const ConfirmProbe: React.FC<{ options: AntdConfirmOptions }> = ({ options }) => {
    const { modal } = App.useApp();
    return (
      <button type='button' onClick={() => modal.confirm(options)}>
        open
      </button>
    );
  };

  const mount = (options: AntdConfirmOptions) => {
    const user = userEvent.setup();
    render(
      <App>
        <ConfirmProbe options={options} />
      </App>,
    );
    return user;
  };

  it('ok button invokes onOk and closes the dialog', async () => {
    const onOk = vi.fn();
    const user = mount({ title: 'Delete?', content: 'Are you sure', onOk });

    await user.click(screen.getByText('open'));
    expect(screen.getByText('Are you sure')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(onOk).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Are you sure')).not.toBeInTheDocument();
  });

  it('cancel button invokes onCancel and closes the dialog', async () => {
    const onCancel = vi.fn();
    const user = mount({ title: 'Leave?', onCancel });

    await user.click(screen.getByText('open'));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Leave?')).not.toBeInTheDocument();
  });

  it('danger okButtonProps marks the confirm action destructive', async () => {
    const user = mount({ title: 'Danger', okButtonProps: { danger: true } });

    await user.click(screen.getByText('open'));
    expect(screen.getByRole('button', { name: 'OK' }).className).toContain('destructive');
  });
});

describe('DatePicker shim', () => {
  it('emits a valid Dayjs for a picked date', () => {
    const onChange = vi.fn();
    render(<DatePicker value={null} onChange={onChange} />);

    fireEvent.change(document.querySelector('input')!, { target: { value: '2024-05-06' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].format('YYYY-MM-DD')).toBe('2024-05-06');
  });

  it('emits null when cleared from a populated value', () => {
    const onChange = vi.fn();
    const existing = dayjs('2024-05-06');
    render(<DatePicker value={existing} onChange={onChange} />);

    fireEvent.change(document.querySelector('input')!, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('ignores clearing when allowClear is false', () => {
    const onChange = vi.fn();
    const existing = dayjs('2024-05-06');
    render(<DatePicker value={existing} allowClear={false} onChange={onChange} />);

    fireEvent.change(document.querySelector('input')!, { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('TimePicker shim', () => {
  it('emits a same-day Dayjs carrying the picked time', () => {
    const onChange = vi.fn();
    render(<TimePicker value={null} onChange={onChange} />);

    fireEvent.change(document.querySelector('input')!, { target: { value: '13:45' } });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].format('HH:mm')).toBe('13:45');
  });

  it('emits null when cleared from a populated value', () => {
    const onChange = vi.fn();
    const existing = dayjs('2024-05-06T13:45');
    render(<TimePicker value={existing} onChange={onChange} />);

    fireEvent.change(document.querySelector('input')!, { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});

describe('Input allowClear semantics', () => {
  it('clear button emits antd-style change event with empty target value', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Input allowClear value='abc' onChange={onChange} />);

    await user.click(document.querySelector('button[aria-label="Clear"]')!);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.value).toBe('');
  });
});

describe('focusBuilderRoot', () => {
  it('focuses the embedded CodeMirror view and moves the caret to the end', () => {
    const host = document.createElement('div');
    const ceEl = document.createElement('div');
    ceEl.className = 'grl-ce';
    const view = {
      focus: vi.fn(),
      dispatch: vi.fn(),
      state: { doc: { length: 7 } },
    };
    Object.defineProperty(ceEl, 'codeMirror', { value: view });
    host.appendChild(ceEl);
    document.body.appendChild(host);

    focusBuilderRoot(host);

    expect(view.focus).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith({ selection: { anchor: 7 } });
    document.body.removeChild(host);
  });

  it('falls back to focusing a plain input and parking the caret at its end', () => {
    const host = document.createElement('div');
    const input = document.createElement('input');
    input.value = 'hello';
    host.appendChild(input);
    document.body.appendChild(host);
    const focusSpy = vi.spyOn(input, 'focus');

    focusBuilderRoot(host);

    expect(focusSpy).toHaveBeenCalledTimes(1);
    expect(input.selectionStart).toBe(5);
    expect(input.selectionEnd).toBe(5);
    document.body.removeChild(host);
  });

  it('is a no-op for a null element', () => {
    expect(() => focusBuilderRoot(null)).not.toThrow();
  });
});
