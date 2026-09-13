import { describe, expect, test } from 'vitest';

import { DecisionRuntime } from './engine.ts';
import { getExecContext, runWithExecContext } from './exec-context.ts';

const graph = {
  id: 'tenant-graph',
  nodes: [
    { id: 'in', type: 'inputNode', name: 'Request' },
    { id: 'out', type: 'outputNode', name: 'Response' },
  ],
  edges: [],
};

describe('DecisionRuntime 租户上下文强制（U2）', () => {
  test('无租户上下文时 evaluate 拒绝执行（fail closed）', async () => {
    const runtime = new DecisionRuntime({});
    runtime.createDecisionWithCacheKey('k', structuredClone(graph));

    await expect(runtime.evaluateAsync('k', { x: 1 })).rejects.toThrow('missing exec context tenantId');
    await expect(runWithExecContext({ userId: 'u1' }, () => runtime.evaluateAsync('k', { x: 1 }))).rejects.toThrow(
      'missing exec context tenantId',
    );
  });

  test('携带 tenantId 时正常执行', async () => {
    const runtime = new DecisionRuntime({});
    runtime.createDecisionWithCacheKey('k', structuredClone(graph));

    const result = await runWithExecContext({ tenantId: 't-1', userId: 'u1' }, () =>
      runtime.evaluateAsync('k', { x: 1 }),
    );
    expect(result.result).toBeDefined();
  });

  test('tenantExempt 豁免单租户部署', async () => {
    const runtime = new DecisionRuntime({});
    runtime.createDecisionWithCacheKey('k', structuredClone(graph));

    const result = await runWithExecContext({ tenantExempt: true }, () => runtime.evaluateAsync('k', { x: 1 }));
    expect(result.result).toBeDefined();
  });

  test('tenantId 经 AsyncLocalStorage 贯穿并发链路', async () => {
    const probe = async (): Promise<string | undefined> => {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
      return getExecContext()?.tenantId;
    };
    const results = await Promise.all([
      runWithExecContext({ tenantId: 't-a' }, probe),
      runWithExecContext({ tenantId: 't-b' }, probe),
      runWithExecContext({ tenantId: 't-c' }, probe),
    ]);
    expect(results).toEqual(['t-a', 't-b', 't-c']);
  });
});
