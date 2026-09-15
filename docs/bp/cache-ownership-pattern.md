# BP-05：缓存所有权模式

## 适用场景

你的引擎/框架（规则引擎、模板引擎、查询引擎）在函数 loader 路径下**无引擎级缓存**——每次 `evaluate(key)` 都触发 loader + 重新解析。宿主必须自管缓存，否则高频决策下性能退化 5–6 倍。

## 核心模型

```
                 ┌─────────────────────────────┐
                 │   宿主 L1 缓存               │
                 │   Map<tenant:key@rev, D>    │
                 │   LRU + 空闲TTL + 指标       │
                 └────────────┬────────────────┘
                              │ 命中 → 直接 evaluate
                              │ 未命中 → createDecision → set
                 ┌────────────┴────────────────┐
                 │   引擎（无缓存）             │
                 │   解析 → 编译 → evaluate     │
                 └─────────────────────────────┘
```

## 铁律

1. **缓存键必须含租户 + 不可变版本**：`${tenantId}:${key}@${rev}`——rev 进键意味着"更新 = 新键"，天然规避失效竞态
2. **禁止走引擎的 loader 路径**：函数 loader 无缓存且绕过宿主增强（如 graphAddons）
3. **set 即原子替换**：同键 set 整体换新（copy-on-write 热更新），绝不原地修改已编译实例
4. **命中即续期**：get 刷新 LRU 位次 + lastAccess 时间戳
5. **指标必须暴露**：hits / misses / evictions / ttlEvictions / builds / buildMicros——sink 可注入

## 仓内实例

- `packages/zen-udf/src/decision-cache.ts` — `DecisionCache` 类（LRU + TTL + 指标）
- `packages/zen-udf/src/engine.ts` — `DecisionRuntime` 通过 `cacheCapacity` / `idleTtlMs` 配置
- `packages/zen-udf/src/decision-cache.test.ts` — LRU 驱逐序 / 原子替换 / 租户隔离 / rev 并存 / TTL 过期
- 探针实证：`engine-cache-semantics.test.ts`（重建 1.04ms vs 缓存 0.17ms = 6 倍）

## 反模式

| 反模式 | 后果 |
| --- | --- |
| 缓存键不含租户 | 跨租户数据泄漏（最严重） |
| 缓存键不含 rev | 更新竞态：旧决策在新版本注册后仍命中旧缓存 |
| 只用 Map 无容量上限 | 内存无限增长 |
| 每次都 createDecision 不缓存 | 高频下性能退化 5–6 倍（探针实测） |
