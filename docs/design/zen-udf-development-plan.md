# zen-udf 开发计划（U 系列）

状态：shipped · U2–U9 全部完成（2026-09-13，测试 87/87；U10 verdict 侧待启动）
上游设计：[zen-udf-multi-tenant.md](./zen-udf-multi-tenant.md)（M1 已完成：包名、缓存语义哨兵、设计稿）

## 总览

| 期 | 内容 | 依赖 | 仓 | 状态 |
| --- | --- | --- | --- | --- |
| U2 | ExecContext 贯通 tenantId | — | jdm-editor | ✅ d59a729d |
| U3 | 实例注入重构（handler 实例化 + 跨名撞名硬失败） | — | jdm-editor | ✅ 9da30880 |
| U4 | L1 决策缓存：LRU + 指标 | U2 | jdm-editor | ✅ c68d0a16 |
| U5 | roster 租户化 | U2 | jdm-editor | ✅ f844a62b |
| U6 | UdfPack 契约定形 + createUdfRegistry | U3 | jdm-editor | ✅ b0be3be6 |
| U7 | 执行规范强化（参数校验/超时/并发闸） | U6 | jdm-editor | ✅ 1687b0d0 |
| U8 | RateStore 端口 + conformance 测试 | U2 | jdm-editor（接口）；Redis 实现住 verdict | ✅ bbd102f5 |
| U9 | http UDF 加固（egress/secret 端口） | U2 | jdm-editor | ✅ bf547dfb |
| U10 | verdict 接入（业务包 + model-execute） | U4 U6 U8 | verdict | 待启动 |

> U5 附带关键发现：AsyncLocalStorage 不跨 zen-engine 的 Rust worker → TSFN 回调边界存活；
> DecisionRuntime 以输入保留键（`__zen_udf_exec_ctx__`）携带 ExecContext 并在 customNode
> 回调内重建立上下文（回归测试钉死该语义）。
每期门禁：bun test 全绿、biome lint、tsc 清洁、根仓 verify；测试数只增不减（现 32）。

## U2 执行上下文贯通 tenantId

- `exec-context.ts`：`ExecContext` 加 `tenantId`；`runWithExecContext` 签名同步
- `DecisionRuntime.evaluate/evaluateAsync`：要求 ctx 携带 tenantId（单租户 CLI 场景提供显式 opt-out 常量）
- 测试：并发双租户 AsyncLocalStorage 隔离；无 tenantId 的显式报错路径
- 验收：现有 contrib 测试全部迁入租户上下文语义运行

## U3 实例注入重构

- `engine.ts`：`customHandlerFunc` static → 实例方法；`DecisionRuntime` 实例持有 `UdfRegistry`
- 副作用 `import './contrib/*.ts'` → 显式装载开关 `builtin: 'none' | 'reference'`（默认 `reference` 保持现行为）
- 全局 `globalUdfRegistry` 单例保留为默认值（demo-server/playground 兼容，零迁移成本）
- 注册撞名：`console.warn` → `throw`（保留 `force` 逃生口）
- 测试：多 DecisionRuntime 实例 UDF 域互不污染；撞名抛错；默认构造行为不变
- 依赖：无（与 U2 可并行）

## U4 L1 决策缓存

- 新 `decision-cache.ts`：键 `${tenantId}:${key}@${rev}`、LRU 上限（默认 500）、hit/miss/eviction/build 耗时计数
- 指标 sink 可注入（默认内存计数器；verdict 后接 Prometheus）
- `DecisionRuntime` 的 `decisionCache`/`contentCache`/`getDecision` loader 兜底路径全部迁入；禁用 `engine.evaluate(key)` 路径（代码层移除便捷入口，文档标注）
- 测试：LRU 驱逐序、in-flight 驱逐安全（GC 兜底）、原子替换、命中率断言
- 依赖：U2

## U5 roster 租户化

- `roster.ts`：owner 语义升级为 `{ tenantId, actor? }` 作用域；可见性规则：自有 > 租户共享 > 不可见他人；管理员（无 actor）遍历本租户全域
- `custom-list-query.ts` / roster UDF 经 ExecContext 取租户，禁止从图 config 读
- 测试：跨租户不可见、共享域遮蔽、删除权限矩阵
- 依赖：U2

## U6 UdfPack 契约定形

- 导出 `UdfPack`/`UdfToolDef`（自 `ContribToolDef` 进化，`defineContrib`/`defineTool` 保留兼容别名）
- `createUdfManager({ packs, builtin })` 构建器；`validatePack()` 注册前校验（schema 形状、name/namespace 冲突 dry-run）
- 实例级 `udfFunctionSchemaNamespaces()` 保证可下发（brdeapi namespace/tools 形状断言测试）
- 测试：pack 注册 → 校验 → 下发 round-trip
- 依赖：U3；完成后发 `@republicroad/zen-udf@0.2.0`（公开机制包，无业务语义）供 verdict 开发

## U7 执行规范强化（设计稿 §6.1–§6.4）

- §6.1 参数校验：`funcBindParams` 后按 `parametersSchema` 校验，违例返回 `{error:{code:'INVALID_PARAM', path}}`
- §6.2 超时约定：`kwargs.timeout` 推广为全 UDF 约定（http 已有）；超时返回结构化错误
- §6.3 并发闸：`ConcurrencyLimiter` 端口（内存参考实现，per-tenant 信号量）；verdict 注入真实实现
- §6.4 撞名抛错收尾（若 U3 未覆盖 namespace 维度）
- 测试：违例参数结构化错误、超时不挂起 worker、并发闸公平性（FIFO）
- 依赖：U6

## U8 RateStore 端口

- `rate-window.ts` 抽 `RateStore` 接口（incr/window/peek）；进程内实现保留为开发态
- **接口 conformance 测试套件**：内存实现必须全过；verdict 的 Redis 实现复用同一套测试（契约即测试）
- Redis 实现不住本仓（ioredis 依赖重，符合机制/策略分界）——待宿主确认 D1
- 依赖：U2

## U9 http UDF 加固

- `EgressGuard` 端口（默认 allow-all 参考实现）：per-tenant 出口域名 allowlist，防 SSRF
- secret 解析端口：图内 `auth` 支持 resolver 引用，真实凭证按 tenant 经 ExecContext 解析，**不进图内容**
- 测试：allowlist 拦截、secret 不落 trace/错误信息
- 依赖：U2；可与 U5–U8 并行

## U10 verdict 接入（verdict 仓，非本仓范围）

- `@verdict/udf-pack` 出生：fraud/logistics 首批函数域（UdfPack 契约）
- PostgreSQL 内容存储（rev 化）= L0；model-execute 服务组装 `new DecisionRuntime({ packs })` + Prometheus sink
- Redis RateStore / ConcurrencyLimiter / EgressGuard / SecretResolver 真实实现，跑 U8 conformance 套件
- 依赖：U4 U6 U8；zen-udf ≥0.2.0

## 发布与版本策略

- 0.1.x：当前（M1 收尾态）
- 0.2.0（U6 后）：UdfPack 契约 + 实例注入，首次供 verdict 消费（宿主已确认发布 npm 公开仓）
- 1.0.0（U8/U9 后）：端口面（RateStore/ConcurrencyLimiter/EgressGuard/SecretResolver）冻结

## 宿主裁决（2026-09-13 已确认）

- **D1** ✅：Redis RateStore 实现住 **verdict 仓**——本仓只出接口 + conformance 测试套件，ioredis 等存储依赖不进 jdm-editor
- **D2** ✅：zen-udf 0.2.0 **发布 npm 公开仓**（纯机制无业务；contrib 参考域随包发布）
- **D3** ✅：contrib 参考域**暂时保留**为 `builtin: 'reference'`，M3 后拆出独立私有包

## 场景节点路线图（宿主裁决 2026-09-17）

**裁决**：LLM 不进高频决策路径（延迟/成本/非确定性）。分期：**先高频决策件 →
再 durable 任务 → 最后 LLM**。

落位规则：零场景语义的通用件落 zen-udf contrib；业务语义件落各场景 UdfPack（verdict 仓）；
端口类先定 conformance 契约、实现住宿主（D1 同款分界）。

### P1 高频决策件（当前优先）

| 件 | 落点 | 场景 |
| --- | --- | --- |
| validate_cn / geo_distance / template / datetime（规格已对齐） | contrib | 全场景 |
| **velocity**（多事件滑窗聚合，rate-window 泛化） | contrib | 风控/营销/支付共用底座 |
| ab_bucket（哈希分桶） | contrib | 营销，零成本 |
| audience_match（人群包 = roster 复用） | roster 复用 | 营销 |
| id2/bank4 核验、ip_risk、device_fp、case_write | fraudPack（verdict） | 风控 |
| coupon_validate/issue（act+幂等）、price_calc | marketingPack（verdict） | 营销 |

### P2 durable 任务（异步/长时副作用）

act 类副作用（通知补发、报表拉取、外部 API 重试）从同步路径剥离为持久化任务。
已有地基：act 语义 + 审计 journal（Y2/Y3）+ decisionId 幂等去重——durable 化本质是
给 journal 补一个"待执行队列"投影。设计待 P1 稳定后展开。

### P3 LLM（最后）：离线/半离线审批流模式

宿主裁决（2026-09-17）：LLM 适合做**离线或半离线的审批流**——做完高频决策流后再补充。
届时为**双模式架构**：

- **共享一套内核**：DecisionRuntime / 注册表 / 端口面 / 三形态调用 / trace 审计全部复用，
  不分叉引擎；
- **在自定义节点与画布上做隔离**：审批流模式引入 LLM 节点族与人在环节点（审批人/会签），
  自定义节点目录按模式下发（mode-scoped catalog），画布按模式呈现各自的节点族与校验规则
  （如审批流允许长时挂起节点，高频流禁入）。

隔离的机制基础已预埋：UdfPack 天然是 mode-scoped catalog 的载体（按模式装配不同 pack），
编辑器 schema 下发（`udfFunctionSchemaNamespaces`）按注册表实例过滤即可。详细设计待
P1/P2 落定后展开。
