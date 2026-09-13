# @republicroad/zen-udf

zen-engine 的 customNode UDF 运行时：**多函数实例执行规范 + UDF 注册表 + 决策缓存 + 多租户数据面端口**。

基于 [@gorules/zen-engine](https://www.npmjs.com/package/@gorules/zen-engine)（2.0.2），补齐其在服务端执行自定义节点的完整能力。

## 定位

zen-engine 原生只执行内置节点类型；本包负责三件事：

1. **执行规范**——customNode 内多函数实例（`udf;;arg;;arg` 的 `;;` 分隔表达式）的求值、位置参数→kwargs 绑定、必填校验、超时兜底、per-tenant 并发闸、错误 containment（UDF 报错降级为结构化错误，不中断图）
2. **决策缓存**——L1 进程内缓存（LRU + 指标），键 `${tenantId}:${key}@${rev}`（与 `modelId:v{rev}` 模式对齐）。探针实证 zen-engine 函数 loader 无引擎级缓存，缓存责任在宿主
3. **多租户上下文**——AsyncLocalStorage 贯穿 evaluate → customNode → UDF；ALS 不跨 zen-engine 的 Rust worker→TSFN 边界，运行时以输入保留键携带 ExecContext 并在回调内重建立（[上下文传播说明](../../docs/design/zen-udf-context-propagation.md)）

## 快速上手

```ts
import { DecisionRuntime, type UdfPack, createUdfRegistry } from '@republicroad/zen-udf';

// 业务函数包：纯数据 + 处理器（deploy-time 注册，租户差异走 ExecContext）
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
  cacheCapacity: 500, // L1 容量
  resultValidation: 'warn', // 返回值契约：off | warn(缺省) | enforce
  limiter: myLimiter, // 可选：per-tenant 并发闸
  metricsSink: (snapshot) => stats.gauge('zen_udf_cache_size', snapshot.size),
});

// 登记 + 执行（多租户：ExecContext 必须带 tenantId）
await runWithExecContext({ tenantId: 't-1', userId: 'u-1' }, async () => {
  runtime.createDecisionWithCacheKey('fraud-model', graphJson, 'v3');
  const result = await runtime.evaluateAsync('fraud-model', { deviceId: 'dev-9' }, undefined, 'v3');
});
```

## 端口（宿主实现，机制本仓、策略宿主）

| 端口                 | 用途                                 | 参考实现                                                                                         |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `RateStore`          | 滑动窗口频控存储                     | `InMemoryRateStore`（单实例语义；生产注入 Redis 实现，复用 `rateStoreConformance` 契约测试验收） |
| `ConcurrencyLimiter` | per-tenant UDF 并发闸                | `InMemoryConcurrencyLimiter`（FIFO）/ `NoopConcurrencyLimiter`                                   |
| `EgressGuard`        | http UDF 出口 allowlist（防 SSRF）   | 未配置 = 全放行                                                                                  |
| `SecretResolver`     | 图内 `${secret:名称}` 凭证按租户解析 | 未配置 = secret 引用报错                                                                         |

注入方式：`setRateStore(...)` / `new DecisionRuntime({ limiter })` / `configureHttpUdf({ egressGuard, secretResolver })`。

## 参考函数域（builtin reference）

`import '@republicroad/zen-udf'`（根导入）自动装载 contrib 参考域：`http_request`、`crypto`、`roster`、`custom_list_query`、`rate_1h`、`group_distinct_1h`、`ip_location`、debug 系列。实例隔离时用 `loadReferenceInto(registry)` 按需装载。

## 多租户要点

- ExecContext：`{ tenantId, userId?, requestId? }`；evaluate 入口强制 tenantId（单租户 CLI 用 `tenantExempt: true` 豁免）
- 注册是 deploy-time 静态行为；租户差异（凭证/配额/白名单）在调用时经 ExecContext + 端口解析
- 编译产物租户无关（同租户同模型共享缓存），数据面租户相关

## 设计文档

- [多租户最佳实践设计](../../docs/design/zen-udf-multi-tenant.md)
- [开发计划（U 系列，已 shipped）](../../docs/design/zen-udf-development-plan.md)
- [上下文跨边界传播](../../docs/design/zen-udf-context-propagation.md)
- [包内命名规范](./docs/naming.md)

## 测试

```bash
bun run test   # 98 tests，Bun 工具链（zen-engine 原生绑定）
```
