import { describe, expect, test } from 'vitest';

import { DecisionRuntime } from './engine.ts';
import { runWithExecContext } from './exec-context.ts';
import { type ContribToolDef, type ToolCallContext, UdfRegistry, defineToolFor, packChecks } from './register.ts';

const graph = (id: string, expr: string) => ({
  id,
  nodes: [
    { id: 'in', type: 'inputNode', name: 'Request' },
    {
      id: 'c1',
      type: 'customNode',
      name: 'custom',
      content: { kind: 'UDF', config: { expressions: [{ id: 'e1', key: 'out', value: expr }] } },
    },
    { id: 'out', type: 'outputNode', name: 'Response' },
  ],
  edges: [
    { id: 'ed1', sourceId: 'in', targetId: 'c1', type: 'edge' },
    { id: 'ed2', sourceId: 'c1', targetId: 'out', type: 'edge' },
  ],
});

describe('ToolCallContext（fn 第二参数）', () => {
  test('timeout 到点 abort signal 且 fn 观察到租户身份与截止时间', async () => {
    const observed: Array<Partial<ToolCallContext> | undefined> = [];
    const registry = new UdfRegistry();
    registry.registerFunction(
      async function slow_get(kwargs: Record<string, unknown>, call?: ToolCallContext) {
        observed.push(call);
        await new Promise<void>((resolve) => {
          if (call?.signal.aborted) return resolve();
          call?.signal.addEventListener('abort', () => resolve(), { once: true });
        });
        return { aborted: call?.signal.aborted ?? false };
      },
      'cache',
      { parameters: { timeout: { type: 'integer', default: null } } },
    );
    const runtime = new DecisionRuntime({ registry });
    const before = Date.now();
    await runWithExecContext({ tenantId: 'demo' }, async () => {
      runtime.createDecisionWithCacheKey('k', graph('g1', 'slow_get;;80'));
      const result = (await runtime.evaluateAsync('k', {})) as { result?: { out?: { error?: { code?: string } } } };
      // 运行时返回结构化 UDF_TIMEOUT……
      expect(result.result?.out?.error?.code).toBe('UDF_TIMEOUT');
    });
    // ……且 fn 收到了 call 上下文：signal 已 abort、租户/截止时间在位
    expect(observed).toHaveLength(1);
    expect(observed[0]?.signal?.aborted).toBe(true);
    expect(observed[0]?.tenantId).toBe('demo');
    expect(typeof observed[0]?.deadlineAt).toBe('number');
    expect(observed[0]?.deadlineAt as number).toBeGreaterThanOrEqual(before + 80);
  });

  test('无 timeout 约定时 signal 不 abort、deadlineAt 为 null', async () => {
    const observed: Array<Partial<ToolCallContext> | undefined> = [];
    const registry = new UdfRegistry();
    registry.registerFunction(
      async function fast_get(kwargs: Record<string, unknown>, call?: ToolCallContext) {
        observed.push(call);
        return 'ok';
      },
      'cache',
      { parameters: { timeout: { type: 'integer', default: null } } },
    );
    const runtime = new DecisionRuntime({ registry });
    await runWithExecContext({ tenantId: 'demo' }, async () => {
      runtime.createDecisionWithCacheKey('k', graph('g2', 'fast_get;;'));
      const result = (await runtime.evaluateAsync('k', {})) as { result?: { out?: unknown } };
      expect(result.result?.out).toBe('ok');
    });
    expect(observed).toHaveLength(1);
    expect(observed[0]?.signal?.aborted).toBe(false);
    expect(observed[0]?.deadlineAt).toBeNull();
  });
});

describe('defineToolFor 泛型 kwargs', () => {
  test('fn 的 kwargs 获得声明的参数类型（编译期），运行时行为不变', async () => {
    const tool = defineToolFor<{ key: string }>({
      name: 'get',
      description: 'demo',
      parametersSchema: {
        properties: { key: { type: 'string', title: 'Key' } },
        required: ['key'],
        title: 'get',
        type: 'object',
      },
      returnsSchema: { type: 'string', title: 'value' },
      fn: async (kwargs) => `v:${kwargs.key}`, // kwargs: { key: string } —— 类型来自泛型
    });
    const registry = new UdfRegistry();
    registry.registerFunction(tool.fn, 'demo', { parameters: { properties: {} } }, tool.name);
    const result = await registry.call('get', { key: 'k1' });
    expect(result).toBe('v:k1');
  });
});

describe('packChecks 质量层', () => {
  const baseTool: ContribToolDef = {
    name: 'get',
    description: 'demo get',
    parametersSchema: {
      properties: { key: { type: 'string', title: 'Key' } },
      required: ['key'],
      title: 'get',
      type: 'object',
    },
    returnsSchema: { type: 'string', title: 'value' },
    fn: async () => 'ok',
  };

  test('合格包零 issue', () => {
    expect(packChecks({ namespace: 'cache', tools: [{ ...baseTool }] })).toEqual([]);
  });

  test('缺 description / returnsSchema / required 越界 / timeout 形状 / act 幂等', () => {
    const issues = packChecks({
      namespace: 'cache',
      tools: [
        { ...baseTool, description: '  ', returnsSchema: undefined },
        {
          ...baseTool,
          name: 'push',
          description: 'demo push',
          semantics: 'act' as const,
          parametersSchema: {
            properties: { key: { type: 'string', title: 'Key' }, timeout: { type: 'string', title: 'Timeout' } },
            required: ['missing_key'],
            title: 'push',
            type: 'object',
          },
        },
      ],
    });
    const checks = issues.map((i) => `${i.tool}:${i.check}`);
    expect(checks).toContain('get:description-required');
    expect(checks).toContain('get:returns-schema-required');
    expect(checks).toContain('push:required-mismatch');
    expect(checks).toContain('push:timeout-shape');
    expect(checks).toContain('push:act-idempotent');
    for (const issue of issues) {
      expect(['error', 'warning']).toContain(issue.severity);
    }
  });

  test('namespace 命名偏离约定给 warning 不给 error', () => {
    const issues = packChecks({ namespace: 'MyCache', tools: [{ ...baseTool }] });
    expect(issues.map((i) => i.check)).toEqual(['namespace-convention']);
    expect(issues[0].severity).toBe('warning');
  });
});
