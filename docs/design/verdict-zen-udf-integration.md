# verdict 接入 zen-udf 指南（U10 交接包）

> 面向 verdict 仓执行者。机制仓（jdm-editor / packages/zen-udf）已提供全部机制与端口；
> 本文给出真实语义实现清单、验收标准与组装规范。上游包：`@republicroad/zen-udf@0.2.0`。

## 1. 依赖与消费

- `pnpm add @republicroad/zen-udf@^0.2.0`（公开发布；源码直通亦可：tsconfig paths → node_modules 内 src）
- 运行时：Node 24+ 或 Bun；zen-engine 2.0.2 原生绑定随包分发（Node 24 兼容，无需 Bun）
- 注意：包为 TS 源码发布（main = src/index.ts）——verdict 用 bundler/tsx/Bun 消费

## 2. 端口实现清单与验收

| 端口 | 注入点 | 实现要求 | 验收 |
| --- | --- | --- | --- |
| `RateStore` | `setRateStore(store)` | Redis 滑动窗口（`rate`/`groupDistinct`，时钟可注入） | **复用 `rateStoreConformance` 契约套件**（从包内 `src/contrib/rate-store-conformance.ts` 导入，工厂传 `() => redisStore(now)`） |
| `ConcurrencyLimiter` | `new DecisionRuntime({ limiter })` | per-tenant 分布式信号量（Redis token bucket / sem） | FIFO 公平性 + 跨实例上限测试 |
| `EgressGuard` | `configureHttpUdf({ egressGuard })` | per-tenant 出口域名 allowlist（配置中心读取） | 拒绝路径返回结构化错误、http 不重试 |
| `SecretResolver` | `configureHttpUdf({ secretResolver })` | 按 `(ref, tenantId)` 从密钥管理读取 | 凭证不出现在错误信息/trace |
| `metricsSink` | `new DecisionRuntime({ metricsSink })` | L1 缓存快照 → Prometheus gauge/counters | hits/misses/evictions/size 上报 |

多租户纪律：**注册是 deploy-time**（UdfPack 全租户同一份）；租户差异一律走 ExecContext + 端口，禁止 per-tenant 注册、禁止图内容携带凭证/租户身份。

## 3. model-execute 服务组装规范

```ts
import { DecisionRuntime, createUdfRegistry, runWithExecContext } from '@republicroad/zen-udf';

const runtime = new DecisionRuntime({
  registry: createUdfRegistry({ packs: [fraudPack, kycPack] }),
  cacheCapacity: 500,               // L1 容量按模型数调优
  resultValidation: 'warn',         // 灰度后按租户切 enforce
  limiter,                          // Redis 化并发闸
  metricsSink: prometheusSink,
});

// HTTP 层：请求 → ExecContext → evaluate
app.post('/v1/models/:key/execute', async (c) => {
  const { tenantId, userId, requestId } = resolveAuth(c);
  const { rev } = resolveModelRev(c);            // modelId:v{rev} 模式
  const input = await c.req.json();

  return runWithExecContext({ tenantId, userId, requestId }, async () => {
    const result = await runtime.evaluateAsync(`${tenantId}:${key}`, input, { trace: true }, `v${rev}`);
    // 等价：缓存键 ${tenantId}:${key}@v${rev}；模型发布 = 新 rev 建档 + 旧键删除
    return c.json(result);
  });
});
```

## 4. 模型内容存储（L0）

- 表：`decision_models(tenant_id, key, rev, content_json, published_at)`，`(tenant_id, key, rev)` 唯一
- 发布流程：写入新 rev → `runtime.createDecisionWithCacheKey(key, content, 'v{rev}')`（同进程热更新）→ 广播其它副本 delete 旧键
- 回滚：指回旧 rev 键（不可变版本键，无需数据回写）

## 5. UdfPack 编写规范（业务函数包）

- 形态：`{ namespace, tools }` 纯数据 + 处理器（`validatePack` 注册前自检）
- 函数内：只读 `getExecContext()` 与端口依赖；**不**自建租户连接、**不**读图 config 租户身份
- schema 即契约：`parametersSchema`/`returnsSchema` 同时驱动编辑器侧边栏、参数校验（INVALID_PARAM）与返回值契约（INVALID_RESULT）——务必与真实行为一致
- 超时：约定 `timeout` 参数（毫秒），运行时级 race 兜底
- 错误：抛错被 containment 捕获为 `{ error }`；业务失败建议返回结构化对象而非抛出

## 6. 验收清单

- [ ] RedisRateStore 通过 `rateStoreConformance`
- [ ] 混合租户并发 evaluate 各自租户隔离（复用 `context-hardening.test.ts` 模式）
- [ ] L1 缓存命中：同模型二连调 traceData/性能（miss → hit）
- [ ] 发布/回滚演练：rev 热替换、旧键失效广播
- [ ] Prometheus 指标上线（cache snapshot + UdfTrace 错误码计数）
- [ ] EgressGuard/SecretResolver 注入后 http UDF 冒烟
