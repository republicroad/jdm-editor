"""
zen-engine Python 绑定 × contextvars 实证 demo（多实例 / 多租户 session 隔离）

对应 JS 侧结论（packages/zen-udf）：Node 的 AsyncLocalStorage 不跨
zen-engine Rust worker → TSFN 回调边界。本 demo 实证 Python contextvars
在 zen-engine Python 绑定的 customNode 回调中的行为，用于上游 issue 的
跨运行时对照总结。

源码推演（bindings/python/src/engine.rs）：
  TaskLocals（事件循环 + 上下文副本）在 ZenEngine 构造时一次性捕获
  （make_locals）——异步 handler 回放使用"构造期上下文"，请求期 set 不可见。

运行：
    uv run --with zen-engine python zen-engine-contextvars-demo.py
"""

import asyncio
import contextvars
import json

import zen

SESSION: contextvars.ContextVar[dict] = contextvars.ContextVar("session", default=None)


def make_graph() -> str:
    """inputNode → customNode → outputNode 的最小决策图"""
    graph = {
        "nodes": [
            {"id": "in", "type": "inputNode", "name": "Request"},
            {
                "id": "c1",
                "type": "customNode",
                "name": "session_probe",
                "content": {"kind": "custom", "config": {}},
            },
            {"id": "out", "type": "outputNode", "name": "Response"},
        ],
        "edges": [
            {"id": "e1", "sourceId": "in", "targetId": "c1"},
            {"id": "e2", "sourceId": "c1", "targetId": "out"},
        ],
    }
    return json.dumps(graph)


GRAPH = make_graph()


# handler 形态 A：同步回调
def sync_handler(req):
    sess = SESSION.get()
    return {"output": {"seen": sess}}


# handler 形态 B：异步回调（真实 UDF 常态：内部做 IO）
async def async_handler(req):
    sess = SESSION.get()
    await asyncio.sleep(0)  # 模拟异步 IO 让出
    return {"output": {"seen": sess}}


def seen_of(response) -> dict:
    """从 evaluate 响应中提取 customNode 输出（防御式导航）"""
    result = response.get("result") if isinstance(response, dict) else None
    if isinstance(result, dict):
        return result.get("seen", result)
    return result


def report(case: str, seen, expected) -> bool:
    ok = seen == expected
    mark = "✓" if ok else "✗"
    print(f"  {mark} {case}: seen={seen!r} (期望 {expected!r})")
    return ok


async def main() -> int:
    failures = 0

    # ---------- A. 同步 handler + 同线程 set ----------
    print("[A] 同步 handler + 同线程 set → evaluate")
    engine_a = zen.ZenEngine({"customHandler": sync_handler})
    token = SESSION.set({"tenant": "t-seq", "perm": ["read"]})
    try:
        resp = engine_a.create_decision(GRAPH).evaluate({"x": 1})
        failures += 0 if report("A1 顺序执行", seen_of(resp), {"tenant": "t-seq", "perm": ["read"]}) else 1
    finally:
        SESSION.reset(token)

    # ---------- B. 异步 handler + async_evaluate（请求期 set，构造期上下文为空） ----------
    print("[B] 异步 handler + async_evaluate（请求期 set，引擎构造期上下文为空）")
    engine_b = zen.ZenEngine({"customHandler": async_handler})  # 构造期：SESSION 为 None
    token = SESSION.set({"tenant": "t-req", "perm": ["write"]})
    try:
        decision = engine_b.create_decision(GRAPH)
        resp = await decision.async_evaluate({"x": 1})
        failures += 0 if report("B2 请求期 set", seen_of(resp), {"tenant": "t-req", "perm": ["write"]}) else 1
    finally:
        SESSION.reset(token)

    # ---------- C. 异步并发双租户（同一引擎实例） ----------
    print("[C] 异步并发双租户（asyncio.gather，同一引擎实例）")
    engine_c = zen.ZenEngine({"customHandler": async_handler})

    async def tenant_task(engine, tid: str):
        token = SESSION.set({"tenant": tid, "perm": [f"perm-{tid}"]})
        try:
            decision = engine.create_decision(GRAPH)
            return tid, seen_of(await decision.async_evaluate({"x": tid}))
        finally:
            SESSION.reset(token)

    results = await asyncio.gather(
        tenant_task(engine_c, "t-alpha"),
        tenant_task(engine_c, "t-beta"),
    )
    for tid, seen in results:
        if seen is None or not isinstance(seen, dict) or seen.get("tenant") != tid:
            label = "不可见 ✗" if seen is None else "串号 ✗"
            print(f"  {label} {tid}: seen={seen!r}")
            failures += 1
        else:
            print(f"  ✓ {tid}: 隔离 {seen!r}")

    # ---------- D. 多实例：每个租户上下文内构造独立 engine ----------
    print("[D] 多实例：在租户上下文内构造独立 engine（构造期捕获 = 自带 session）")

    async def tenant_engine(tid: str):
        token = SESSION.set({"tenant": tid, "perm": [f"perm-{tid}"]})
        try:
            eng = zen.ZenEngine({"customHandler": async_handler})  # 构造期捕获当前上下文
            decision = eng.create_decision(GRAPH)
            return tid, seen_of(await decision.async_evaluate({"x": tid}))
        finally:
            SESSION.reset(token)

    results = await asyncio.gather(tenant_engine("t-gamma"), tenant_engine("t-delta"))
    for tid, seen in results:
        ok = isinstance(seen, dict) and seen.get("tenant") == tid
        mark = "✓" if ok else "✗"
        print(f"  {mark} {tid}: seen={seen!r}")
        if not ok:
            failures += 1

    # ---------- 结论 ----------
    print()
    print("=" * 60)
    if failures == 0:
        print("结论：所有场景与源码推演一致——B/C 的上下文丢失可由 D（多实例构造期捕获）规避")
    else:
        print(f"结论：{failures} 个场景偏离源码推演，需结合 bindings/python/src/engine.rs 复核")
    print("=" * 60)
    return 0 if failures == 0 else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
