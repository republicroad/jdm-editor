# zen-udf 开发计划 Y 系列（语义声明、审计与确定性回放）

状态：plan · 待宿主确认（1 个决策点见文末）
上游：U/V/W 系列已 shipped；0.2.0 已发布 npm
定位：**实时决策引擎赢得客户信任的核心**。客户信任 = 能回答"这个决策为什么发生、当时的状态是什么、重演是否一致"。本系列把"副作用与无状态功能的隔离"从作者约定升级为**运行时强制**：声明（作者）→ 强制（运行时）→ 证据（审计）→ 重演（回放）。

## 1. 语义模型：算子三分类

| 语义 | 例 | 状态变更含义 | 生产执行 | 回放行为 |
| --- | --- | --- | --- | --- |
| `query`（缺省） | roster、ip_location、crypto | 无 | 读 | 正常执行（时钟用 asOf） |
| `observe` | rate_1h、group_distinct（HAProxy stick table 热层） | 状态变更即计算本身（当前事件计入窗口） | 观测即计数（原子） | **不重执行**——读审计 journal 中记录的当时返回值 |
| `act` | 拉黑、通知 | 处置效果 | 执行并 journal outcome（幂等键 = decisionId） | **不重执行**——读 journal |

设计要点（业界对齐）：
- `observe` 的处理时间**是语义不是缺陷**（攻击检测问的就是到达时间）；其非确定性被隔离在热层，回放永不依赖热层——靠审计 journal 中钉住的观测值确定性重演（Temporal 活动 journaling 模式）
- `act` 推荐的作者范式是"决策输出意图，宿主提交效果"（CQRS + Outbox，幂等键 = decisionId）；运行时机制保持中性：正常模式执行并 journal，回放模式读 journal
- 热层（HAProxy stick table，处理时间、近似、10⁵+ QPS）与事实层（RateStore as-of、事件时间、精确）是两个层级两个端口：热层服务实时决策，事实层服务审计/回放/复盘/训练（Feast online/offline store 分层）。分层依据与同步计数（read-my-own-write）业界调研见 [zen-udf-sync-counting.md](./zen-udf-sync-counting.md)

## 2. 分期

| 期 | 内容 | 依赖 | 状态 |
| --- | --- | --- | --- |
| Y1 | 语义三元声明（`semantics: query \| observe \| act`） | — | 待开发 |
| Y2 | 决策审计事件（`onDecision` 钩子 + DecisionAuditEvent） | Y1 | 待开发 |
| Y3 | replay 模式（ExecContext.replay + journal 重放） | Y1 Y2 | 待开发 |
| Y4 | RateStore as-of 化（事件时间语义） | Y1 | 待开发 |
| Y5 | CircuitBreaker 端口（熔断） | — | 待开发 |
| Y6 | OpenTelemetry 桥（可选 peerDependency） | — | 待开发 |
| Y7 | 决策测试夹具运行器（基于 Y3 回放语义） | Y3 | 待开发 |

建议执行序：Y1 → Y2 → Y3 → Y4 → Y5 → Y6 → Y7。目标版本：0.3.0。

## Y1 语义三元声明

- UdfPack 工具定义增加 `semantics?: 'query' | 'observe' | 'act'`（缺省 `'query'`；`defineContrib`/`validatePack`/schema 下发全链路透传）
- `validatePack`：`act` 工具必须附 `idempotent?: true` 声明或说明（防误标）；`observe` 建议附 `windowNote`
- 参考域标注：`roster`/`custom_list_query`/`ip_location`/`crypto` = query；`rate_1h`/`group_distinct_1h` = observe；http_request = query（缺省）
- 编辑器契约（namespace/tools 下发）同步透传 semantics——verdict 模型登记页可展示算子语义徽标
- 测试：声明透传、缺省值、下发形状

## Y2 决策审计事件

```ts
export interface DecisionAuditEvent {
  decisionId: string;      // 幂等键；调用方未提供时运行时生成 uuid
  tenantId: string;
  key: string;             // 模型 key
  rev: string;
  inputHash: string;       // sha256(input)——数据最小化，原文存储属宿主策略
  output: unknown;         // 决策结论
  asOf?: string;           // 事件时间（ExecContext.eventTime；缺省 = 处理时间）
  processingTime: string;  // ISO
  requestId?: string;
  observed: Array<{ key: string; name: string; semantics: string; outcome: unknown; micros: number }>;
  // query/observe 的返回值快照 + 全部 UdfTrace 违例码——回放的 journal 来源
  performance?: string;
}
```

- `new DecisionRuntime({ onDecision?: (event: DecisionAuditEvent) => void })`——evaluate（含 trace 开关与否）完成后回调；持久化属宿主（verdict 审计表/日志管道）
- observed 快照是 Y3 journal 的数据来源：**observe/act 的 outcome 必须完整入事件**（回放确定性前提）
- 测试：事件形状、inputHash 稳定性、observed 完整性（query/observe/act 三类各一）

## Y3 replay 模式

```ts
// ExecContext 增加
replay?: {
  decisionId: string;  // 匹配审计事件
  asOf: string;        // 事件时间（query 工具的时钟）
  journal: Array<{ key: string; name: string; outcome: unknown }>;  // 来自审计事件 observed
};
```

- `query`：正常执行，UDF 内取 `getExecContext().replay.asOf` 作时钟（约定；RateStore 走 Y4）
- `observe`/`act`：**不重执行**——按 key+name 匹配 journal 返回 outcome；trace 记 `code: 'REPLAYED'`；**journal 缺失 → `{ error: { code: 'REPLAY_JOURNAL_MISS' } }` fail closed**（宁可回放失败，不可静默给出新值）
- 便捷入口：`runtime.evaluateReplay(auditEvent, inputOverrides?)`——从审计事件直接构造 replay 上下文
- 测试：observe 不重执行且值一致、journal 缺失 fail closed、query asOf 生效、混合图回放确定性（同 output）

## Y4 RateStore as-of 化（事件时间）

- 契约升级：`rate(entity, windowMs, asOf?)` / `groupDistinct(group, value, windowMs, asOf?)`——asOf 缺省 = 处理时间（现状兼容），显式传入 = 事件时间窗口
- InMemoryRateStore 已存时间戳数组（事实形态）——补 asOf 参数即可；**Redis 实现（verdict）必须按分数范围查询存事实记录（ZADD member=事件标识 score=eventTime），禁止仅存递增计数器**（否则回放永久丢失）
- conformance 套件增加回放用例：同 asOf 二次查询计数一致（窗口滑出场景）
- 热层澄清：HAProxy stick table 是 **observe 类热层**（处理时间、近似、原子），不实现 as-of、不冒充 RateStore——其回放走 Y3 journal

## Y5 CircuitBreaker 端口（执行规范补充）

- `CircuitBreaker` 端口 + `InMemoryCircuitBreaker`（per tenantId+udfName，连续失败阈值 → open → 半开探测）；打开时快速失败返回 `{ error: { code: 'CIRCUIT_OPEN' } }`（结构化通道，不破坏 containment）
- 注入：`new DecisionRuntime({ breaker })`；缺省无熔断
- 定位：与超时（舱壁单次）、并发闸（租户吞吐）互补的故障隔离第三件
- 测试：阈值开断、半开恢复、错误码

## Y6 OpenTelemetry 桥

- evaluate → 根 span（decisionId、modelKey@rev 属性）；customNode → 子 span；UdfTrace → span events
- `@opentelemetry/api` 作 peerDependency（宿主不装不启）；traceContext 传播依赖 Y 系列前已落地的 ALS 重建立——span 在 customNode 段不再断裂
- 测试：装内存 exporter 断言 span 树

## Y7 决策测试夹具运行器

- `runDecisionTests(runtime, { key, rev, model, fixtures })`：fixtures = `[{ name, input, expect }]`，基于 **Y3 回放语义**执行（效果型 UDF 用 journal 桩，可复现）
- 断言语义：结果深度匹配 / 字段路径匹配 / 谓词
- 输出：逐夹具通过与差异报告——verdict 模型登记页"发布前跑夹具"的执行引擎
- 测试：运行器自测 + 撞库图改造为夹具示例

## 信任模型（本系列的 verdict 设计重点）

```
声明（UdfPack 作者：semantics 三元）
  → 强制（运行时：回放不重执行、fail closed、超时/校验/熔断）
    → 证据（DecisionAuditEvent：inputHash + observed outcomes + 决策结论）
      → 重演（evaluateReplay 确定性重放，供客户核验）
```

客户问"这个拉黑是怎么决定的"：审计事件给出模型版本、输入哈希、各算子当时返回值；客户要求核验：`evaluateReplay` 当场重演一致。**隔离有副作用与无状态功能不是内部实现细节，而是可对客展示的信任凭证。**

## 待宿主确认

- **D11**：审计事件 `output` 字段是否记录完整决策结论（推荐：是——回放需要；敏感字段脱敏由宿主在 onDecision 持久化层处理，机制层不做有损截断）还是仅 outputHash
