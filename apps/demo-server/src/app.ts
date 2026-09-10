import { ZenEngine } from '@gorules/zen-engine';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

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

/**
 * Stateless demo API over zen-engine（自托管演示，非 SaaS 后端）：
 *   GET  /healthz         存活探针
 *   POST /v1/validate     JDM 模型校验（zen 引擎级 validate，执行语义权威）
 *   POST /v1/execute      模型执行 { model, input, trace? } → { result, trace? }
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
      new ZenEngine().createDecision(body).validate();
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

    if (!isModelShape(body?.model)) {
      return c.json(
        { error: 'invalid model', details: 'expected model { nodes: [], edges?: [] }' } satisfies ApiError,
        400,
      );
    }

    try {
      const engine = new ZenEngine();
      // zen-engine 0.23：裸模型经 createDecision 执行；trace 由 evaluate options 控制
      const outcome = await engine
        .createDecision(body.model)
        .evaluate((body?.input ?? {}) as Record<string, unknown>, { trace: body?.trace === true });

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
