# 架构决策记录（Architecture Decision Record）

> 本目录归拢 jdm-editor 仓库的架构决策。每条 ADR 记录一个**不可轻易撤回**的技术选型：
> 背景、备选方案、决策结论、后续条件。格式参考 [MADR](https://adr.github.io/madr/)（简化版）。

## 索引

| ADR | 标题 | 状态 | 日期 |
| --- | --- | --- | --- |
| [ADR-001](./001-esm-only-packages.md) | 全部发布包采用 ESM-only（不提供 CJS 双格式） | accepted | 2025-01 |
| [ADR-002](./002-zen-udf-tenant-isolation.md) | zen-udf 多租户隔离：语义三元 + 审计 journal + 构造期上下文捕获 | accepted | 2026-09 |
| [ADR-003](./003-zen-udf-cache-ownership.md) | L1 决策缓存责任归宿主（zen-engine 函数 loader 无引擎级缓存） | accepted | 2026-09 |
| [ADR-004](./004-source-direct-consumption.md) | workspace 包消费方源码直通（不经 dist 副本） | accepted | 2025-01 |
| [ADR-005](./005-zen-udf-esm-source-publish.md) | zen-udf 以 TS 源码发布（main = src/index.ts，不编译 dist） | accepted | 2026-09 |
| [ADR-006](./006-zustand-selector-equality.md) | zustand 选择器相等性：弃用 zustand/traditional，本地深比较 memoizer 取代 | accepted | 2026-09 |

## 状态定义

| 状态 | 含义 |
| --- | --- |
| proposed | 已提出，待评审 |
| accepted | 已接受并实施 |
| deprecated | 已被后续 ADR 取代 |
| superseded by ADR-xxx | 被指定 ADR 取代 |

## 新建 ADR

1. 复制下方模板，命名 `NNN-短标题.md`（NNN 三位递增序号）
2. 填写完整后在上方索引表追加一行
3. 状态变更（如 accepted → deprecated）时在正文尾部追加 `## 后记` 说明原因与替代 ADR 链接

### 模板

```markdown
# ADR-NNN：标题

## 状态
accepted | proposed | deprecated（日期）

## 背景
遇到了什么问题、为什么现在需要决策。

## 备选方案
| 方案 | 优势 | 劣势 |
| --- | --- | --- |
| A | … | … |
| B | … | … |

## 决策
选了什么，为什么。

## 后果
正面/负面影响、约束、后续条件。
```
