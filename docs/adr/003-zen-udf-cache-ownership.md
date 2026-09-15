# ADR-003：L1 决策缓存责任归宿主（zen-engine 函数 loader 无引擎级缓存）

## 状态
accepted（2026-09）

## 背景

zen-engine 2.0.2 的函数 loader 路径（`engine.evaluate(key)`）无引擎级缓存：每次调用触发 loader 回调 + 重新解析 + 编译。`getDecision(key)` 也绕过 CompiledSet。性能实测：重建 ~1.04ms vs 缓存命中 ~0.17ms（5–6 倍），多租户高频决策下放大显著。

## 备选方案

| 方案 | 优势 | 劣势 |
| --- | --- | --- |
| 宿主自管 L1 缓存（LRU + TTL + 指标） | 可控、可观测、可按租户定制 | 需要自己实现 |
| static/zip loader 预编译 | 引擎原生 | 不支持按请求动态注册/卸载 |
| 依赖上游修复 | 无宿主成本 | 时间不可控、可能不改 |

## 决策

宿主自管 L1 决策缓存（`DecisionCache`）：LRU 容量 + 可选空闲 TTL + 命中/未命中/驱逐指标。缓存键 `${tenantId}:${key}@${rev}`（不可变版本链）。**禁止走 `engine.evaluate(key)` / `engine.getDecision(key)` 路径**——全部经 `createDecisionWithCacheKey` / `evaluateAsync`。

## 后果

- 缓存命中语义有哨兵测试（`engine-cache-semantics.test.ts`）钉死，升级不漂移
- verdict 聚合侧需维护 LRU 上限与 TTL 参数（按模型数与内存调优）
- 上游若在后续版本增加函数 loader 缓存，哨兵测试会检测到行为变化（正面）
