# 决策表核心编辑器 data-grid 换装 · 计划与 Phase 0 决策记录

- 日期：2026-09-26
- 状态：Phase 0 spike **通过**（459/459 + storybook 76/76 + tsc/build/size 绿；index.js **-7.1kB** raw）
- 背景：dt 表实例已在批 1 统一到 TanStack v9；本次为**展示层换装**（同一表实例喂给
  vendored data-grid 渲染），非引擎迁移。

## Phase 0 三问结论

| # | 问题 | 结论 |
| --- | --- | --- |
| 1 | 双表头 + 受控列宽能否经 grid 渲染 | ✅ 成立。**关键前提：必须用 grid 自带的 `dataGridFeatures` 全量特征集**——最小集（visibility/sizing/resizing）会在视口层炸 `getStartVisibleLeafColumns`（pinning feature 提供）。受控 `state.columnSizing` + localStorage 键原样保留，grid `columnsResizable` 消费同一状态 |
| 2 | 行级语义注入路径 | ✅ 成立。diff 三态 1:1 映射 `getRowStatus`（added→new / modified→dirty / removed→deleted）；cursor 行 + simulator 命中行走 **`getRowClassName` 扩展**（已入 vendored grid，props getter 穿线镜像 getRowStatus，可反哺上游） |
| 3 | 悬停操作/右键/拖拽挂载点 | ✅ 成立。右键 `TableContextMenu` 包裹层不变；hover 操作迁入 `__index` 列的 cell（`TableRowHoverActions` 锚点不变）；行拖拽换 grid 原生 `DataGridTableDndRows`（落点仍是 `swapRows`），`dt.tsx` 外层 DndContext/DragOverlay 退役 |

## Phase 1 落地记录（2026-09-26）

- **字段级 diff tint**：✅ 已修——vendored grid 新增 `getCellClassName(row, columnId, rowIndex)`
  （镜像 getRowClassName 穿线），dt 接线字段三态底色 + cursor 格描边（旧 TableRow td 语义移植）。
- **scrollApiRef**：✅ 已精确化——按行元素几何换算（grid 行带 data-index），替代 38px 均值近似。
- **headerSticky**：✅ 已开启（tableLayout.headerSticky），浏览器走查双行表头吸顶确认。
- **行拖拽定案**：grid 原生 DndRows + 把手列，落点 swapRows；index-cell 拖拽语义退役。
- **像素走查结论**：结构/吸顶/编辑/hover 钮（程序化验证 Add above/below/Remove 全浮现）/
  浅色主题渲染全部正确。**环境注意事项**：IAB 截图管线在同标签页多次导航后存在陈旧瓦片
  合成伪影（旧实现 DOM 无把手也会画出把手）——DOM 几何与 elementsFromPoint 命中测试为准，
  两者已全部验证正确；最终人眼复检建议在本地干净会话进行。

## 开放问题（Phase 1 定案）

1. **DndRows 与 Virtual 不共存**（vendored 套件现状）：决策表以中小规则表为主，spike 取
   DndRows（全量渲染）；大表虚拟化为 vendored 增强候选（三选一：a 维持全量渲染 /
   b 去 Dnd 保 Virtual / c 增强合并两者）。
2. **字段级 diff tint**：修改行目前仅变更格着色（warning bg）。grid 的 `getCellStatus`
   是角标语义非底色。候选：grid td 补 `data-column-id`（1 行 patch，可上游）+ dt 作用域
   CSS；或扩展 `getCellStatus` 支持类名。
3. **scrollApiRef 精确化**：spike 用 38px 行高均值近似（getTopRowIndex/scrollToRowIndex）。
   随开放问题 1 的虚拟化取舍一并定（DndRows 无虚拟器，精确滚动暂无对象）。
4. **Add row 底栏**：原 sticky tfoot 改为 grid 外 sticky div（视觉近似）；表头 sticky
   行为待像素走查核对。

## Phase 1 剩余（1–1.5 天）

- 像素走查（明暗主题对照基线截图）：表头 sticky、列宽拖拽手感、hover/选中 tint 密度
- 开放问题 1–4 逐项定案
- 测试补强：行拖拽 → `swapRows` 断言、`__index` 列交互（hover 钮/右键 cursor）用例

## Phase 2（✅ 已裁决 2026-09-26：维持现状，A' 记为推荐备选）

**裁决**：dt 编辑契约维持 `cursor/commitData`（单格焦点 + 逐格提交 + 宿主受控）不变，
不采纳 grid `cellSelection` 的 range 模式（3–5 天 + CodeMirror 格内文本选区与框选
手势根本冲突 + 高回归风险）。`cursor/commitData` 记为 dt 的长期编辑契约。

**推荐备选 A'（~1 天，日后按需立项）**：启用 cell-selection 的**单格聚焦模式**——

```ts
tableLayout: { cellSelection: true, cellSelectionMode: 'single' }
```

`'single'` 档只留单格聚焦（无范围/剪贴板/填充），回避 CodeMirror 格内文本选区与
框选手势的根本冲突。真实增益 = **方向键在格间移动焦点的电子表格导航** +
`aria-activedescendant` 焦点跟踪（dt 现都没有）。落地要点：

1. 焦点变化同步回 dt-store 的 cursor（命令栏/快捷键契约零改动）；
2. 视觉二选一：grid 焦点铬（`td[data-cell-focused]`）或现有 `getCellClassName`
   自绘描边，取一去一避免双高亮；
3. 三点语义差需裁决：grid 按 `(row.id, column.id)` 定位（行重排跟随行），dt cursor
   按 `(columnId, rowIndex)`（跟随位置）；dt 有 `'id'` 伪列（行号右键 → 行级操作），
   grid focus 纯格级；grid focus 是内部状态，需桥接回 dt-store 才对宿主可见。

## Phase 3 清债（✅ 2026-09-26 已完成）

✅ 已完成：`table-row.tsx`、`table-head-row.tsx` 删除；`dt.tsx` 外层
DecisionTableDnd（DndContext + DragOverlay 行预览）退役；style-debt 复盘
（12/18 全部为 xyflow/monaco 关联，dt 侧无可烧项）；size 复核：index.js 累计
**-7.5kB** vs 换装前基线（745.1 → 737.7kB）——删手搓代码超过新增 grid 组合。

## 明确不动

`TableProps` API、localStorage 列宽键、`TableDefaultCell`（contenteditable 行为）、
CodeMirror 单元格池、`dt-store` cursor/commitData 契约（Phase 2 已裁决：长期编辑契约）。
