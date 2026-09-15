# 术语表

> jdm-editor 仓库与 zen-udf 的域术语对照表。跨仓消费者（verdict / editor）和
> 新团队成员的查词入口。按主题分组。

## 决策图模型（JDM）

| 术语 | 含义 |
| --- | --- |
| JDM | JSON Decision Model——zen-engine 的决策图 JSON 格式 |
| inputNode | 决策图入口节点（必须有且仅有一个） |
| outputNode | 决策图出口节点（必须有至少一个） |
| decisionTableNode | 决策表节点：按行匹配（hitPolicy）→ 输出列 |
| expressionNode | 表达式节点：ZEN 表达式语言计算 |
| functionNode | 函数节点：JMESPath 表达式 |
| customNode | 自定义节点：执行宿主注册的 UDF（本仓核心扩展点） |
| switchNode | 条件路由节点 |
| sourceId / targetId | 边的起止节点 id（zen 2.0 schema） |

## zen-udf 核心概念

| 术语 | 含义 | 代码位置 |
| --- | --- | --- |
| **DecisionRuntime** | 决策图运行时：包装 ZenEngine、持有 L1 缓存、注入 customHandler | `src/engine.ts` |
| **UdfRegistry** | UDF 注册表：注册/查找/绑定/调用/schema 下发 | `src/register.ts` |
| **UdfPack** | 业务函数包契约：namespace + tools[]，deploy-time 注入 | `src/register.ts` |
| **ExecContext** | 执行上下文：`{ tenantId, userId?, requestId?, eventTime?, replay?, shadow? }` | `src/exec-context.ts` |
| **L1 缓存** | 宿主自管决策缓存：LRU + 空闲 TTL + 指标，键 `${tenantId}:${key}@${rev}` | `src/decision-cache.ts` |
| **语义三元** | 算子副作用分类：`query`（纯读）/ `observe`（观测累积）/ `act`（处置效果） | 见 Y 系列计划 §1 |
| **journal** | 审计事件 `observed[]` 中的返回值快照——回放时 observe/act 读此值而非重执行 | `DecisionAuditEvent.observed` |
| **保留键** | `__zen_udf_exec_ctx__`——ExecContext 经输入嵌穿越 TSFN 边界的通道 | `src/engine.ts` |
| **shadow evaluation** | 影子评估：新旧 rev 并行执行 + 字段级 diff，act 影子侧返回 intent 占位 | `src/engine.ts` `evaluateShadow` |
| **哨兵测试** | 钉住第三方依赖的关键行为，升级时行为变化 → 测试先红 → 强制评估 | `src/engine-cache-semantics.test.ts` |

## UDF 生命周期阶段

| 阶段 | 含义 | 运行时行为 |
| --- | --- | --- |
| `query`（缺省） | 纯读取，无状态变更 | 正常执行；回放时以 asOf 重算 |
| `observe` | 观测累积（计数/去重）——含当前事件 | 正常执行；回放时读 journal 不重执行 |
| `act` | 处置动作（拉黑/通知/扣款） | 执行并 journal outcome；回放时读 journal；须声明 `idempotent` |

## 端口（宿主实现，机制在 zen-udf）

| 端口 | 用途 | 参考实现 | 生产实现 |
| --- | --- | --- | --- |
| RateStore | 滑动窗口频控 | InMemoryRateStore（开发态） | Redis（verdict） |
| ConcurrencyLimiter | per-tenant 并发闸 | InMemoryConcurrencyLimiter（FIFO） | Redis 信号量 |
| CircuitBreaker | 熔断 | InMemoryCircuitBreaker | 分布式熔断 |
| EgressGuard | http UDF 出口 allowlist | 未配置 = 全放行 | verdict allowlist |
| SecretResolver | `${secret:名称}` 按租户解析 | 未配置 = secret 引用报错 | verdict 密钥管理 |

## 构建与发布

| 术语 | 含义 |
| --- | --- |
| 源码直通 | workspace 包被仓内 app 直接 import src（绕过 dist），消除了副本漂移问题 |
| 哨兵测试 | 钉住第三方依赖的关键行为，升级时行为变化 → 测试先红 |
| 契约测试套件 | 端口接口 + 工厂函数 + 共享断言——所有实现必须通过同一套测试 |
| chore(release) | 提交头部以此开头触发 CI publish.yaml 自动发布 npm 包 |
| test:zen-udf-smoke | npm pack → 临时安装 → Bun 跑最小执行链路——发布前最后一道闸 |

## 工具链

| 术语 | 说明 |
| --- | --- |
| **Bun** | zen-engine 原生绑定要求 Bun 工具链（Node 24 下 zen-engine 0.54 崩溃；2.0.2 部分场景兼容） |
| **pnpm workspace** | monorepo 包管理；catalog 统一版本约束 |
| **rspress** | docs 站点生成器（root = docs/，自动索引 .md 文件树） |
| **TSFN** | N-API ThreadsafeFunction——Rust→JS 回调派发机制；ALS/contextvars 不跨此边界 |
