import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Avatar,
  Button,
  Checkbox,
  Divider,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from '../primitives';

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
      <Select allowClear value='x' onClear={onClear} onChange={onChange} options={[{ value: 'x', label: 'x' }]} />,
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

describe('Switch shim', () => {
  it('emits boolean on toggle', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Switch onChange={onChange} />);

    await user.click(screen.getByRole('switch'));

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('respects controlled checked state', () => {
    const { rerender } = render(<Switch checked={false} />);
    expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'unchecked');

    rerender(<Switch checked />);
    expect(screen.getByRole('switch')).toHaveAttribute('data-state', 'checked');
  });
});

describe('Checkbox shim', () => {
  it('emits antd-style change event with target.checked', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<Checkbox onChange={onChange}>Label</Checkbox>);

    await user.click(screen.getByText('Label'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].target.checked).toBe(true);
  });
});

describe('Tabs shim', () => {
  it('fires onChange with the selected key and honors activeKey', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <Tabs
        activeKey='b'
        onChange={onChange}
        items={[
          { key: 'a', label: 'Alpha' },
          { key: 'b', label: 'Beta' },
        ]}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('data-state', 'active');

    await user.click(screen.getByRole('tab', { name: 'Alpha' }));
    expect(onChange).toHaveBeenCalledWith('a');
    // Controlled: activeKey wins over the click.
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('data-state', 'active');
  });
});

describe('Button shim mapping', () => {
  it('maps antd type to shadcn variant classes', () => {
    render(
      <>
        <Button type='dashed'>D</Button>
        <Button type='primary' danger>
          P
        </Button>
      </>,
    );

    expect(screen.getByText('D')).toHaveClass('border-dashed');
    expect(screen.getByText('P')).toHaveClass('bg-destructive');
  });

  it('renders an anchor when href is set', () => {
    render(
      <Button href='https://example.com' target='_blank'>
        Link
      </Button>,
    );
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('href', 'https://example.com');
  });

  it('loading state disables the button and shows a spinner', () => {
    render(
      <Button loading onClick={() => {}}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button', { name: /Save/ });
    expect(button).toBeDisabled();
    expect(button.querySelector('.animate-spin')).toBeTruthy();
  });
});

describe('Typography shim', () => {
  it('Text applies semantic color class and ellipsis tooltip title', () => {
    render(
      <Typography.Text type='secondary' ellipsis={{ tooltip: 'Full text' }}>
        hi
      </Typography.Text>,
    );

    const el = screen.getByText('hi');
    expect(el).toHaveClass('text-muted-foreground');
    expect(el).toHaveClass('truncate');
    expect(el).toHaveAttribute('title', 'Full text');
  });

  it('Title renders the heading level element', () => {
    render(<Typography.Title level={3}>Head</Typography.Title>);
    expect(screen.getByRole('heading', { level: 3, name: 'Head' })).toBeInTheDocument();
  });
});

describe('Modal shim', () => {
  it('renders title/body when open and wires default footer buttons', async () => {
    const onOk = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal open title='Confirm' onOk={onOk} onCancel={onCancel}>
        Body
      </Modal>,
    );

    expect(screen.getByText('Body')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'OK' }));
    expect(onOk).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('destroys body when closed with destroyOnClose', () => {
    const { container } = render(
      <Modal open={false} destroyOnClose title='T'>
        Hidden
      </Modal>,
    );
    expect(container.textContent).not.toContain('Hidden');
  });
});

describe('layout primitives smoke', () => {
  it('Divider exposes separator role', () => {
    render(<Divider type='vertical' />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('Tag renders its children inline', () => {
    render(<Tag>pro</Tag>);
    expect(screen.getByText('pro')).toBeInTheDocument();
  });

  it('Space applies resolved gap', () => {
    render(
      <Space size='large'>
        <span>a</span>
        <span>b</span>
      </Space>,
    );
    expect(screen.getByText('a').parentElement).toHaveStyle({ gap: '24px' });
  });

  it('Avatar renders image from src', () => {
    render(<Avatar src='/x.png' alt='avatar' />);
    expect(screen.getByRole('img', { name: 'avatar' })).toBeInTheDocument();
  });

  it('Tooltip wraps children and shows nothing extra without title', () => {
    render(
      <Tooltip title='hint'>
        <button>hover me</button>
      </Tooltip>,
    );
    expect(screen.getByRole('button', { name: 'hover me' })).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('hint');
  });
});
