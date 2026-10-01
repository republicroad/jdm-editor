import {
  type DecisionFixture,
  type DecisionRuntime,
  createRuntimeExecutor,
  createZenExpressionEvaluator,
  runDecisionTests,
} from '@republicroad/zen-udf';
import type { Hono } from 'hono';

/**
 * WS2 批 3（A5）：决策夹具执行端点（REPL/夹具视图消费）——
 * runDecisionTests 包装：executor 适配器（__fixtures__: 键隔离）+ 逐夹具执行 +
 * FixtureReport（不抛异常，逐夹具记录）。夹具为 JSON 序列化形态（deep/path/
 * expression 断言可跨线；predicate 不可序列化，不在 CONTRACT §10 契约内）。
 */
export type FixtureExecuteBody = {
  model?: unknown;
  key?: string;
  fixtures?: Array<{
    name: string;
    input: unknown;
    asOf?: string;
    expect: { mode: 'deep' | 'path' | 'expression'; value?: unknown; path?: string; source?: string };
  }>;
  tenantId?: string;
};

export function registerFixturesRoute(app: Hono, runtime: DecisionRuntime, demoTenant: string) {
  app.post('/v1/fixtures/execute', async (c) => {
    const body = (await c.req.json().catch(() => null)) as FixtureExecuteBody | null;
    if (!body || !body.model || !Array.isArray(body.fixtures)) {
      return c.json({ error: 'invalid body', details: 'expected { model, fixtures: [] }' }, 400);
    }

    const fixtures = body.fixtures as DecisionFixture[];
    const report = await runDecisionTests({
      executor: createRuntimeExecutor(runtime, {
        key: body.key || `fixtures-${crypto.randomUUID()}`,
        model: body.model,
        tenantId: body.tenantId || demoTenant,
      }),
      fixtures,
      expressionEvaluator: createZenExpressionEvaluator(),
    });

    return c.json(report);
  });
}
