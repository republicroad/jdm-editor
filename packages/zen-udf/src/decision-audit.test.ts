import { createHash } from 'node:crypto';
import { describe, expect, test } from 'vitest';

import { type DecisionAuditEvent, DecisionRuntime } from './engine.ts';
import { runWithExecContext } from './exec-context.ts';
import { UdfRegistry } from './register.ts';

/** 三语义混合图：query / observe / act 各一个表达式 */
const mixedGraph = (id: string) => ({
  id,
  nodes: [
    { id: 'in', type: 'inputNode', name: 'Request' },
    {
      id: 'c1',
      type: 'customNode',
      name: 'custom',
      content: {
        kind: 'UDF',
        config: {
          expressions: [
            { id: 'e1', key: 'v', value: 'query_udf;;x' },
            { id: 'e2', key: 'obs', value: 'observe_udf;;x' },
            { id: 'e3', key: 'act', value: 'act_udf;;x' },
          ],
        },
      },
    },
    { id: 'out', type: 'outputNode', name: 'Response' },
  ],
  edges: [
    { id: 'ed1', sourceId: 'in', targetId: 'c1', type: 'edge' },
    { id: 'ed2', sourceId: 'c1', targetId: 'out', type: 'edge' },
  ],
});

interface Spies {
  observeCalls: number;
  actCalls: number;
  queryCalls: number;
}
const makeRegistry = (): { registry: UdfRegistry; spies: Spies } => {
  const spies: Spies = { observeCalls: 0, actCalls: 0, queryCalls: 0 };
  const registry = new UdfRegistry();
  registry.registerFunction(function query_udf(kwargs: Record<string, unknown>) {
    spies.queryCalls += 1;
    return { plus: Number(kwargs?.x ?? 0) + 1 };
  }, 'probe');
  registry.registerFunction(
    function observe_udf(kwargs: Record<string, unknown>) {
      spies.observeCalls += 1;
      return { count: spies.observeCalls, x: (kwargs?._node_input_ as { x?: number })?.x ?? null };
    },
    'probe',
    { semantics: 'observe' },
  );
  registry.registerFunction(
    function act_udf(kwargs: Record<string, unknown>) {
      spies.actCalls += 1;
      return { blacklisted: true, x: (kwargs?._node_input_ as { x?: number })?.x ?? null };
    },
    'probe',
    { semantics: 'act' },
  );
  return { registry, spies };
};

const TENANT = 'audit-tenant';

const evaluateOnce = async (input: unknown): Promise<{ audit: DecisionAuditEvent; result: unknown; spies: Spies }> => {
  const events: DecisionAuditEvent[] = [];
  const { registry, spies } = makeRegistry();
  const runtime = new DecisionRuntime({ registry, onDecision: (e) => events.push(e) });
  await runWithExecContext({ tenantId: TENANT, decisionId: 'dec-1' }, () => {
    runtime.createDecisionWithCacheKey('k', mixedGraph('g'), 'v1');
    return Promise.resolve();
  });
  const result = await runWithExecContext({ tenantId: TENANT, userId: 'u-1', decisionId: 'dec-1' }, () =>
    runtime.evaluateAsync('k', input, undefined, 'v1'),
  );
  return { audit: events[events.length - 1], result: result.result, spies };
};

describe('Y2 决策审计事件', () => {
  test('事件形状完整：decisionId/tenant/key@rev/inputHash/output/observed', async () => {
    const input = { x: 7 };
    const { audit } = await evaluateOnce(input);
    expect(audit.decisionId).toBe('dec-1');
    expect(audit.tenantId).toBe(TENANT);
    expect(audit.key).toBe('k');
    expect(audit.rev).toBe('v1');
    expect(audit.inputHash).toBe(createHash('sha256').update(JSON.stringify(input)).digest('hex'));
    expect(audit.source).toBe('live');
    expect(audit.output).toBeDefined();

    const bySemantics = Object.fromEntries(audit.observed.map((o) => [o.name, o.semantics]));
    expect(bySemantics['query_udf']).toBe('query');
    expect(bySemantics['observe_udf']).toBe('observe');
    expect(bySemantics['act_udf']).toBe('act');
    // observed 携带 outcome 快照（回放 journal 来源，D11：output 全量）
    const obs = audit.observed.find((o) => o.name === 'observe_udf');
    expect(obs?.outcome).toEqual({ count: 1, x: 7 });
  });

  test('未配置 onDecision 时无审计且 trace 不强制', async () => {
    const { registry, spies } = makeRegistry();
    const runtime = new DecisionRuntime({ registry });
    await runWithExecContext({ tenantId: TENANT }, () => {
      runtime.createDecisionWithCacheKey('k', mixedGraph('g2'));
      return Promise.resolve();
    });
    const result = await runWithExecContext({ tenantId: TENANT }, () => runtime.evaluateAsync('k', { x: 1 }));
    expect(result.trace).toBeUndefined();
    expect(spies.observeCalls).toBeGreaterThan(0);
  });

  test('sink 抛错不中断决策', async () => {
    const { registry } = makeRegistry();
    const runtime = new DecisionRuntime({
      registry,
      onDecision: () => {
        throw new Error('sink down');
      },
    });
    await runWithExecContext({ tenantId: TENANT }, () => {
      runtime.createDecisionWithCacheKey('k', mixedGraph('g3'));
      return Promise.resolve();
    });
    const result = await runWithExecContext({ tenantId: TENANT }, () => runtime.evaluateAsync('k', { x: 2 }));
    expect(result.result).toBeDefined();
  });
});

describe('Y3 replay 模式（确定性回放）', () => {
  test('observe/act 不重执行（journal 读回），query 以 asOf 重算，结论一致', async () => {
    const events: DecisionAuditEvent[] = [];
    const { registry, spies } = makeRegistry();
    const runtime = new DecisionRuntime({ registry, onDecision: (e) => events.push(e) });
    await runWithExecContext({ tenantId: TENANT, decisionId: 'dec-9', eventTime: '2026-09-13T00:00:00Z' }, () => {
      runtime.createDecisionWithCacheKey('k', mixedGraph('g'), 'v1');
      return Promise.resolve();
    });
    const input = { x: 7 };
    await runWithExecContext({ tenantId: TENANT, userId: 'u-1', decisionId: 'dec-9' }, () =>
      runtime.evaluateAsync('k', input, undefined, 'v1'),
    );
    const original = events[events.length - 1];
    const before = { ...spies };

    // 回放：新 runtime 实例（热层状态清零）+ 原审计 journal
    const replayRuntime = new DecisionRuntime({ registry: makeRegistry().registry });
    await runWithExecContext({ tenantId: TENANT }, () => {
      replayRuntime.createDecisionWithCacheKey('k', mixedGraph('g-replay'), 'v1');
      return Promise.resolve();
    });
    const replayed = await runtime.evaluateReplay(original, input);

    expect(before.observeCalls).toBe(1);
    expect(spies.observeCalls).toBe(1); // 回放未重执行 observe
    expect(spies.actCalls).toBe(1);
    expect(replayed.result).toEqual(original.output);
  });

  test('journal 缺失 → REPLAY_JOURNAL_MISS fail closed', async () => {
    const { registry } = makeRegistry();
    const runtime = new DecisionRuntime({ registry });
    await runWithExecContext({ tenantId: TENANT }, () => {
      runtime.createDecisionWithCacheKey('k', mixedGraph('g'), 'v1');
      return Promise.resolve();
    });

    await runWithExecContext(
      {
        tenantId: TENANT,
        replay: {
          decisionId: 'dec-x',
          asOf: '2026-09-13T00:00:00Z',
          journal: [], // 空 journal：observe/act 无从读回
        },
      },
      async () => {
        const result = await runtime.evaluateAsync('k', { x: 1 }, undefined, 'v1');
        const act = (result.result as { act?: { error?: { code?: string } } }).act;
        expect(act?.error?.code).toBe('REPLAY_JOURNAL_MISS');
      },
    );
  });

  test('evaluateReplay：输入哈希不匹配时抛错（trust 语义）', async () => {
    const audit: DecisionAuditEvent = {
      decisionId: 'd-1',
      tenantId: TENANT,
      key: 'k',
      rev: 'v1',
      inputHash: 'deadbeef',
      output: {},
      processingTime: '2026-09-13T00:00:00Z',
      source: 'live',
      observed: [],
    };
    await expect(runtime_evaluateReplay(audit, { x: 1 })).rejects.toThrow('replay input hash mismatch');
  });

  async function runtime_evaluateReplay(audit: DecisionAuditEvent, input: unknown) {
    const { registry } = makeRegistry();
    const runtime = new DecisionRuntime({ registry });
    await runWithExecContext({ tenantId: TENANT }, () => {
      runtime.createDecisionWithCacheKey(audit.key, mixedGraph('g'), audit.rev);
      return Promise.resolve();
    });
    return runtime.evaluateReplay(audit, input);
  }
});
