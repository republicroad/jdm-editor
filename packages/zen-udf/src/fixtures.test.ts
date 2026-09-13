import { describe, expect, test } from 'vitest';

import { DecisionRuntime } from './engine.ts';
import { runWithExecContext } from './exec-context.ts';
import { runDecisionTests } from './fixtures.ts';
import { UdfRegistry } from './register.ts';

const model = {
  id: 'g-fixture',
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
            { id: 'e1', key: 'score', value: 'score_udf;;x' },
            { id: 'e2', key: 'flag', value: 'flag_udf;;x' },
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
};

const makeRuntime = (): DecisionRuntime => {
  const registry = new UdfRegistry();
  registry.registerFunction(
    function score_udf(kwargs: Record<string, unknown>) {
      return { value: kwargs?.x ?? 0 };
    },
    'fixture',
    {
      description: 'score udf',
      parametersSchema: { properties: { x: { type: 'integer', title: 'X' } }, type: 'object' },
    },
  );
  registry.registerFunction(
    function flag_udf(kwargs: Record<string, unknown>) {
      return { flagged: kwargs?.flagged === true };
    },
    'fixture',
    { semantics: 'observe' },
  );
  return new DecisionRuntime({ registry });
};

describe('Y7 决策测试夹具运行器', () => {
  test('deep/path/predicate 三种断言，报告逐夹具记录', async () => {
    const runtime = makeRuntime();
    const report = await runDecisionTests(runtime, {
      key: 'score-model',
      model,
      rev: 'v1',
      fixtures: [
        {
          name: 'x=3 → score 3',
          input: { x: 3, flagged: false },
          expect: {
            mode: 'deep',
            value: { score: { value: 3 }, flag: { flagged: false }, x: 3, flagged: false },
          },
        },
        {
          name: 'path 断言',
          input: { x: 5, flagged: false },
          expect: { mode: 'path', path: 'score.value', value: 5 },
        },
        {
          name: 'predicate 断言',
          input: { x: 9, flagged: false },
          expect: { mode: 'predicate', test: (r) => (r as { score?: { value?: number } }).score?.value === 9 },
        },
        {
          name: '不匹配的夹具记录失败',
          input: { x: 1, flagged: false },
          expect: { mode: 'path', path: 'score.value', value: 999 },
        },
      ],
    });

    expect(report.passed).toBe(3);
    expect(report.failed).toBe(1);
    const failed = report.results.find((r) => !r.passed);
    expect(failed?.error).toBe('expectation mismatch');
  });

  test('journal 桩：observe UDF 走回放语义不重执行（效果隔离）', async () => {
    const runtime = makeRuntime();
    await runWithExecContext({ tenantId: 'fixtures' }, () => {
      runtime.createDecisionWithCacheKey('jm', model, 'v1');
      return Promise.resolve();
    });

    // journal 桩：flag_udf 不执行，返回桩值 —— 夹具完全可复现
    const report = await runDecisionTests(runtime, {
      key: 'jm',
      model,
      rev: 'v1',
      fixtures: [
        {
          name: 'observe 走桩',
          input: { x: 4, flagged: true },
          asOf: '2026-09-13T00:00:00Z',
          journal: [{ key: 'flag', name: 'flag_udf', outcome: { flagged: 'FROM_JOURNAL' } }],
          expect: { mode: 'path', path: 'flag.flagged', value: 'FROM_JOURNAL' },
        },
      ],
    });
    expect(report.failed).toBe(0);
  });
});
