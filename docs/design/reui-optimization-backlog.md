# ReUI 改造剩余清单（按价值排序）

- 日期：2026-09-26
- 状态：**活档 · 填缝模式**——不再单独立批次，各项随主线顺做；主线 = UDF 生态
  （[playground-udf-lab-plan.md](./playground-udf-lab-plan.md)）
- 判据：**有对口的 ReUI 复合组件 + 交互真实升级**才算"适合优化"。primitives 本身是
  合法底座（Base UI 封装的 antd 风 API 层），用了 primitives 不构成优化理由；
  "堆叠"只有在多个面板重复手写同一种形态时才是漂移源。

## 已完成波次（不再列入）

| 波次 | 内容 | 记录 |
| --- | --- | --- |
| WS1 · 规则图 | R1–R7 全切片（节点卡/悬浮工具栏/边"+"插入/分支标签/停靠检查器/dagre 自动布局/run strip） | [development-roadmap.md](./development-roadmap.md) WS1 |
| Excel 对话框 | 三批：data-grid 地基（含 TanStack v8→9 统一）→ 双对话框改造 → 导入数据预览 | 提交 05e1b716/f3eaeab3/a21b4ba6 |
| B 线 | expression 小件去重；stepper vendored；B2b/B3 适应性否决 | 提交 e09d0fed/87c89536 |
| dt 核心编辑器 | data-grid 换装四阶段（spike/换装/裁决/清债），index.js 累计 **-7.5kB** | [dt-datagrid-retrofit-plan.md](./dt-datagrid-retrofit-plan.md) |
| 三区参考 | dt-command-bar / switch 面板 / function 调试器提交清单 | [reui-retrofit-reference-for-seal-editor.md](./reui-retrofit-reference-for-seal-editor.md) |

## 剩余清单（按价值排序）

| # | 区域 | 现状 | 可做 | 量级 | 触发条件 |
| --- | --- | --- | --- | --- | --- |
| 1 | **graph 面板区**（5,605 行 / 14 文件，最大剩余面） | tab-request / tab-function / tab-json-schema / request-definitions / request-examples 为 primitives 堆叠（同一"列表+工具栏+空态"形态逐文件手写） | [tree](https://reui.io/components/tree?ref=mcp) 承载 request-definitions 变量树（真实对口）；request-examples 列表与空态用 frame/alert 规范化 | ~1 天 | 随手做 |
| 2 | **fields-reorder-dialog**（dt 字段重排） | 手搓 DndContext + 拖拽 | [sortable](https://reui.io/components/sortable?ref=mcp)（与 DndRows 同底座，dnd-kit 已在依赖） | ~半天 | 随手做 |
| 3 | **function 调试器切片**（3,889 行区，IoInspector 已做） | 日志无搜索/过滤，单条无复制 | 搜索过滤 + hover 复制。日志级别类型化需 WASM 侧拦截，另行评估 | ~半天 | 随手做 |
| 4 | **specifications renderSettings**（1,752 行） | 已用 kernel ui 但密度/层级/间距未规范 | [frame](https://reui.io/components/frame?ref=mcp) + 密度规范统一——属"规范化"非"换件" | ~1 天 | 触及 spec 面板时顺做 |
| 5 | **UDF Lab**（主线新功能，非存量） | 已建成未走查 | **tree**（自定义节点目录）+ **timeline**（审计/回放）+ data-grid 原生采用——tree/timeline 的首次入链场景 | 随主线 | A1 验证后 |

## dt 换装解锁的增强候选（新功能，非优化）

| 候选 | 说明 | 量级 |
| --- | --- | --- |
| 列显隐菜单 | `data-grid-column-visibility` 已 vendored 未用，dt 开列显隐是现成能力 | ~半天 |
| 大表虚拟化 | StressTest 场景：DndRows（行拖拽）与 Virtual（虚拟化）在 vendored 套件不共存，需 vendored 增强（三选一见 [dt-datagrid-retrofit-plan.md](./dt-datagrid-retrofit-plan.md) 开放问题 1） | 1–2 天 |
| cellSelection single 模式（A'） | 方向键格间导航 + aria 焦点跟踪，桥接回 cursor；**Phase 2 已裁决**为推荐备选、维持现状 | ~1 天，按需 |

## 维持否决清单（附理由，防止重复评估）

| 项 | 理由 |
| --- | --- |
| autocomplete（替换 op-dropdown） | 现有 kind 页签 + 图标网格 + 搜索的富选择器是更好的设计，autocomplete 是降级 |
| date-selector（替换 value-inputs 日期输入） | 仪表盘周期控件（"近 7 天/本月"类），不是字段值日期输入 |
| timeline（simulator 运行历史） | 内核 simulator 只持有最后一次运行，无 history 面可改造——做历史属新功能决策 |
| kanban / gantt / event-calendar / rating / phone-input / scrollspy / filters | 规则编辑器无对应场景 |

## ReUI 组件覆盖快照（22 个免费组件）

- **在用 4**：data-grid 系（含 11 子模块）、badge、icon-tile、stepper
- **有落点待用 4**：tree、timeline、sortable、frame
- **候选 4**：alert、icon-stack、number-field、code-block
- **已 vendored 未启用 2**：data-grid-cell-selection（Phase 2 备选 A'）、data-grid-column-visibility（列显隐）
- **无场景/否决 10**：见上表
- 另有 premium blocks（整页区块）与 Motion Icons 产品线，本仓未涉及

相关：[reui-flow-integration-plan.md](./reui-flow-integration-plan.md) · [reui-flow-pilot.md](./reui-flow-pilot.md) ·
[dt-datagrid-retrofit-plan.md](./dt-datagrid-retrofit-plan.md)
