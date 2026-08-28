import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SafeBoundary } from '../safe-boundary';

/** Child that throws on demand when `shouldThrow` is true. */
const Bomb: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) throw new Error('kaboom');
  return <div>safe content</div>;
};

describe('SafeBoundary', () => {
  it('renders children normally when no error occurs', () => {
    render(
      <SafeBoundary>
        <Bomb shouldThrow={false} />
      </SafeBoundary>,
    );
    expect(screen.getByText('safe content')).toBeInTheDocument();
  });

  it('catches rendering errors and shows the fallback UI', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SafeBoundary>
        <Bomb shouldThrow={true} />
      </SafeBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('kaboom')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('Retry button resets the error state and re-renders children', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    const { rerender } = render(
      <SafeBoundary>
        <Bomb shouldThrow={shouldThrow} />
      </SafeBoundary>,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    rerender(
      <SafeBoundary>
        <Bomb shouldThrow={shouldThrow} />
      </SafeBoundary>,
    );
    fireEvent.click(screen.getByText('Retry'));
    expect(screen.getByText('safe content')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('invokes the onError callback with the caught error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    render(
      <SafeBoundary onError={onError}>
        <Bomb shouldThrow={true} />
      </SafeBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe('kaboom');
    spy.mockRestore();
  });

  it('renders custom fallback UI when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <SafeBoundary fallback={<div>custom fallback</div>}>
        <Bomb shouldThrow={true} />
      </SafeBoundary>,
    );
    expect(screen.getByText('custom fallback')).toBeInTheDocument();
    spy.mockRestore();
  });
});
