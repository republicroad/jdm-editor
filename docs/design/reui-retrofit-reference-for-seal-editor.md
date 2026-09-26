# ReUI 改造参考（供 seal-editor 移植/对照）：dt-command-bar · switch 节点面板 · function 调试器

- 日期：2026-09-26
- 来源：jdm-editor 仓 `reui` 分支（HEAD `69e93e4a`）
- 用途：seal-editor 会话做三区改造对照/移植时的提交级参考。seal-editor 侧已有等价功能的，
  本文可作为实现差异的对照清单（细节差异见各节"对照点"）。

## 0. 移植纪律（两仓既定先例）

1. **按意图移植，不 cherry-pick**：下列提交全部早于 jdm-editor 的品牌清扫
   （`00c4360c`），内容中 token/类名为 `grl-*`。移植时直接以 `seal-*` 落地，
   勿原样照搬再二次替换（R4/R6/R7 反向移植即此做法）。
2. 提交号用于在 jdm-editor 仓定位 diff（`git show <hash>`），不代表 seal-editor
   侧应保留其提交消息。
3. 双向通道现状：seal-editor 已反向移植本仓 Excel data-grid 三批
   （其 `b38026a` = WS2-B1、`f26d279` = WS2-B2/B3），方法同上。

## 1 · dt-command-bar（决策表命令栏）

| 提交 | 内容 | 文件 |
| --- | --- | --- |
| `8256df0b` feat(dt): row hover quick actions + removeRowWithUndo | 行悬停快捷钮 + 可撤销删除 | 新建 `decision-table/table/table-row-hover-actions.tsx`（76 行）；`context/dt-store.context.tsx`（+35：`removeRowWithUndo` 动作，undo 栈集成 + 5 秒撤销 toast）；`table/table-row.tsx` 接线；`theming/messages/en.ts` + `zh-CN.ts` 各 +2 键 |
| `7bf5073a` feat(dt): right-click menu + command bar use removeRowWithUndo (replaces Popconfirm) | 删除语义三处统一 | `dt-command-bar.tsx`（弃 Popconfirm，-18/+18）；`table/table-context-menu.tsx`（removeRow → removeRowWithUndo） |
| `06b39a40` style(simulator): search input icon + trace row polish | 相邻批次 polish（同属决策表面） | `simulator/simulator-nodes-panel.tsx`（-10/+25：搜索图标内联、trace 行 gap/tabular-nums/transition） |

**关键实现语义（对照点）**：

- `removeRowWithUndo`：删除即入 undo 栈 + toast 附撤销动作，**5 秒窗口**；
  命令栏、右键菜单、行悬停钮三处删除走同一动作，无静默删除残留。
- 悬停快捷钮：hover 才显现（`opacity` 过渡），删除不再需要两步工具栏流。

## 2 · switch 节点面板（批 B）

| 提交 | 内容 | 文件 |
| --- | --- | --- |
| `a71a2fe2` feat(graph): switch-handle delete turns hover-revealed, Popconfirm removed (batch B) | 删除确认从 Popconfirm 改为 hover 显现的直接删除 | `switch.specification/switch-handle.tsx`（-28/+17） |

**实际内容**：`SwitchHandle` 与 `SwitchHandleCompact` 两个变体一致改造——

- Popconfirm 包裹的删除按钮 → 直接 `onClick` 删除按钮；
- 常显 → `group/con` 组内 `opacity-0 transition-opacity group-hover/con:opacity-100`
  悬停显现；
- 随 Popconfirm 移除，失效的 `useT` 导入一并清理（提交名由此而来）。

**对照点**：jdm 侧选择了"hover 显现 + 无确认"，若 seal-editor 侧保留了确认交互，
需权衡误删风险（行内删除有 undo 兜底的命令栏语义不同，此处在节点面板内无 undo）。

## 3 · function 调试器（批 C）

| 提交 | 内容 | 文件 |
| --- | --- | --- |
| `b2b6039b` feat(function): IoInspector — collapsible Input/Output inspection panel | 控制台新增可折叠 Input/Output 检查区 | 新建 `function/io-inspector.tsx`（80 行）；`function/function-debugger.tsx`（+2 接线） |

**关键实现语义（对照点）**：

- 行业范式：Chrome Sources / n8n 的检查面板模式；
- 数据源零新增——直接消费既有 `SimulationTrace.input` / `.output`；
- 呈现：JSONTree 结构化展开（可折叠），`trace.input/output` 为 null 时整区隐藏；
- 与日志区（`function-debugger-log.tsx`）纵向并列，控制台 tab 内先检查后日志。

## 背景基建（非 ReUI 改造，移植时可顺带对照）

- `c1a5ece7` refactor(function-debugger): JSONTree CSS war → theme stylables（HK-01）
- `44ba13b9` style(function): function.scss → Tailwind utilities + plain-CSS hooks

## 验证基线

三区改造落地时的门禁基线：kernel 447/447、tsc 干净（`b2b6039b` 时点）；
当前仓门禁水位：kernel 459/459、storybook 76/76。
