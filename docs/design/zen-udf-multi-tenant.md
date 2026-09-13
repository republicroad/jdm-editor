# zen-udf 多租户最佳实践设计

状态：design · confirmed（宿主 2026-09-13 确认：按本设计分期落地，包名改为 `zen-udf`）

## 0. 结论输入：zen-engine 2.0.2 缓存语义（探针实证）

探针源码：`src/engine-cache-semantics.test.ts`（已固化为升级哨兵）。基于 @gorules/zen-engine 2.0.2，Bun 工具链。

| 路径 | 引擎缓存 | 实证 |
| --- | --- | --- |
| `engine.evaluate(key)`（函数 loader） | ❌ 每次回调 loader + 重新解析，不回写 | 2 次 evaluate → loader 调用 2 次 |
| `engine.getDecision(key)` | ❌ 同上（且绕过 CompiledSet） | 2 次 getDecision → 2 次 |
| static/zip loader + `compile()` | ✅ 预编译进 CompiledSet（`ArcSwap`） | reload/compileFailures 可用 |
| `engine.createDecision()` → 复用 `ZenDecision` | ✅ 解析一次，evaluate N 次 | 自管缓存唯一正路 |
| customNode 对缓存的影响 | 无（config 对编译期不透明） | 缓存决策复用不受影响 |

**真图成本**（撞库攻击防御.json，34.2KB）：每次重建 1.04ms/次 vs 缓存实例 0.17ms/次（**6 倍**），纯 JSON.parse 0.06ms。QPS 越高放大越狠——多租户下的宿主自管缓存是**架构必需**，不是优化项。

源码结论（gorules/zen）：绑定层函数 loader（`DecisionLoader`）无 HashMap；核心层唯一缓存 `CompiledSet` 只由显式 `compile()` 填充，而函数 loader 无 `keys()`，`compile()` 空转。customNode 每次执行跨 Rust→JS 边界（napi TSFN）回调 `customHandler`，为 per-call 固定开销。

## 1. 目标与非目标

目标：
- 租户间数据隔离（执行上下文、名单、频控、出口 HTTP）
- 编译产物缓存：版本化、可热更新、有界、可观测
- 水平可扩展：有状态 UDF 外置，编译缓存进程内
- 为 verdict model execute（`modelId:v{rev}` 模式）提供执行层原型

非目标：
- 跨进程编译缓存（内容中心化 + revision 即可保证一致性）
- 图内容存储本身（属宿主/verdict 内容层）

## 2. 分层模型

```
L0 内容存储   DB/对象存储：tenant_id + model_key + rev（不可变三元组）
L1 编译缓存   进程内 Map<`${tenantId}:${key}@${rev}`, ZenDecision>（LRU 有界）
L2 执行上下文 AsyncLocalStorage { tenantId, userId, requestId }
L3 数据面 UDF roster / rate-window / http / custom-list-query（按 L2 隔离）
```

依赖方向：L3 读 L2，L1 建立时注入静态增强（graphAddons），运行期不携带租户身份——**编译产物租户无关（同租户同模型共享），数据面租户相关**。

## 3. 缓存设计（L1）

- **键**：`${tenantId}:${key}@${rev}`——不可变版本键，与 verdict `modelId:v{rev}` 对齐。rev 进键意味着"更新 = 新键"，天然规避失效竞态
- **写**：`createDecision(graphAddons(content))` 构建新 `ZenDecision` 后 `map.set`；绝不原地修改已编译实例
- **驱逐**：LRU 上限（默认 500 条/进程，按 `tenant:key@rev` 计数）+ 可选空闲 TTL。in-flight evaluate 持有对象引用，驱逐后由 GC 兜底，无需等待
- **失效**：发布事件（rev 变更）→ `delete` 旧键；不做 TTL 猜测
- **指标**：hits / misses / evictions / size / build耗时（per tenant）
- **禁用路径**：禁止 `engine.evaluate(key)` / `engine.getDecision(key)`（实证无缓存且绕过 graphAddons 增强）；全量走自管缓存

## 4. 执行上下文（L2）

- `runWithExecContext({ tenantId, userId, requestId }, fn)` 贯穿 evaluate → customHandler → UDF（现 ExecContext 加 `tenantId`）
- **ALS 边界限制**：AsyncLocalStorage 不跨 zen-engine 的 Rust worker → TSFN 回调边界存活——当前以输入保留键（`__zen_udf_exec_ctx__`）携带 ExecContext 并在回调内重建立；详见 [zen-udf-context-propagation.md](./zen-udf-context-propagation.md)（含绑定层原生传播提案）
- `customHandler` 与 UDF 内经 `getExecContext()` 取租户；UDF **禁止**从图 config 读租户身份（防图内容带租户数据跨租户复制）
- 请求级超时：`ZenConfig.functionTimeoutMillis` + http UDF 的 kwargs.timeout；外层调用方持 AbortSignal

## 5. 数据面 UDF 多租户化（L3）

| UDF 域 | 现状 | 多租户改造 |
| --- | --- | --- |
| roster / custom-list-query | owner = userId actor，自有遮蔽共享 | owner 语义升级为 `tenantId` 作用域 + actor 可见性（自有 > 租户共享 > 不可见他人）；查询经 L2 自动隔离 |
| rate-window | 进程内滑动窗口（单实例语义） | 抽 `RateStore` 接口（incr/window/peek）；进程内实现保留为开发态，生产注入 Redis 实现（宿主层提供） |
| ip-location | 只读本地数据 | 无租户维度，共享 |
| http | 方法白名单/超时/重试/认证 | 增 per-tenant 出口域名 allowlist（防 SSRF）+ 并发预算；认证 secret 按 tenant 从宿主注入，**禁止写进图内容** |

## 6. 自定义节点与函数执行规范（下一阶段完善清单）

现状已有：expr_asts 多实例协议、`;;` 引号感知分隔、funcBindParams 位置绑定 + 默认值回退、错误 containment（UDF 报错降级为 `{error}` 不中断图）。

真实业务高频缺口（按优先级）：

1. **参数校验**：入参按 `parametersSchema` 校验（类型/必填/enum），违例返回 `{error:{code:'INVALID_PARAM', path}}`——当前只有类型归一化，不校验
2. **超时与取消**：`kwargs.timeout` 约定推广到所有 UDF（http 已有）；超时返回结构化错误而非挂起 worker
3. **并发配额**：per-tenant UDF 并发闸（信号量），防单租户打满 evaluate worker 线程池
4. **注册期冲突硬失败**：函数名/namespace 撞名由 console.warn 升级为注册时抛错（保留显式 override 逃生口）
5. **返回值契约**：按 `returnsSchema` 断言/归一化，违例计入 trace
6. **UDF 级 trace**：耗时、错误码、重试次数写入 `traceData`（simulator 与 verdict 审计共用）
7. **表达式错误脱敏**：`evaluateExpressionSafe` 的异常信息出 trace 前过脱敏层

## 7. 多副本部署

- 编译缓存（L1）进程内即可——内容中心化（L0）保证副本间一致性，无需分布式缓存
- 有状态 UDF（rate-window 运行时写入、roster 运行时写入）→ Redis 化（L3 接口化后由宿主注入）
- 扩容：无状态副本直接加；发布失效事件广播各副本 delete 旧键

## 8. 与 verdict 的衔接

- 本设计缓存键 `${tenantId}:${key}@${rev}` 即 verdict `modelId:v{rev}` 的租户化展开
- verdict M2（graphs-http-adapter 兼容层）之上，model execute 服务直接复用 zen-udf facade：`getDecision(tenant, key, rev)` / `evaluate(tenant, key, rev, ctx)`
- UDF schema 下发（`udfFunctionSchemaNamespaces`）供 verdict 的模型登记页展示自定义节点能力

## 9. 分期

| 期 | 内容 | 状态 |
| --- | --- | --- |
| M1 | 包名 zen-rule → zen-udf；缓存语义哨兵测试；本设计 | 本次 |
| M2 | ExecContext 加 tenantId；L1 缓存 LRU + 指标；roster 租户化 | 待开发 |
| M3 | RateStore 接口 + Redis 宿主实现；规范清单 §6.1–§6.4 | 待开发 |
| M4 | verdict model execute 接入（facade 定型） | 待开发 |
