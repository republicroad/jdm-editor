import type { DecisionGraphType, Simulation } from '@republicroad/jdm-editor';
import { describe, expect, it, vi } from 'vitest';

import { createSimulateFixturesRunner } from '../fixtures-adapter';
import type { SimulateHandler } from '../types';

const graph = { nodes: [], edges: [] } as unknown as DecisionGraphType;

const okSimulation = (result: unknown): Simulation =>
  ({
    result: {
      performance: '0',
      result,
      snapshot: graph,
      trace: {
        'n-1': { input: null, output: null, name: 'a', id: 'n-1', performance: null, traceData: null },
      },
    },
  }) as Simulation;

describe('createSimulateFixturesRunner (ADR-013 batch-3 / ADR-014 literal reuse)', () => {
  it('runs every fixture through the simulate handler and assembles the report (smoke semantics)', async () => {
    const handler: SimulateHandler = vi.fn(async (_graph, input) => ({
      simulation: okSimulation({ echo: input }),
    }));
    const runner = createSimulateFixturesRunner(handler);

    const report = await runner(graph, [
      { name: 'A', input: { a: 1 } },
      { name: 'B', input: { b: 2 } },
    ]);

    expect(report.passed).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.results[0]).toMatchObject({
      name: 'A',
      passed: true,
      outcome: 'passed',
      actual: { echo: { a: 1 } },
      traceHits: ['n-1'],
    });
    expect(handler).toHaveBeenCalledTimes(2);
    // 执行语义单源：每次调用都拿到调用时的图快照
    expect(handler).toHaveBeenLastCalledWith(graph, { b: 2 });
  });

  it('maps Simulation.error to execution-error', async () => {
    const handler: SimulateHandler = vi.fn(async () => ({
      simulation: { error: { message: 'boom', data: {} } },
    }));
    const runner = createSimulateFixturesRunner(handler);

    const report = await runner(graph, [{ name: 'X', input: {} }]);

    expect(report.failed).toBe(1);
    expect(report.results[0]).toMatchObject({
      name: 'X',
      passed: false,
      outcome: 'execution-error',
      error: 'boom',
    });
  });

  it('is a literal zen-udf runDecisionTests report (structural compat with kernel ExampleRunReport)', async () => {
    const handler: SimulateHandler = vi.fn(async () => ({ simulation: okSimulation(null) }));
    const runner = createSimulateFixturesRunner(handler);
    const report = await runner(graph, [{ name: 'only', input: 1 }]);

    // kernel 槽位契约字段逐一存在（CONTRACT §10 双侧同步演进的编译期锚）
    expect(Object.keys(report).sort()).toEqual(['failed', 'fingerprint', 'passed', 'results']);
    expect(Object.keys(report.results[0]).sort()).toEqual(expect.arrayContaining(['name', 'outcome', 'passed']));
  });
});
