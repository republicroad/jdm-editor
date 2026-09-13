# 上游贡献草案：gorules/zen —— AsyncLocalStorage 不跨 customHandler TSFN 边界

> 状态：draft · 待宿主审阅后提交至 https://github.com/gorules/zen（issue → PR）
> 复现包：`packages/zen-udf`（`src/engine-cache-semantics.test.ts` 同型探针；U5 回归测试 `src/decision-runtime.test.ts`）

## 标题

AsyncLocalStorage context is lost inside customHandler callbacks (TSFN dispatches on the main event loop without an async context)

## 现象

Node 侧宿主代码：

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
const als = new AsyncLocalStorage();

await als.run({ tenantId: 't-1' }, async () => {
  await engine.evaluate('decision-key', input, { trace: true });
  // 在 evaluate 期间，Rust 经 TSFN 回调 customHandler
});
```

customHandler 回调体内 `als.getStore()` 返回 **undefined**——回调由 napi ThreadsafeFunction 调度为主线程上的新宏任务，未包装在任何 async context 中。任何依赖 ALS 的生态（OpenTelemetry context、请求作用域日志 pino child、租户隔离）在 customNode 执行期间全部失效。

## 根因

`bindings/nodejs/src/custom_node.rs`（及 loader/http_handler 同型）通过 `ThreadsafeFunction::call` 派发回调；napi-rs 的 TSFN 调度不携带 `napi_async_context`，Node 因此无法把回调关联回发起 `evaluate` 时的执行上下文。

## 建议修复（变体 A，零 API 变更）

在 `ZenDecision::evaluate` / `ZenEngine::evaluate_with_opts` 的**同步 JS→Rust 入口**处（此时仍在调用方 async context 内）：

1. `napi_async_init(env, resource, name, &ctx)` 捕获当前 async context（resource 可为 `Object`，name 如 `"zen-engine.evaluate"`）；
2. customHandler TSFN 派发回调时，改用携带该 context 的 make_callback（`node_api_make_callback` / napi-rs 对应能力），回调即在调用方 ALS zone 内执行；
3. evaluate 完成后 `napi_async_destroy` 释放。

变体 B（显式 API）：`ZenEvaluateOptions` 增加 `asyncResource?: AsyncResource`，由宿主传入，绑定层用它 runInAsyncScope 派发——更显式但增加 API 面。

两个变体均不影响其它绑定（Python/Go 无 ALS 概念）；JS 侧行为变化为正向（回调内 ALS 可用），建议 changelog 标注。

## 影响

- 多租户服务端无法把租户身份透传进 customNode 的 UDF（当前只能通过在输入里嵌入上下文、回调内重建 ALS 的旁路实现——见宿主仓 `packages/zen-udf/src/engine.ts` 的 `__zen_udf_exec_ctx__` 通道）
- OpenTelemetry span 在 customNode 段断裂（当前上下文无法跨越 TSFN）
- 请求作用域日志（pino request-child 等）在 customNode 段丢失绑定

## 复现要点

1. 构造含 customNode 的最小图，customHandler 注册探针 UDF；
2. `als.run({ marker: 'x' }, () => decision.evaluate(...))`；
3. 探针 UDF 内 `als.getStore()?.marker` → undefined（期望 'x'）。

修复验收：同探针 marker === 'x'；并发多 context evaluate 各自不串号。
