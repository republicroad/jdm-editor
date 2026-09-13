import { describe, expect, test } from 'vitest';

import { getExecContext, runWithExecContext } from './exec-context.ts';
import { globalUdfRegistry, registerUdf } from './register.ts';

describe('exec-context', () => {
  test('无上下文时返回 undefined', () => {
    expect(getExecContext()).toBeUndefined();
  });

  test('并发交错链路各自读取自己的上下文', async () => {
    const probe = async (): Promise<string | undefined> => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 15));
      return getExecContext()?.userId;
    };
    const results = await Promise.all([
      runWithExecContext({ userId: 'u-a', requestId: 'r-1' }, probe),
      runWithExecContext({ userId: 'u-b', requestId: 'r-2' }, probe),
      runWithExecContext({ userId: 'u-c' }, probe),
    ]);
    expect(results).toEqual(['u-a', 'u-b', 'u-c']);
  });

  test('UDF 经 getExecContext 读到各自 userId(并发注册函数探针)', async () => {
    registerUdf('exec_probe_test', 'risk', {
      description: 'test probe',
      parametersSchema: { properties: {}, title: 'exec_probe_test', type: 'object' },
      returnsSchema: { type: 'object', title: 'probe', properties: {} },
    })(function execProbeUdf() {
      return { caller: getExecContext()?.userId ?? null };
    });

    const callProbe = () => globalUdfRegistry.call('exec_probe_test', {}) as Promise<{ caller: string | null }>;
    const [a, b] = await Promise.all([
      runWithExecContext({ userId: 'user-a' }, callProbe),
      runWithExecContext({ userId: 'user-b' }, callProbe),
    ]);
    expect(a.caller).toBe('user-a');
    expect(b.caller).toBe('user-b');
  });

  test('runWithExecContext 透传返回值并向上冒泡异常', async () => {
    await expect(
      runWithExecContext({ userId: 'x' }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    const value = await runWithExecContext({ userId: 'x' }, async () => 42);
    expect(value).toBe(42);
  });
});
