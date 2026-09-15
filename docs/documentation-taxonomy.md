# 文档分类指南

> 本仓文档按决策生命周期分为四类。写文档前先对照此表选形态——
> 同一问题写错了文档类型，后续追溯时会断链。

## 生命周期与文档形态

```
想法 → 提案（讨论）→ 计划（排期）→ 执行 → 决策记录（归档）
 RFC/PEP    Design Doc                 ADR
```

| 阶段 | 文档形态 | 核心问题 | 仓内位置 | 本仓实例 |
| --- | --- | --- | --- | --- |
| **提案** | RFC / PEP | "我们要做 X，为什么、怎么做、大家讨论" | `docs/upstream/`（给上游的 issue 草稿） | gorules-zen-async-context.md |
| **计划** | Design Doc / 开发计划 | "怎么建、排期、依赖、门禁" | `docs/design/zen-udf-plan-*.md` | plan-u/v/w/x/y/z/aa/bb/cc/dd |
| **设计** | Design Doc（架构面） | "架构怎么分层、约束是什么" | `docs/design/zen-udf-multi-tenant.md` 等 | multi-tenant / sync-counting / context-propagation |
| **决策归档** | **ADR** | "选了什么、为什么、放弃了什么" | `docs/adr/` | 001–005 |
| **对接规范** | Integration Spec | "消费方怎么接入、验收标准" | `docs/design/verdict-zen-udf-integration.md` | verdict-zen-udf-integration |

## 与业界实践的对应

| 业界实践 | 说明 | 与本仓的对应 |
| --- | --- | --- |
| **PEP**（Python） | 增强提案：语言特性/标准/流程的全生命周期治理。比 ADR 范围更广——被接受的 PEP 变成规范，ADR 只记录选型原因 | 本仓无直接对应；如果未来需要提出 zen-engine/zen-expression 语言级特性提案，形态参照 PEP |
| **Rust RFCs** | 提案→讨论→接受→实现；接受的 RFC 即规范 | 同上 |
| **Google Design Doc** | 实现前架构方案，比 ADR 范围广、更协作 | `docs/design/` 下的设计与计划文档 |
| **ADR / MADR** | 决策归档（选了什么/为什么/放弃了什么） | `docs/adr/` |
| **Y-statement** | ADR 一句话格式：*In context X, facing Y, we chose Z for A, accepting B* | 可作为 ADR 的 TL;DR 段 |

## 选用规则

| 你在做什么 | 写什么 |
| --- | --- |
| 提出一个上游（gorules 等）应修的缺陷或特性 | **Upstream Issue Draft** → `docs/upstream/` |
| 规划一轮开发（排期/依赖/门禁/决策点） | **开发计划** → `docs/design/zen-udf-plan-*.md` |
| 设计一个子系统的架构（分层/隔离/端口/约定） | **设计文档** → `docs/design/zen-udf-multi-tenant.md` 等 |
| 做了一个**不可轻易撤回**的技术选型（换实现需重写或迁移） | **ADR** → `docs/adr/NNN-*.md` |
| 定义消费方接入规范/验收标准/命名约定 | **Integration Spec** → 对接方设计文档附录 |

## 反面模式

- **用 ADR 记录实现细节**——ADR 只记"选了什么+为什么"，"怎么做的"归 Design Doc
- **用 Design Doc 替代 ADR**——Design Doc 是活的（会更新），ADR 是死的（不可改，只能 superseded）
- **一份文档跨多个阶段**——提案和决策混写会导致"为什么当时选了 X"被后续计划变更淹没
- **没有决策点的纯排期文档不需要进 design/**——用 issue tracker 或 TODO 即可
