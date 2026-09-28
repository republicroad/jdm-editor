import { type DecisionFixture, runDecisionTests } from '@republicroad/zen-udf';
import type { Hono } from 'hono';

/**
 * WS2 批 3（A5）：决策夹具执行端点（REPL/夹具视图消费）——
 * runDecisionTests 包装：登记模型 + 逐夹具执行 + FixtureReport（不抛异常，逐夹具记录）。
 * 夹具为 JSON 序列化形态（deep/path 断言可跨线；predicate 不可序列化，不在契约内）。
 */
export type FixtureExecuteBody = {
  model?: unknown;
  key?: string;
  fixtures?: Array<{
    name: string;
    input: unknown;
    asOf?: string;
    expect: { mode: 'deep' | 'path'; value: unknown; path?: string };
  }>;
  tenantId?: string;
};

export function registerFixturesRoute(app: Hono, runtime: Parameters<typeof runDecisionTests>[0], demoTenant: string) {
  app.post('/v1/fixtures/execute', async (c) => {
    const body = (await c.req.json().catch(() => null)) as FixtureExecuteBody | null;
    if (!body || !body.model || !Array.isArray(body.fixtures)) {
      return c.json({ error: 'invalid body', details: 'expected { model, fixtures: [] }' }, 400);
    }

    const fixtures = body.fixtures as DecisionFixture[];
    const report = await runDecisionTests(runtime, {
      model: body.model,
      key: body.key || `fixtures-${crypto.randomUUID()}`,
      fixtures,
      tenantId: body.tenantId || demoTenant,
    });

    return c.json(report);
  });
}
