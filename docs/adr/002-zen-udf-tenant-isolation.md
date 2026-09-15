# ADR-002：zen-udf 多租户隔离——语义三元 + 审计 journal + 构造期上下文捕获

## 状态
accepted（2026-09）

## 背景

zen-engine 的 customNode 回调（Node TSFN / Python pyo3）不继承调用方的 AsyncLocalStorage / contextvars——租户身份在回调内丢失，多租户服务端无法隔离数据面 UDF。且 observe/act/query 三类算子的副作用等级不同，需机器强制而非口头约定。

## 备选方案

| 方案 | 优势 | 劣势 |
| --- | --- | --- |
| 引擎构造期捕获上下文（Python `make_locals` 现状） | 简单 | 请求期 set 不可见、并发租户串号 |
| 输入嵌保留键（`__zen_udf_exec_ctx__`）+ 回调内重建 ALS | 跨 TSFN 可靠、并发安全、每请求自带 | 输入含保留键（出口剥离）；跨节点链需 passThrough 传播 |
| 按租户构造独立 engine 实例 | 天然隔离 | 内存 N 倍、缓存碎片化 |

## 决策

采用**语义三元 + 输入保留键 + journal 回放**三层机制：

1. UdfPack 工具声明 `semantics: query | observe | act`——运行时按语义强制回放行为
2. `DecisionRuntime.evaluate` 将 ExecContext 以保留键嵌入输入；`handleCustomNode` 提取后 `runWithExecContext` 重建立
3. act 类 UDF 必须声明 `idempotent`；审计事件 `observed[]` 钉住各算子返回值（回放确定性）
4. passThrough 向下传播保留键；最终结论出口统一剥离

## 后果

- 多租户隔离从作者约定变为运行时强制（fail closed）
- Python 绑定的 contextvars 行为差异已实证并记录（见 context-propagation 文档）
- 保留了跨运行时对照材料（Node ALS / Python contextvars），上游 issue 可随时提交
