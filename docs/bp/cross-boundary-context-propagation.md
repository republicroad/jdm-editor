# BP-01：跨边界上下文传播

## 适用场景

宿主代码（Node/Python/Go 等）调用原生引擎（Rust/WASM/C++）或外部服务回调时，需要将调用方的会话上下文（租户身份、请求 ID、权限、OTel span）透传进回调函数。典型链路：

```
宿主 evaluate(...)   ← ALS / contextvar 在此处有效
  └─ N-API TSFN / WASM / FFI 派发回调   ← 边界：隐式上下文丢失
       └─ 回调内 getStore() / ctx.get() → undefined   ← 问题所在
```

## 核心模型

隐式上下文（ALS / contextvars）依赖 async_hooks / asyncio 的任务链传播——**原生边界切断了这条链**。解决方案是显式携带：

```
宿主 evaluate(key, input, execCtx)     ← ① 捕获：从 ALS 取当前上下文
  └─ 将 execCtx 序列化嵌入 input        ← ② 嵌入：选择能穿越边界的通道
       └─ 原生引擎处理各节点
            └─ 回调 (request)           ← ③ 提取：从回调参数恢复 execCtx
                 └─ als.run(execCtx, 原有逻辑)   ← ④ 重建立：恢复 ALS zone
```

## 铁律

1. **选对通道**：通道必须能穿越边界——Node→Rust 用函数参数，HTTP 用 header，MQ 用消息属性
2. **出口剥离**：嵌入的上下文键在最终产出中必须剥离（防泄漏到下游消费者）
3. **fail closed**：通道不可用（键丢失/序列化失败）时回退到"无上下文"安全行为，而非静默透传空值
4. **副本语义**：嵌入的是冻结副本，回调内篡改不影响调用方

## 仓内实例

- `packages/zen-udf/src/engine.ts` — `EXEC_CONTEXT_INPUT_KEY` + `enrichInputWithExecContext` + passThrough 剥离
- `packages/zen-udf/src/engine.ts` — act-skip 分支（`getExecContext()?.shadow` 跨 TSFN 边界）
- 探针：`src/decision-runtime.test.ts`「ExecContext 经输入保留键贯穿 TSFN 边界」
- Python 对照：`zen-engine-contextvars-demo.py`（仓库根目录）——contextvars 同步回调可见、异步丢失

## 反模式

| 反模式 | 后果 |
| --- | --- |
| 在回调入口重建 ALS 但用了**调用方外面的空 ctx** | 所有回调共享空上下文，租户隔离失效 |
| 只在首个 customNode 嵌入，passThrough 不传播 | 下游 act 节点丢上下文，act 在无租户状态下静默执行 |
| 用实例字段（`this.activeCtx`）代替通道传递 | 并发混合租户 evaluate 串号 |

## 跨运行时对照

| 运行时 | 同步回调 | 异步回调 | 通道 |
| --- | --- | --- | --- |
| Node + NAPI TSFN | 丢失 | 丢失 | 输入保留键 |
| Python + pyo3（sync handler） | **可见**（同线程 GIL 继承） | 构造期 TaskLocals 捕获 | 构造期捕获 / 每次重捕获 |
| Go + CGO | 取决于实现 | 取决于实现 | 显式 ctx 参数（语言级强制） |
