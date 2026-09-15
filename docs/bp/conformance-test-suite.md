# BP-03：契约测试套件

## 适用场景

你定义了一个**端口接口**（如 RateStore / ConcurrencyLimiter / EgressGuard），有多个实现（内存参考实现 / Redis 生产实现 / mock 测试实现），需要保证所有实现行为一致。

## 核心模型

```
端口接口（RateStore）
├── InMemoryRateStore（参考实现，开发态）
├── RedisRateStore（verdict 生产实现）       ← 必须通过同一套契约测试
├── （未来的其他实现）                       ← 同上
└── rateStoreConformance(createStore)       ← 契约测试套件（共享）
```

契约测试套件是一个**接受工厂函数的 describe 函数**：每种实现通过工厂创建实例，跑同一组行为断言。

## 铁律

1. **契约测试只测接口行为，不测实现细节**——不引用具体实现的内部状态
2. **时间/随机性可注入**——涉及时间窗口/随机行为的接口须接受 now() 或 seed 参数
3. **参考实现必须全绿**——如果参考实现自己都不过，说明契约定义有误
4. **新实现必须全绿**——否则不允许接入生产

## 仓内实例

- `packages/zen-udf/src/contrib/rate-store-conformance.ts`：`rateStoreConformance(name, createStore)` 
  覆盖 rate 计数/滑窗过期 + groupDistinct pv/uv/去重/expiry
- `packages/zen-udf/src/contrib/rate-store.test.ts` 调用 `rateStoreConformance('InMemoryRateStore', ...)` 全绿
- verdict 的 RedisRateStore 复用同一套验收（BB 系列裁决 D1）

## 反模式

| 反模式 | 后果 |
| --- | --- |
| 每个实现写自己的测试（不共享套件） | 实现间行为漂移无人发现 |
| 契约测试断言实现内部状态 | 锁死实现自由度，接口演进成本增大 |
| 只测 happy path 不测边界（窗口滑出/并发竞争） | 生产环境出现难以排查的计数偏差 |
