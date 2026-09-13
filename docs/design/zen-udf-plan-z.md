# zen-udf 开发计划 Z 系列（0.3.0 发布与治理收口）

状态：plan · 待宿主确认（3 个决策点见文末）
上游：Y 系列（语义/审计/回放/熔断/OTel/夹具）已 shipped；0.2.0 在架；W4 挂起；verdict U10 跨仓执行中

## 现状盘点

- **Y1 遗留**：计划中"act 工具须附 `idempotent` 声明（防误标）"未实现——validatePack 目前只校验 semantics 取值合法性
- **文档滞后**：包 README 与 docs 站点未覆盖 Y 系列新能力（语义三元/审计事件/回放/熔断/OTel/夹具运行器）
- **0.3.0 待发**：Y1–Y7 代码已全部就位，版本号仍在 0.2.0；发布管线（chore(release) → publish.yaml → npm-smoke）就绪
- `pnpm-lock.yaml` 有未提交变更（Y6 依赖安装残留），随 Z1 收口

## 总览

| 期 | 内容 | 状态 |
| --- | --- | --- |
| Z1 | act 幂等声明校验（Y1 遗留） | 待开发 |
| Z2 | README/docs 刷新至 0.3.0 能力全集 | 待开发 |
| Z3 | 0.3.0 版本收口与发布 | 待开发 |
| Z4 | demo-server 审计演示（决策审计生命周期可视化） | 决策点 D14 |
| Z5 | HAProxy observe 算子包落点 | 决策点 D13 |
| Z6 | OTel customNode 子 span | 挂起（依赖上游原生传播） |
| Z7 | verdict U10 支持 | 跨仓持续 |

建议执行序：Z1 → Z2 → Z4（视 D14）→ Z3 → Z5（按 D13 记录方向）；Z6 观察名单。

## Z1 act 幂等声明校验（Y1 遗留）

- ContribToolDef / UdfSchema 增加 `idempotent?: boolean`
- validatePack：`semantics: 'act'` 且未声明 `idempotent: true` → **警告级提示**（errors/warnings 分离，warnings 不阻断注册；运行时行为不变）
- 决策审计事件为 act 调用附 `idempotent` 字段（verdict 审计可见该声明）
- 测试：声明/未声明两态 + 警告文案

## Z2 文档刷新至 0.3.0

- 包 README：新增章节——算子语义三元（query/observe/act 与回放行为矩阵）、决策审计事件（DecisionAuditEvent 形状 + onDecision 用法）、确定性回放（evaluateReplay + inputHash 校验）、CircuitBreaker、OTel 桥、夹具运行器（runDecisionTests）
- docs 站点 zen-udf 落地页同步（docs/zen-udf.md）
- 多租户设计文档补"审计→回放"闭环小节引用（Y 计划已述，正文挂钩）

## Z3 0.3.0 版本收口与发布

- version 0.2.0 → 0.3.0；`pnpm test:zen-udf-smoke` 本地绿
- `chore(release): @republicroad/zen-udf@0.3.0` 提交推送 → CI 自动发布（管线已在 W 系列验证）
- 发布后 `npm view @republicroad/zen-udf version` 复核 + registry 冒烟

## Z4 demo-server 审计演示（视 D14）

- demo-server 配置 onDecision：审计事件以结构化 JSON 行输出到 stdout（`[audit] {...}`）
- playground「Server run」即可看到决策审计生命周期——演示"声明→强制→证据→重演"信任链的最小可见形态
- 不落存储（demo 无状态定位不变）

## Z5 HAProxy observe 算子包落点（按 D13 记录方向）

- 语义与回放契约已就位（Y1 observe + Y3 journal）；热层 REST 适配属部署形态
- 落点候选：xrule 仓私有 UdfPack（推荐——热层绑定具体部署与键命名规范）vs zen-udf contrib 参考域（会引入业务色彩）
- 本仓交付物（任一落点）：HAProxy 适配指引文档段落（键命名/租户前缀/窗口表选型/used 告警——同步计数文档已有基础）

## Z6 OTel customNode 子 span（观察名单）

- 依赖 gorules/zen 原生 async context 传播（W4 上游 issue 的衍生收益）：原生落地后子 span 自动续接，无需本仓旁路
- W4 恢复时一并跟进

## Z7 verdict U10 支持

- 跨仓持续：按 [verdict-zen-udf-integration.md](./verdict-zen-udf-integration.md) 支持 U10 执行；本仓按需补机制/契约测试

## 待宿主确认

- **D12**：0.3.0 发布内容确认（推荐：Y1–Y7 全部 + Z1/Z2 收口后发布）
- **D13**：HAProxy observe 参考包落点（推荐：xrule 仓私有包，zen-udf 只出文档指引）
- **D14**：demo-server 审计演示（推荐：纳入——stdout JSON 行，改动极小、演示价值高）
