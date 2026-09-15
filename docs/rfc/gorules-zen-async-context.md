# 上游 issue 跨运行时总结：gorules/zen customNode 回调的执行上下文丢失（Node ALS × Python contextvars）

> 状态：**总结稿就绪**——宿主手动探索确认后，将 §3 英文正文直接粘贴提交至 https://github.com/gorules/zen
> 复现探针：`packages/zen-udf/src/decision-runtime.test.ts` + `engine-cache-semantics.test.ts`（JS）· 仓库根 `zen-engine-contextvars-demo.py`（Python，`uv run --with zen-engine python zen-engine-contextvars-demo.py`）

---

# §1 宿主内部指引（中文）

- **实证覆盖**：JS（zen-engine 2.0.2 + NAPI TSFN，探针+生产回归双验证）与 Python（PyPI zen-engine + cpython-3.14，四场景矩阵实测）双侧均已完成
- **核心发现**：同一根因（上下文捕获绑定在引擎构造/原生派发，而非调用方）在两个运行时呈现**不对称失败**——Node 全丢，Python 仅异步丢（同步回调天然继承）
- **提交建议**：英文正文（§3）可直接粘贴；如上游倾向拆分，Node/Python 可拆为两个 issue 并互链
- 待并入：宿主手动探索的补充结论（contextvars 深层行为）

---

# §2 英文 issue 正文（paste-ready）

## Title

Async context (Node ALS / Python contextvars) is lost or bound at engine construction inside customNode callbacks — breaks multi-tenant isolation, OTel spans and request-scoped logging

## Summary

In both the Node.js and Python bindings, custom node callbacks run **outside the caller's async execution context**:

- **Node.js**: the customHandler is dispatched via a ThreadsafeFunction as a fresh macrotask — `AsyncLocalStorage#getStore()` returns `undefined` inside the callback, always.
- **Python**: **sync** handlers see the caller's `contextvars` (the pyo3 `call1` runs on the same thread inside the GIL), but **async** handlers are bound to `TaskLocals` captured **once at `ZenEngine` construction** — per-request `ContextVar.set()` is invisible to the handler, and concurrent evaluations read the same construction-time context.

Multi-tenant services therefore cannot propagate tenant identity/permissions into custom node functions; OpenTelemetry spans break at the customNode segment; request-scoped loggers lose bindings.

## Environment

- Node binding: `@gorules/zen-engine` 2.0.2 (napi-rs TSFN dispatch), Node 22/24
- Python binding: `zen-engine` (PyPI latest, pyo3), CPython 3.14
- Graph: minimal `inputNode → customNode → outputNode`

## Reproduction

### Node.js

```ts
import { AsyncLocalStorage } from 'node:async_hooks';
const als = new AsyncLocalStorage();

// customHandler: (request) => ({ output: { marker: als.getStore()?.marker ?? null } })

await als.run({ marker: 'x' }, () =>
  engine.create_decision(graph).evaluate({ x: 1 }, { trace: true }),
);
// handler sees marker === undefined (expected 'x') — always, sync or async handler
```

### Python

```python
import asyncio, contextvars
import zen

SESSION: contextvars.ContextVar[dict] = contextvars.ContextVar("session", default=None)

async def handler(request):
    sess = SESSION.get()
    await asyncio.sleep(0)
    return {"output": {"seen": sess}}

engine = zen.ZenEngine({"customHandler": handler})
decision = engine.create_decision(graph_json)

async def task(tid: str):
    token = SESSION.set({"tenant": tid})
    try:
        r = await decision.async_evaluate({"x": tid})
        return tid, r["result"]
    finally:
        SESSION.reset(token)

# concurrent two tenants on ONE engine instance
r1, r2 = await asyncio.gather(task("t-alpha"), task("t-beta"))
# both handlers see the SAME (construction-time) context — per-request set() invisible
```

## Empirical results

| Case | Node (ALS) | Python (contextvars, sync handler) | Python (contextvars, async handler) |
| --- | --- | --- | --- |
| sequential evaluate after `set()` | lost | **visible** ✓ | lost (construction-time context) |
| concurrent evaluations, per-request `set()` | lost / crossed | n/a (per-thread) | **crossed** — all read the same construction-time context |
| one engine instance per tenant context | n/a | isolated (thread-local) | **isolated ✓** (construction-time capture = instance-carried session) |
| workaround in host | embed context in input, re-establish ALS in callback (reserved input key channel) | n/a | multi-instance engines (one per context lifecycle) |

Node measured with `@gorules/zen-engine` 2.0.2; Python with the PyPI wheel on CPython 3.14.

## Root cause

- **Node** (`bindings/nodejs/src/custom_node.rs`): the handler is dispatched via `ThreadsafeFunction::call`, which schedules a fresh macrotask **without an `napi_async_context`** — Node cannot associate the callback with the context active at `evaluate()` time.
- **Python** (`bindings/python/src/engine.rs`): `make_locals()` (TaskLocals + `copy_context`) runs **once in `PyZenEngine::new`**; async handlers are resumed via `into_future_with_locals(task_locals, …)` with that construction-time context. Sync handlers escape the issue because `call1` executes on the calling thread inside the GIL, inheriting the caller's context.

Shared root cause: **the context capture/re-attach point is bound to engine construction or native dispatch, not to the caller of `evaluate`**.

## Impact

- Multi-tenant services cannot propagate tenant identity/permissions into custom node UDFs; hosts must resort to embedding context in the evaluation input through reserved keys and re-establishing ALS inside the callback
- OpenTelemetry: spans break at the customNode segment; **customNode-level child spans cannot be created** (hosts fall back to root span + side-channel events)
- Request-scoped logging (pino child, contextvars-based formatters) loses bindings inside custom nodes

## Proposed fixes

**Node bindings** (zero-API-change variant): at the synchronous JS→Rust entry of `evaluate`/`async_evaluate` (still inside the caller's async context), capture the context with `napi_async_init`, and dispatch the customHandler TSFN callback via `napi_make_callback` carrying that context; `napi_async_destroy` after evaluate. Alternative: expose an `asyncResource` option on `ZenEvaluateOptions`.

**Python binding**: re-capture `TaskLocals` (running loop + `copy_context`) **inside each `evaluate`/`async_evaluate` call** instead of once at engine construction, so async handlers resume in the caller's context. Alternative: accept an explicit context argument per call.

Both fixes make handler-visible context a per-request concern (what multi-tenant services require) and are backward-compatible positive behavior changes (changelog-worthy).

## Acceptance criteria

1. Sync-path probe: value set via ALS/`ContextVar.set()` before `evaluate` is visible inside the customHandler (Node async path included)
2. Concurrent evaluations with distinct contexts never cross (each handler sees its own context)
3. A span started by the host inside `evaluate` (`startActiveSpan`) is visible as `trace.getSpan(context.active())` inside the customHandler (child spans continue)
