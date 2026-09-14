import { type DecisionAuditEvent, DecisionRuntime, runWithExecContext } from '@republicroad/zen-udf';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createHash } from 'node:crypto';

export type ExecuteBody = {
  model?: unknown;
  input?: unknown;
  trace?: boolean;
};

export type ReplayBody = {
  model?: unknown;
  input?: unknown;
  /** 客户端留存的历史审计事件（/v1/execute trace=true 响应中的 audit 字段） */
  audit?: Partial<DecisionAuditEvent>;
};

export type ShadowBody = {
  /** 生产侧模型（基线） */
  prodModel?: unknown;
  /** 影子侧模型（候选）；缺省 = 生产模型自身 */
  shadowModel?: unknown;
  input?: unknown;
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

/** 请求级审计事件捕获：决策审计事件以 JSON 行输出 stdout（Z4 演示），并按 decisionId 暂存供响应携带 */
const auditEvents = new Map<string, DecisionAuditEvent>();
const runtime = new DecisionRuntime({
  onDecision: (event) => {
    console.log('[audit] ' + JSON.stringify(event));
    auditEvents.set(event.decisionId, event);
  },
});

/**
 * Stateless demo API over zen-udf（自托管演示，非 SaaS 后端）：
 *   GET  /healthz         存活探针
 *   POST /v1/validate     JDM 模型校验（zen 引擎级 validate，执行语义权威）
 *   POST /v1/execute      模型执行 { model, input, trace? } → { result, trace?, audit? }
 *   POST /v1/replay       确定性回放 { model, input, audit } → { result, consistent }
 *                         （observe/act 读审计 journal，不重执行；输入哈希校验）
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
      const decisionId =
        'req-' +
        createHash('sha256')
          .update(JSON.stringify([model, body?.input, Date.now(), Math.random()]))
          .digest('hex')
          .slice(0, 16);
      const outcome = await runWithExecContext({ tenantExempt: true, decisionId }, async () => {
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
      const audit = auditEvents.get(decisionId);
      auditEvents.delete(decisionId);

      return c.json({
        result: outcome.result ?? null,
        performance: outcome.performance ?? '',
        ...(body?.trace === true && outcome.trace !== undefined ? { trace: outcome.trace } : {}),
        ...(body?.trace === true && audit ? { audit } : {}),
      });
    } catch (err) {
      return c.json({ error: 'execution failed', details: String(err).slice(0, 300) } satisfies ApiError, 422);
    }
  });

  app.post('/v1/replay', async (c) => {
    let body: ReplayBody;
    try {
      body = (await c.req.json()) as ReplayBody;
    } catch {
      return c.json({ error: 'invalid JSON body' } satisfies ApiError, 400);
    }

    const model: unknown = body?.model;
    const audit: Partial<DecisionAuditEvent> | undefined = body?.audit;
    if (!isModelShape(model) || typeof audit !== 'object' || audit === null || typeof audit.inputHash !== 'string') {
      return c.json(
        {
          error: 'invalid body',
          details: 'expected { model, input, audit: { inputHash, output, observed[] } }',
        } satisfies ApiError,
        400,
      );
    }

    try {
      const replayed = await runWithExecContext({ tenantExempt: true }, () =>
        runtime.evaluateReplay(audit as DecisionAuditEvent, body?.input ?? {}),
      );

      // 一致性核验：重演结论与历史结论逐字段对比
      const consistent =
        JSON.stringify(replayed.result ?? null) === JSON.stringify((audit as DecisionAuditEvent).output ?? null);
      return c.json({ result: replayed.result ?? null, consistent });
    } catch (err) {
      return c.json({ error: 'replay failed', details: String(err).slice(0, 300) } satisfies ApiError, 422);
    }
  });

  app.post('/v1/shadow', async (c) => {
    let body: ShadowBody;
    try {
      body = (await c.req.json()) as ShadowBody;
    } catch {
      return c.json({ error: 'invalid JSON body' } satisfies ApiError, 400);
    }

    const prodModel: unknown = body?.prodModel;
    const shadowModel: unknown = body?.shadowModel ?? prodModel;
    if (!isModelShape(prodModel) || !isModelShape(shadowModel)) {
      return c.json(
        {
          error: 'invalid model',
          details: 'expected { prodModel: { nodes: [] }, shadowModel?, input }',
        } satisfies ApiError,
        400,
      );
    }

    try {
      // 内容哈希 → rev 别名：stateless demo 由调用方携带两个版本的模型
      const prodRev = 'p' + createHash('sha256').update(JSON.stringify(prodModel)).digest('hex').slice(0, 16);
      const shadowRev = 's' + createHash('sha256').update(JSON.stringify(shadowModel)).digest('hex').slice(0, 16);
      const input = (body?.input ?? {}) as Record<string, unknown>;

      const shadow = await runWithExecContext({ tenantExempt: true }, async () => {
        for (const [rev, model] of [
          [prodRev, prodModel],
          [shadowRev, shadowModel],
        ] as const) {
          const cacheKey = `shadow-demo:${rev}`;
          if (!runtime.getDecisionCache(cacheKey)) {
            try {
              runtime.createDecisionWithCacheKey('shadow-demo', model, rev);
            } catch {
              // 并发同 rev 重复登记：直接复用
            }
          }
        }
        return runtime.evaluateShadow('shadow-demo', { prod: prodRev, shadow: shadowRev }, input);
      });

      return c.json({
        prod: shadow.prod ?? null,
        shadow: shadow.shadow ?? null,
        equivalent: shadow.equivalent,
        differences: shadow.differences,
        prodPerformance: shadow.prodPerformance ?? '',
        shadowPerformance: shadow.shadowPerformance ?? '',
      });
    } catch (err) {
      return c.json({ error: 'shadow evaluation failed', details: String(err).slice(0, 300) } satisfies ApiError, 422);
    }
  });

  return app;
};
