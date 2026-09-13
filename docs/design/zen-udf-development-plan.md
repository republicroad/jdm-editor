# zen-udf 开发计划（U 系列）

状态：plan · confirmed（宿主 2026-09-13 裁决 D1–D3，见文末）
上游设计：[zen-udf-multi-tenant.md](./zen-udf-multi-tenant.md)（M1 已完成：包名、缓存语义哨兵、设计稿）

## 总览

| 期 | 内容 | 依赖 | 仓 |
| --- | --- | --- | --- |
| U2 | ExecContext 贯通 tenantId | — | jdm-editor |
| U3 | 实例注入重构（handler 实例化 + 撞名硬失败） | — | jdm-editor |
| U4 | L1 决策缓存：LRU + 指标 | U2 | jdm-editor |
| U5 | roster 租户化 | U2 | jdm-editor |
| U6 | UdfPack 契约定形 + createUdfManager | U3 | jdm-editor |
| U7 | 执行规范强化（参数校验/超时/并发闸） | U6 | jdm-editor |
| U8 | RateStore 端口 + conformance 测试 | U2 | jdm-editor（接口）；Redis 实现住 verdict |
| U9 | http UDF 加固（egress/secret 端口） | U2 | jdm-editor |
| U10 | verdict 接入（业务包 + model-execute） | U4 U6 U8 | verdict |

建议执行序：U2 → U3 → U4 → U6 → U5 → U7 → U8 → U9 → U10。
每期门禁：bun test 全绿、biome lint、tsc 清洁、根仓 verify；测试数只增不减（现 32）。

## U2 执行上下文贯通 tenantId

- `exec-context.ts`：`ExecContext` 加 `tenantId`；`runWithExecContext` 签名同步
- `ZenRule.evaluate/evaluateAsync`：要求 ctx 携带 tenantId（单租户 CLI 场景提供显式 opt-out 常量）
- 测试：并发双租户 AsyncLocalStorage 隔离；无 tenantId 的显式报错路径
- 验收：现有 contrib 测试全部迁入租户上下文语义运行

## U3 实例注入重构

- `engine.ts`：`customHandlerFunc` static → 实例方法；`ZenRule` 实例持有 `udfManager`
- 副作用 `import './contrib/*.ts'` → 显式装载开关 `builtin: 'none' | 'reference'`（默认 `reference` 保持现行为）
- 全局 `udfManager` 单例保留为默认值（demo-server/playground 兼容，零迁移成本）
- 注册撞名：`console.warn` → `throw`（保留 `force` 逃生口）
- 测试：多 ZenRule 实例 UDF 域互不污染；撞名抛错；默认构造行为不变
- 依赖：无（与 U2 可并行）

## U4 L1 决策缓存

- 新 `decision-cache.ts`：键 `${tenantId}:${key}@${rev}`、LRU 上限（默认 500）、hit/miss/eviction/build 耗时计数
- 指标 sink 可注入（默认内存计数器；verdict 后接 Prometheus）
- `ZenRule` 的 `decisionCache`/`contentCache`/`getDecision` loader 兜底路径全部迁入；禁用 `engine.evaluate(key)` 路径（代码层移除便捷入口，文档标注）
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
