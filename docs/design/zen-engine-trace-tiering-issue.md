# zen-engine 上游 issue 提案包：tiered trace（轻量命中掩码）

- 日期：2026-10-01
- 状态：候选池 · 待宿主手动提交（上游贡献转手动裁决）
- 关联：[zen-expression-time-functions.md](./zen-expression-time-functions.md)（上游 issue 池同架）、
  dt 行虚拟化/换装（trace 数据是仿真高亮的数据源）

## 背景

生产高频决策（debug=false）不产生任何 traceData——历史决策在规则图中
「高亮节点/决策表命中行」因此无数据。同时：

- 决策记录（reason codes / 命中掩码）是监管与客诉定位的刚需
  （FCRA/GDPR-22 可解释性），但全量 traceData（耗时+中间值+UDF 快照）
  比命中信息大 10-100 倍，高频热路径不可接受；
- 引擎的 trace 设施目前是全有全无（`trace: true`）——没有中间档。

本仓已自行解耦的部分（无需上游）：UDF 审计 journal 改经 customHandler
分发器自记账（handler 返回值在 TS 侧可得），审计不再依赖 traceData——
见 zen-udf `auditJournalRegistry`（Y2 免 trace 化）。**节点级/决策表行级
命中掩码在引擎内核（Rust/wasm）内部，TS 侧无从获取——只能上游提供。**

## 提案（issue 核心诉求）

**给 trace 加档位，或提供独立的轻量命中输出**：`debug=false` 时可选地
返回「哪些节点执行了、决策表命中了哪些行」，不含耗时/中间值/表达式树。

三个可选形态（上游任选其一）：

1. trace 档位化：`trace: 'mask' | 'full'`（或 `traceLevel: 0|1|2`）；
2. 独立评估选项：`hitMask: true` → 结果附 `firedNodeIds: string[]`
   （决策表附 `hitRows: Record<nodeId, number[]>`）；
3. 决策表结果常态携带 matched rules（DMN 惯例：命中行本就是决策表
   输出语义的一部分），自定义节点沿用 trace 档位。

## issue 正文（可直接粘贴）

> **Title**: Tiered trace: lightweight node-hit mask without full traceData
>
> **Context**: High-frequency decision services (10k+ QPS, `debug: false`)
> need a per-decision "which nodes fired / which decision-table rows hit"
> record for explainability (adverse-action reasons, GDPR Art.22) and for
> post-hoc visualization. Today this information only exists inside full
> traceData (`trace: true`), which carries timings, intermediate values and
> UDF snapshots — 10-100x larger than the hit information itself and too
> costly to enable per-request at scale.
>
> **Proposal**: a middle tier, any of:
> 1. `trace: "mask" | "full"` (verbosity levels);
> 2. a separate evaluate option `hitMask: true` returning
>    `firedNodeIds: string[]` (+ `hitRows: Record<nodeId, number[]>` for
>    decision tables);
> 3. decision-table results always carry matched rules (DMN-style), custom
>    nodes covered by (1)/(2).
>
> **Why**: per-decision reason records are a regulatory requirement in
> credit/fraud decisioning; sampling full traces only covers a subset and
> cannot answer "why was THIS request declined" after the fact.
>
> **Workaround today**: run sampled subset with `trace: true` and aggregate
> client-side; replay offline with trace enabled.

## 优先级与时机

- **P2**（时间函数 P1=now/isBetween 之后、%B 修复同档）：生产高亮有三条
  现实退路（采样/按需 debug、离线回放再生、UDF 段已自记账），不阻塞；
  但命中掩码是「生产数据直接高亮」与「决策记录原因码」的正解，值得提。
- 提交模板：复现（evaluate 带/不带 trace 的体积对比）+ 业务场景一句话 +
  期望形态（三选一），按上游沟通惯例英文正文。

## 本仓退路（上游未响应时）

| 退路 | 成本 | 覆盖 |
| --- | --- | --- |
| 采样/按需 `debug: true` + traceData 聚合掩码 | 宿主策略，零引擎改动 | 采样子集 |
| 离线回放（input+journal 留存，回放时 trace 全开） | 宿主编排 | 任意历史单笔（低频核验场景） |
| UDF 段自记账（已落地：auditJournalRegistry） | 已完成 | UDF 调用审计免 trace |

## 维护

- 上游响应后回填本档（issue 号/接受形态/版本）；
- 若上游采纳 `hitRows`，kernel 仿真高亮数据源可直接切换（行级高亮从
  traceData 行命中改为 hitRows，链路更短）。
