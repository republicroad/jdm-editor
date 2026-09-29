# reui 线 2026-09-29 开发批总结——seal-editor 移植参考

- 日期：2026-09-29（单日批次）
- 本文档口径：reui 线当日全部 commit（19 笔）按 **seal-editor 移植相关性**分四类，
  每项给移植要点与陷阱；移植动作由 seal-editor 仓内会话按自身排期承接。
- 关联：[reui-retrofit-reference-for-seal-editor.md](./reui-retrofit-reference-for-seal-editor.md)（三区参考）、
  [dt-row-virtualization-best-practices.md](./dt-row-virtualization-best-practices.md)（虚拟化全文）、
  [zen-expression-time-functions.md](./zen-expression-time-functions.md)（时间函数盘点）

## 当日版本快照

| 包 | 版本流动 |
| --- | --- |
| zen-udf | 0.7.0 → **0.10.0**（0.8.0 L7 / 0.9.0 ADR-009#1 / 0.10.0 引擎 2.1.0） |
| jdm-editor | 2.0.0 → **2.4.0**（2.1.0 虚拟化 / 2.2.0 A' / 2.3.0 L6 / 2.3.1 CM 清债 / 2.4.0 ADR-009） |
| jdm-appshell | 0.12.0 → **0.14.0**（0.13.0 L6 / 0.14.0 ADR-009） |

## A 类 · 直接可移植（seal kernel/appshell 同构，建议排期）

### A1 · ADR-009 #2/#3：目录 origin 徽标 + meta 透传 + 租户过滤挂点（`106b8609`）

seal 已自研 L6（`1f08b77`，component-search + containerPlan）——**ADR-009 在同一链路上续作**，
移植面与 seal 现状逐文件同构：

- `custom-node-types.ts`：`UdfPackOrigin`/`UdfPackMeta` 类型（与 zen-udf 0.9.0 契约结构对齐——
  seal 经 npm 消费 zen-udf 0.9.0 后端点即带 meta）；
- `custom-node-plans.ts`：`CustomNodePlan.meta` + containerPlan 透传；
- `custom-node-registry.tsx`：planToJdmNode base 加 `meta: plan.meta`——
  **陷阱**：此行曾漏（live 徽标不现，bun 直跑链路二分 plan/spec 层 5 分钟定位）；
- kernel `specification-types.ts` + `custom-node/index.tsx`：spec `meta?` 字段；
- kernel `graph-components.tsx`：ORIGIN_BADGE（REF/EXT/IND 角标，absolute 端点）+
  `tenantFilter?: (spec) => boolean` 挂点（治理线实现语义，appshell 不透传）；
- 依赖升级：seal 消费 zen-udf 0.9.0 后，kernel 侧 `zen-engine-wasm` 不受影响
  （node 侧 2.1.0 升级仅在 zen-udf/demo-server 链）。

移植量 ~半天。验收：schema 端点 14/15 命名空间带标、容器卡 REF 徽标渲染。

### A2 · CM phase-2b 清债（`0dd18ee3`）

seal kernel 同源持有同批 PARITY 债（CM 皮肤迁移 Batch D 于分叉前完成，旧高亮器
`ce-highlight.tsx` + tailwind.css PARITY 块 + 逃生舱 flag 均在）。移植=纯删除：

- 删 `ce-highlight.tsx`（确认公共 API 不导出）+ ce.tsx 三分支塌缩双路径 +
  `gru-hl-view` 逃生舱作废（池化默认态 seal 侧同样已浸泡跨两次 major）；
- 删 PARITY CSS 双段（**陷阱**：段夹 preview 规则块，锚点切割后 grep 复查孤儿规则体）；
- 顺烧 edge-delete-button 2 处 `!important`（consumer 加 `p-0 w-8` utility）；
- `style-debt.mjs` BUDGET.important 按实测下调（reui 口径 18→8，保留 7 处全为
  第三方对抗——seal 侧数字先实测再定）。

移植量 ~半天。

## B 类 · 依赖前置链（先移植 dt 换装，再谈这两项）

### B1 · 决策表行虚拟化（`9eb5aa7e` + `2c48f461` timer 修正）

前置链：seal dt 仍是上游手搓表（自带旧式虚拟化）——**seal 不缺虚拟化能力**，缺的是
「ReUI data-grid 换装后的虚拟化」。若 seal 决定移植 dt 换装（Phase 0-3），虚拟化作为
换装的 vendored 增强一并移植，要点：

- 虚拟化做进 `DataGridTableDndRows` 表体（`virtual`/`virtualizerRef` prop），非与
  DataGridTableVirtual 组合；
- 七条纪律见 [dt-row-virtualization-best-practices.md](./dt-row-virtualization-best-practices.md)
  （spacer/0 高守卫/rangeExtractor 拖拽保活/minRows 门控/timer 兜底重连/双路径滚动 API/
  data-index 恢复）；
- `2c48f461` 中的 timer 修正（rAF→setTimeout）必须随行——rAF 在星帧环境与 RO 同饿死。

### B2 · A' 单格聚焦（`2c48f461`）

同前置链（依赖 vendored grid cell-selection）。seal 移植 dt 换装后评估；键盘三分
约定（plain=焦点 / Ctrl⌘=边缘跳转 / Alt=插删行）与受控 cellSelection 陷阱
（**本 fork tanstack：传 onCellSelectionChange 必须与 state 成对**）见 A' 提交正文。

## C 类 · 无需移植（npm 消费自动获得）

| 项 | commit | 说明 |
| --- | --- | --- |
| ADR-008 L7 customHandler 组合 | `98936ce1`（zen-udf 0.8.0） | seal 升级 zen-udf 依赖即得 |
| ADR-009 #1 UdfPackMeta+撞名检测 | `701ee190`（0.9.0） | 同上；**含 referenceDomains 误标修正**（ab→ab-bucket/dt→datetime/validate→validate-cn），seal 侧若有自定义 registry 装载需对齐 |
| zen-engine 2.1.0 + 回归语料 861 例 | `fa584b65`/`731236cf`（0.10.0） | 语料与台账在 zen-udf 包内，npm 消费自动获得；seal 无需自建 |
| L6 目录搜索 | `9dd720f8` | seal 为实现方（1f08b77），仅 apiRef 结构化 ref 修正值得回看 |

## D 类 · 参考材料（不移植）

- 时间表达式盘点（`61a58d4b`）：[zen-expression-time-functions.md](./zen-expression-time-functions.md)
  ——业务清单三态标注 + 上游 issue 提案包（P1 now/today+isBetween…）+ 探针脚本；
  seal 侧 issue 决策可直接引用；
- 虚拟化最佳实践文档（`c0bca56d`）；
- ADR-009 两条验收注记（撞名报错列冲突方 / UdfPackMeta 最小化）已入 seal 仓 ADR 文档。

## 当日全量 commit 清单（时间正序）

```
be423ab1 fix(dt): manualPagination — 万行数据可达修复（虚拟化前置）
98936ce1 feat(zen-udf): L7 customHandler 组合（ADR-008）
da049439 chore(release): zen-udf 0.8.0
9eb5aa7e feat(dt): 行虚拟化（B1 主实现）
c0bca56d docs(design): 虚拟化最佳实践
e5da3f7c chore(release): jdm-editor 2.1.0
2c48f461 feat(dt): A' 单格聚焦（B2，含虚拟化 timer 修正）
ca6be259 chore(release): jdm-editor 2.2.0
9dd720f8 feat(appshell,kernel): L6 移植（seal 为实现方，仅 apiRef 修正回看）
10ef8c84 chore(release): jdm-editor 2.3.0 + appshell 0.13.0
0dd18ee3 refactor(ce): CM phase-2b（A2）
51ae63bc chore(release): jdm-editor 2.3.1
701ee190 feat(zen-udf): ADR-009 #1（C 类，npm 消费）
106b8609 feat(appshell,kernel): ADR-009 #2/#3（A1）
7f741347 chore(release): zen-udf 0.9.0 + jdm-editor 2.4.0 + appshell 0.14.0
fa584b65 test(zen-udf): 回归语料 861 例（C 类）
731236cf feat(zen-udf): zen-engine 2.1.0 升级（C 类）
57f171e0 chore(release): zen-udf 0.10.0
61a58d4b docs(design): 时间表达式盘点（D 类）
```
