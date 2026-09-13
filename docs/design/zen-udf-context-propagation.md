# zen-udf 执行上下文跨边界传播：现状与绑定层原生传播提案

状态：design · 现状方案已 shipped（输入保留键通道，回归测试钉死）；绑定层原生传播为提案（upstream 路线）
关联：[zen-udf-multi-tenant.md](./zen-udf-multi-tenant.md) §4 · [zen-udf-development-plan.md](./zen-udf-development-plan.md) U5

## 1. 问题定义：ALS 为何在 TSFN 边界丢失

AsyncLocalStorage 的传播机制：异步操作在 ALS zone 内创建时，Node 通过 async_hooks 把 store 挂到新异步资源上。它只在**纯 JS 异步链**内自动传播。

zen-engine 的 customNode 执行路径：

```
JS: als.run(ctx, () => decision.evaluate(...))    ← ALS zone 有效
      └─ N-API 同步调用进入 Rust worker 线程        ← 边界 ①：离开 JS
          └─ Rust 经 TSFN 派发 customHandler 回调    ← 边界 ②：TSFN.call
              └─ JS 回调在主线程作为"新宏任务"执行    ← ALS store 为空（确定性）
```

TSFN（napi ThreadsafeFunction）回调由原生代码调度，不经过任何 JS 异步资源包装——回调落在"无上下文"的默认 async context 中。**探针实证**（U5，2026-09-13）：customNode 内 `getExecContext()?.tenantId` 恒为 null，与宿主是否包裹 `runWithExecContext` 无关。

附带发现：U5 之前旧测试未暴露该问题，是因为旧 roster 的 admin 兜底（actor 缺失时遍历全部作用域）掩盖了上下文丢失——租户化（fail closed）后问题现形。

## 2. 当前实现现状（shipped）：输入保留键通道

采用业界跨边界标准模式 **capture → embed → re-materialize → sanitize**：

| 步骤 | 实现 | 位置 |
| --- | --- | --- |
| Capture | `evaluate` 入口在 ALS zone 内同步取 `getExecContext()` | `engine.ts` |
| Embed | 以保留键 `__zen_udf_exec_ctx__` 嵌入输入对象（常量 `EXEC_CONTEXT_INPUT_KEY`） | `engine.ts` `enrichInputWithExecContext` |
| Re-materialize | `handleCustomNode`（TSFN 回调）提取后 `runWithExecContext(ctx, execute)` 重建立 zone | `engine.ts` |
| Sanitize | passThrough 输出剥离保留键；`$nodes` 既有剥离逻辑同型 | `engine.ts` |

关键性质：

- **并发安全**：ctx 随每个请求的输入走，不挂在 runtime 实例字段上——混合租户并发 evaluate 同一 runtime 无串号竞态（这正是拒绝"实例字段捕获"方案的原因）。
- **fail closed**：非对象输入（数组/原始值）无法承载保留键 → UDF 内无上下文 → 数据面 UDF（roster/custom_list_query）返回否定结果；缓存操作直接抛错。
- **回归钉死**：`decision-runtime.test.ts`「ExecContext 经输入保留键贯穿 TSFN 边界」断言 UDF 内可读 tenantId/userId。

残余风险（当前接受，见 §5 加固项）：

- ctx 以**引用**进入 UDF zone——模型是宿主编写（可信面）；不信任模型作者时应嵌入冻结副本。
- trace 载荷可能含保留键（宿主自己的数据，无跨租户暴露面）。
- 数组/原始值输入不承载（文档化约定：多租户服务端用对象输入）。

## 3. 绑定层原生传播（提案）：让 napi 绑定自己跨越边界

### 3.1 原理

Node N-API 原生提供跨回调的 async context 传播：`napi_async_init` 在**调用方 context 尚未离开时**（即 JS→Rust 的同步调用点）捕获 async resource，之后每次派发回调改用 `napi_make_callback(env, async_context, ...)` 而非裸 TSFN 调度——回调即在原 ALS zone 内执行，宿主 `als.run()` 自然生效。JS 侧等价物是 `AsyncResource` + `runInAsyncScope`。

### 3.2 落点与变体

上游仓：`gorules/zen` → `bindings/nodejs/src`（custom_node.tsfn 派发处 + engine.rs evaluate 入口）。

- **变体 A（推荐，零 API 变更）**：绑定层在 `ZenDecision::evaluate` 的同步入口处自动 `napi_async_init` 捕获当前 async context（此时调用方在 ALS zone 内），存入引擎调用态；customHandler TSFN 回调派发改走带 context 的 make_callback。宿主无感。
- **变体 B（显式 API）**：`ZenEvaluateOptions` 增加可选 `asyncResource`/`contextCarrier`，由宿主传入 AsyncResource。显式但增加 API 面。

### 3.3 收益与成本

收益：
- 宿主零成本——ALS 对 customNode 内 UDF 自然生效，OpenTelemetry 等依赖 ALS 的生态同样自然贯通（trace/span 不再需要旁路通道）。
- 所有 zen-engine 用户受益；输入保留键通道退化为冗余保险。

成本/风险：
- 依赖上游（GoRules）接受与发版节奏；napi-rs `ThreadsafeFunction` 抽象需要改动或绕行（手写 `sys` 层调用）。
- `napi_async_init`/`napi_async_destroy` 生命周期须严格配对；并发 evaluate 的 context 捕获/派发语义需要仔细设计（每请求一个 context，与我们的输入通道同构）。
- 行为变化对既有用户可见（UDF 内突然"能看到" ALS 了）——属正向变化，但需 changelog 标注。

### 3.4 兼容性

上游若实现原生传播，本仓的保留键通道**向后兼容且互不冲突**：handleCustomNode 提取到保留键则重建立（现状），未提取到则依赖原生传播（新行为）。宿主代码与测试无需变更；可保留一条"无保留键也能传播"的开关式验证，作为上游生效的验收。

## 4. 行动项

| 阶段 | 动作 | 状态 |
| --- | --- | --- |
| 短期 | 保留输入保留键通道（已 shipped，回归测试覆盖） | ✅ |
| 中期 | 向 gorules/zen 提 issue：附 ALS 丢失探针（`engine-cache-semantics.test.ts` 同型）与本提案；争取变体 A | 待发起 |
| 上游合入后 | 验证原生传播生效；保留键通道转冗余保险；文档更新 | 依赖上游 |
| 加固（可选） | 嵌入冻结 ctx 副本（`Object.freeze`）；混合租户并发图执行断言各自 tenantId | 待定 |
