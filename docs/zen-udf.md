# zen-udf：zen-engine 的 customNode UDF 运行时

`@republicroad/zen-udf`（0.2.0）基于 [@gorules/zen-engine](https://www.npmjs.com/package/@gorules/zen-engine) 2.0.2，补齐其在服务端执行自定义节点的完整能力：**多函数实例执行规范 + UdfPack 注册表 + L1 决策缓存 + 多租户上下文与数据面端口**。

源码：`packages/zen-udf`（源码发布，消费方经 bundler/tsx/Bun 直跑）。

## 它解决什么

zen-engine 原生只执行内置节点类型；服务端跑自定义节点时缺三块能力：

1. **执行规范**——customNode 内多函数实例（`udf;;arg;;arg`）的求值、位置参数→kwargs 绑定、必填校验、超时兜底、per-tenant 并发闸、错误 containment
2. **决策缓存**——探针实证 zen-engine 函数 loader 无引擎级缓存（每次 `evaluate(key)` 都重新解析），缓存责任在宿主。本包提供 L1 缓存（LRU + 指标），键 `${tenantId}:${key}@${rev}`
3. **多租户上下文**——AsyncLocalStorage 不跨 zen-engine 的 Rust worker→TSFN 回调边界（探针实证），运行时以输入保留键携带 ExecContext 并在回调内重建立

## 快速上手

```ts
import { DecisionRuntime, createUdfRegistry, runWithExecContext, type UdfPack } from '@republicroad/zen-udf';

const fraudPack: UdfPack = {
  namespace: 'fraud',
  tools: [
    {
      name: 'device_fingerprint_query',
      parametersSchema: { properties: { deviceId: { type: 'string' } }, required: ['deviceId'], type: 'object' },
      returnsSchema: { type: 'object', properties: {} },
      fn: async (kwargs) => queryBackend(kwargs.deviceId as string),
    },
  ],
};

const runtime = new DecisionRuntime({
  registry: createUdfRegistry({ packs: [fraudPack] }),
  resultValidation: 'warn',   // 返回值契约：off | warn(缺省) | enforce
  limiter: myLimiter,         // 可选：per-tenant 并发闸
});

await runWithExecContext({ tenantId: 't-1', userId: 'u-1' }, async () => {
  runtime.createDecisionWithCacheKey('fraud-model', graphJson, 'v3');
  const result = await runtime.evaluateAsync('fraud-model', { deviceId: 'dev-9' }, undefined, 'v3');
});
```

## 端口：机制在本仓，策略在宿主

| 端口 | 用途 | 参考实现 / 生产实现 |
| --- | --- | --- |
| `RateStore` | 滑动窗口频控 | `InMemoryRateStore`（开发态）→ verdict 注入 Redis 实现，复用 `rateStoreConformance` 契约测试验收 |
| `ConcurrencyLimiter` | per-tenant 并发闸 | `InMemoryConcurrencyLimiter`（FIFO）/ `NoopConcurrencyLimiter` |
| `EgressGuard` | http UDF 出口 allowlist（防 SSRF） | 未配置 = 全放行 |
| `SecretResolver` | 图内 `${secret:名称}` 按租户解析 | 未配置 = secret 引用报错 |

## 多租户要点

- `ExecContext { tenantId, userId?, requestId? }`：evaluate 入口强制 tenantId（单租户 CLI 用 `tenantExempt` 豁免）
- 注册是 deploy-time 静态行为；租户差异（凭证/配额/白名单）在调用时经 ExecContext + 端口解析
- 编译产物租户无关（同租户同模型共享缓存），数据面租户相关

## 深入阅读

- [多租户最佳实践设计](/jdm-editor/docs/design/zen-udf-multi-tenant)
- [上下文跨 TSFN 边界传播（现状 + 原生绑定层提案）](/jdm-editor/docs/design/zen-udf-context-propagation)
- [U 系列开发计划（机制与租户契约，已 shipped）](/jdm-editor/docs/design/zen-udf-development-plan)
- [V 系列开发计划（发布/规范收尾/消费方验证，已 shipped）](/jdm-editor/docs/design/zen-udf-plan-v)
- [verdict U10 接入指南](/jdm-editor/docs/design/verdict-zen-udf-integration)
- [上游 issue 草稿（gorules/zen async context）](/jdm-editor/docs/upstream/gorules-zen-async-context)
- 包内命名规范：`packages/zen-udf/docs/naming.md`
