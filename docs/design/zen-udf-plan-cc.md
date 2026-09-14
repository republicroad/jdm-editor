# zen-udf 开发计划 CC 系列（信任链产品化收口）

状态：plan · 按推荐落地（D15 影子 act 不执行原则沿用；两处细节按推荐缺省，见文末）
上游：U–BB 系列已 shipped；0.4.0 在架；W4 挂起（等 contextvars 总结）；verdict U10 跨仓执行中

## 现状盘点

- AA1 影子评估只有库 API（`evaluateShadow`）——demo-server 无消费端点，客户可见形态缺失（对称于 AA2 之前的 /v1/replay）
- e2e 哨兵（demo-server-live.mjs）对 shadow 链路零覆盖
- BB5 观测接口的事件命名约定未文档化（verdict 聚合 Prometheus 需要对照表）
- README/docs 未收录 BB 能力（maxBytes 守卫、空闲 TTL、统一观测、影子评估）
- 0.4.0 已发布；发布物冒烟 + e2e 探针均已绿

## 总览

| 期 | 内容 | 状态 |
| --- | --- | --- |
| CC1 | demo-server `/v1/shadow` 端点（AA1 消费方演示） | 待开发 |
| CC2 | e2e 探针补 shadow 链路 | 待开发 |
| CC3 | metrics 事件命名约定表（BB5 对接文档） | 待开发 |
| CC4 | README/docs 补 BB 能力 | 待开发 |
| CC5 | verdict U10 支持 / W4 挂起 / Z6 挂起 | 稳态 |

建议执行序：CC1 → CC2 → CC3 → CC4（文档类合并提交）。

## CC1 demo-server `/v1/shadow` 端点

- `POST /v1/shadow`：`{ model, input, prodRev, shadowRev? }` → 服务端按模型内容哈希登记两个 rev（shadowRev 缺省 = 同模型内容重算），调 `runtime.evaluateShadow`，返回 `{ prod, shadow, equivalent, differences }`
- act 语义影子侧自动 intent 占位（AA1 机制保证，端点零额外逻辑）
- stateless 定位不变：rev 对由调用方携带（demo 即 model 内容哈希别名）

## CC2 e2e 探针补 shadow 链路

- demo-server-live.mjs 新增：`/v1/shadow` 同模型双 rev → `equivalent: true` 断言
- 价值：AA1 机制获得端到端哨兵（与 BB1 回放哨兵对称）

## CC3 metrics 事件命名约定表

- 文档化 BB5 三类事件的字段与建议的 Prometheus 映射：
  - `udf` → `zen_udf_udf_calls_total{code}` / `zen_udf_udf_duration_micros`
  - `circuit` → `zen_udf_circuit_denied_total{key}`
  - `limiter` → `zen_udf_limiter_wait_micros{key}`
- 落点：verdict-zen-udf-integration.md 附录（verdict 聚合实现的对接口径）

## CC4 README/docs 补 BB 能力

- README：maxBytes 守卫、空闲 TTL、统一观测 sink 三行补入端口/能力清单
- docs/zen-udf.md 落地页同步（0.4.0 清单补 BB 项）

## CC5 稳态

- verdict U10 支持：跨仓持续
- W4 上游 issue：挂起（等 contextvars 总结）
- Z6 子 span：挂起（等上游修复）
