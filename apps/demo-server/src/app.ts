import { DecisionRuntime, runWithExecContext } from '@republicroad/zen-udf';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createHash } from 'node:crypto';

export type ExecuteBody = {
  model?: unknown;
  input?: unknown;
  trace?: boolean;
};

export type ApiError = { error: string; details?: unknown };

const isModelShape = (value: unknown): value is { nodes: unknown[]; edges?: unknown[] } => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const candidate = value as { nodes?: unknown; edges?: unknown };
  return Array.isArray(candidate.nodes);
};

/** 模型内容哈希 → L1 缓存键（stateless 服务按请求携带模型，同模型复用编译产物） */
const modelCacheKey = (model: unknown): string =>
  'sha256:' + createHash('sha256').update(JSON.stringify(model)).digest('hex');

// 单租户自托管 demo：tenantExempt 豁免租户强制（zen-udf 多租户面向生产平台）。
// 执行走 zen-udf DecisionRuntime（zen-engine 2.0.2 + reference 参考函数域 + L1 决策缓存）。
const runtime = new DecisionRuntime({});

/**
 * Stateless demo API over zen-udf（自托管演示，非 SaaS 后端）：
 *   GET  /healthz         存活探针
 *   POST /v1/validate     JDM 模型校验（zen 引擎级 validate，执行语义权威）
 *   POST /v1/execute      模型执行 { model, input, trace? } → { result, trace? }
 *                         （trace 同时包含 zen 节点轨迹与 UDF 级 traceData）
 * 无鉴权、无存储；显式 demo 头随每个响应返回。
 * 注意：刻意不依赖 @republicroad/jdm-editor——kernel 是 UI 库（浏览器全局），
 * 服务端的模型契约以 zen 引擎校验为准，类型层契约由 verdict 仓以 type-only 引入。
 */
export const createApp = () => {
  const app = new Hono();

  // demo 全开放跨域：playground（vite dev）等本地前端直连
  app.use('*', cors());

  app.use('*', async (c, next) => {
    await next();
    c.res.headers.set('X-JDM-Demo', 'true');
  });

  app.get('/healthz', (c) => c.json({ ok: true }));

  app.post('/v1/validate', async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!isModelShape(body)) {
      return c.json({ error: 'invalid model', details: 'expected { nodes: [], edges?: [] }' } satisfies ApiError, 400);
    }

    try {
      runtime.createDecision(body).validate();
      return c.json({ ok: true });
    } catch (err) {
      return c.json({ error: 'invalid model', details: String(err).slice(0, 300) } satisfies ApiError, 400);
    }
  });

  app.post('/v1/execute', async (c) => {
    let body: ExecuteBody;
    try {
      body = (await c.req.json()) as ExecuteBody;
    } catch {
      return c.json({ error: 'invalid JSON body' } satisfies ApiError, 400);
    }

    const model: unknown = body?.model;
    if (!isModelShape(model)) {
      return c.json(
        { error: 'invalid model', details: 'expected model { nodes: [], edges?: [] }' } satisfies ApiError,
        400,
      );
    }

    try {
      const cacheKey = modelCacheKey(model);
      const outcome = await runWithExecContext({ tenantExempt: true }, async () => {
        if (!runtime.getDecisionCache(cacheKey)) {
          try {
            runtime.createDecisionWithCacheKey(cacheKey, model);
          } catch {
            // 并发同模型重复登记：已有同哈希编译产物，直接复用
          }
        }
        return runtime.evaluateAsync(cacheKey, (body?.input ?? {}) as Record<string, unknown>, {
          trace: body?.trace === true,
        });
      });

      return c.json({
        result: outcome.result ?? null,
        performance: outcome.performance ?? '',
        ...(body?.trace === true && outcome.trace !== undefined ? { trace: outcome.trace } : {}),
      });
    } catch (err) {
      return c.json({ error: 'execution failed', details: String(err).slice(0, 300) } satisfies ApiError, 422);
    }
  });

  return app;
};
