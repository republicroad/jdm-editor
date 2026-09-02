import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSimulatorRequestEditor } from '../use-simulator-request-editor';

// bun test 无 DOM 环境：editor hook 使用 window.setTimeout/clearTimeout，指向 globalThis 同一实现
(globalThis as Record<string, unknown>).window = globalThis;

describe('useSimulatorRequestEditor', () => {
  it('starts with the provided default request', () => {
    const { result } = renderHook(() =>
      useSimulatorRequestEditor({ defaultRequest: '{"a":1}', currentBindingIdentity: null }),
    );

    expect(result.current.requestValue).toBe('{"a":1}');
    expect(result.current.userHasEdited).toBe(false);
    expect(result.current.isApplyingExternalRequest).toBe(false);
  });

  it('adopts external simulator requests and flags them as edited', () => {
    let external: string | undefined;
    const { result, rerender } = renderHook(
      ({ simulatorRequest }) =>
        useSimulatorRequestEditor({
          defaultRequest: '{}',
          simulatorRequest,
          onExternalChange: (value) => {
            external = value;
          },
        }),
      { initialProps: { simulatorRequest: undefined as string | undefined } },
    );

    act(() => {
      rerender({ simulatorRequest: '{"b":2}' });
    });

    expect(result.current.requestValue).toBe('{"b":2}');
    expect(result.current.userHasEdited).toBe(true);
    expect(external).toBe('{"b":2}');

    act(() => {
      result.current.setUserHasEdited(false);
    });
    // 相同值不重复触发
    rerender({ simulatorRequest: '{"b":2}' });
    expect(external).toBe('{"b":2}');
  });

  it('follows default request updates while untouched', () => {
    const { result, rerender } = renderHook(({ defaultRequest }) => useSimulatorRequestEditor({ defaultRequest }), {
      initialProps: { defaultRequest: '{"a":1}' },
    });

    rerender({ defaultRequest: '{"a":2}' });
    expect(result.current.requestValue).toBe('{"a":2}');
  });

  it('enters the switching animation on binding identity change and settles after it', async () => {
    const { result, rerender } = renderHook(
      ({ identity }) => useSimulatorRequestEditor({ currentBindingIdentity: identity }),
      { initialProps: { identity: null as string | null } },
    );

    act(() => {
      rerender({ identity: 'n1:0' });
    });
    expect(result.current.isApplyingExternalRequest).toBe(true);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 360));
    });
    expect(result.current.isApplyingExternalRequest).toBe(false);

    // 同一身份再次渲染不重新进入动画
    rerender({ identity: 'n1:0' });
    expect(result.current.isApplyingExternalRequest).toBe(false);
  }, 5000);
});
