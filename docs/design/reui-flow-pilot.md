# ReUI flow 块试点评估（flow-1 → playground）

- 日期: 2026-09-15
- 状态: 试点完成（flow.html 实例可运行）
- 背景: ReUI 新增 flow 分类（4 个 `@xyflow/react` v12 块：flow-1 自动化画布 / flow-2 agent 树 / flow-3 管道运行监控 / flow-4 KPI 地图，Pro 档）。本试点安装 flow-1（依赖最轻）回答三个问题。

## 0. 安装事实

- 块体量：约 2.7k 行（11 个组件文件，落在 `src/components/blocks/flow-1/`，`page.tsx` 为入口）。
- 连带安装：ReUI badge/icon-tile/alert 更新；shadcn 组件 19 个（context-menu/dropdown-menu/field/item/kbd/popover/select/sheet/tooltip/toggle-group…）；npm 依赖 `@xyflow/react 12.11.3`（与 kernel ^12.3.0 同线）、`sonner`、`class-variance-authority`、`lucide-react`（补上了 playground 缺失的直接依赖——此前 tree.tsx 的 tsc 报错同源）。
- theme.css 追加 ReUI 扩展色板 token。
- 补丁 2 处（自家副本，均已注释标注）：块顶栏加「← 目录」；canvas-toolbar 的 ToggleGroup 按 radix API 就地翻译（见问题 2）。
- `components/blocks/**` 加入 `.prettierignore`——保持上游原貌，块升级时 diff 干净。

## 问题 1：哪些部件可以直接搬进 kernel / appshell

| 部件 | 去处 | 说明 |
| --- | --- | --- |
| **FLOW_THEME 模式**（flow-canvas.tsx） | kernel DecisionGraph | 把 xyflow 的 `--xy-*` 变量整体映射到 shadcn token（`--border`/`--primary`/`--card`…），画布自动跟随主题与暗色——kernel 现在自己写 CSS，这个模式可直接移植 |
| 停靠 inspector（complementary 面板 + Step/Last Run 卡） | udf-lab 二期 / kernel 节点详情 | 选中节点的详情/运行记录侧车，配 `Incoming/Outgoing` 度数 |
| 节点工具栏 + 右键 context-menu | kernel 画布交互 | 增删复制步骤的节点级操作模式 |
| useFlowHistory（undo/redo 快照 + dirty 版本号比对） | kernel/appshell | 画布历史管理参考实现 |
| delete 确认 dialog、Badge 状态条、IconTile、Kbd 快捷键提示 | 全局 | ReUI 基础件的标准用法样例 |

## 问题 2：与源码直通体系的配合度

**结论：配合良好，但有一个风格错配坑（已修补）。**

- 块是纯源码文件，与 playground 其余部分同等待遇，无 dist 介入。
- `@xyflow/react` 与 kernel 同版本线，无双实例风险。
- **坑**：ReUI 块按 **Base UI 风格**书写（数组 value / multiple / spacing 的 ToggleGroup），但块的普通名依赖（toggle-group 等）由 shadcn new-york 路径解析出 **radix 系**组件——运行时 `Missing prop type` 崩溃。修补：canvas-toolbar 的 ToggleGroup 用法按 radix API 就地翻译（`type="single"` + 单值）。flow-1 未发布到 `/r/base/` 路径（404），故无法靠切注册风格根治；这是 ReUI 该块的打包瑕疵，升级块时需重打此补丁。完整问题描述与上游 issue 草稿见 [reui-flow-toggle-group-style-mismatch.md](./reui-flow-toggle-group-style-mismatch.md)。
- 附带发现：playground 此前缺 `lucide-react` 直接依赖（pnpm 严格布局），已按 catalog 惯例补齐。

## 问题 3：flow-3 式「决策运行监控」可行性

**可行，数据面已具备。** flow-1 的 step-node 已演示"节点卡 + Last Run 状态条"形态；demo-server `/v1/execute` trace 提供 per-node 输入/输出，审计事件提供 per-UDF semantics/outcome/micros——足以驱动 flow-3 式画布：JDM 节点 → 6 态运行状态、失败 focus/retry。后续安装 flow-3（无 dagre）+ 一个 trace→nodes 状态的适配层即可；建议落在 udf-lab 第三栏或独立 `monitor.html`。

## 后续

1. kernel/appshell 吸收 FLOW_THEME 与 inspector 模式（纳入 ReUI 迁移主线）。
2. flow-3 运行监控接 demo-server trace（二期）。
3. verdict 侧若长 agent/自动化工作区，flow-2 为现成模板（跨仓备案）。
