# zen-udf 开发计划 BB 系列（0.4.0 发布与运营收口）

状态：plan · 待宿主确认（3 个决策点见文末）
上游：U/V/W/X/Y/Z/AA 系列已 shipped；0.3.0 在架；AA 新能力（影子评估/回放端点/输入守卫/批量/基线）待随 0.4.0 发布

## 现状盘点（侦察结论）

- **e2e 哨兵缺口**：`demo-server-live.mjs` 对 `/v1/replay` 零覆盖——AA2 信任链闭环端点没有端到端哨兵
- **文档滞后**：README 与 docs 落地页未收录 AA 能力（影子评估/回放端点/输入守卫/批量评估/性能基线）
- **加固缺口**：L1 缓存只有 LRU 容量、无空闲 TTL；http UDF 无响应体积上限（恶意/异常下游可撑爆内存）
- **观测分散**：缓存有 metricsSink，但 UDF 错误率/耗时、熔断开断、并发闸排队无统一出口
- 版本 0.3.0——AA 能力待随 0.4.0 发布

## 总览

| 期 | 内容 | 状态 |
| --- | --- | --- |
| BB1 | e2e 探针补回放链路（execute→audit→replay→一致性） | 待开发 |
| BB2 | README/docs 刷新至 0.4.0 能力全集 | 待开发 |
| BB3 | L1 缓存空闲 TTL（可选，不破坏 LRU 语义） | 待开发 |
| BB4 | http UDF maxBytes 响应体积守卫 | 待开发 |
| BB5 | 观测统一接口（metrics sink：UDF 计数/耗时/熔断/并发闸） | 待开发 |
| BB6 | 0.4.0 版本收口与发布 | 待开发 |
| 稳态 | verdict U10 支持（跨仓）/ W4 上游 issue（挂起）/ Z6 子 span（挂起） | 持续 |

建议执行序：BB1 → BB2 → BB3 → BB4 → BB5 → BB6。

## BB1 e2e 探针补回放链路

- `demo-server-live.mjs` 新增两步：`POST /v1/execute trace=true` 捕获响应中的 `audit`；
  `POST /v1/replay { model, input, audit }` 断言 `consistent: true`；再加篡改输入用例断言 422
- 价值：信任链演示闭环获得端到端哨兵——AA2 端点回归不再依赖单测

## BB2 文档刷新至 0.4.0

- README 新增：影子评估（evaluateShadow + act 占位语义）、evaluateMany、输入守卫（NaN/Infinity）、性能基线（bench/perf.ts 运行方式）
- docs/zen-udf.md 落地页同步（0.3.0 新能力清单 → 0.4.0 合并刷新）

## BB3 L1 缓存空闲 TTL

- DecisionCache 增 `idleTtlMs?: number`：条目级 lastAccess 追踪，get 时惰性过期（不引入定时器）
- 缺省关闭（纯 LRU）；开启后与容量上限叠加（先 TTL 后 LRU）
- 测试：注入时钟下空闲过期、TTL 内不受影响、与 LRU 叠加驱逐序

## BB4 http UDF maxBytes 守卫

- http_request UDF 增响应体积上限：流式读取超限即中断（AbortController），返回
  `{ status: 0, error: 'response exceeds maxBytes' }`（策略性失败不重试）
- 缺省值待宿主确认（推荐 1MB 可配；kwargs.maxBytes 覆盖）
- 测试：超限中断、限内正常、不重试语义

## BB5 观测统一接口

- DecisionRuntimeOptions 增 `metrics?: (event: MetricsEvent) => void`：
  `{ kind: 'udf', name, tenantId, micros, code? } | { kind: 'circuit', key, state } | { kind: 'limiter', key, waitMicros }`
- 现有缓存 metricsSink 保留不动（避免破坏）；新接口统一 UDF/熔断/并发闸三类事件，verdict 侧聚合成 Prometheus 指标
- 测试：三类事件形状与触发时机

## BB6 0.4.0 版本收口与发布

- version 0.3.0 → 0.4.0；`pnpm test:zen-udf-smoke` 本地绿；`chore(release)` 触发 CI（管线已验证）
- 发布后 registry 复核（传播延迟已知，轮询即可）

## 待宿主确认

- **D16**：0.4.0 发布时机（推荐：BB1–BB5 完成后一次发布，Y+AA+BB 能力整包；替代：先发 0.3.1 补丁再 0.4.0）
- **D17**：metrics 形态（推荐：轻量回调 sink + 事件命名约定，聚合归 verdict；替代：内建 Prometheus client——引入重依赖，不推荐）
- **D18**：http UDF maxBytes 缺省（推荐：**默认 1MB、kwargs.maxBytes 可调**；替代：缺省不限仅告警）
