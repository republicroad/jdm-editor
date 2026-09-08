# reui 分支三项回归修复方案

## 分支准备

当前 main 领先 reui 一个存档提交（8d5a0bde）。先 `git switch reui && git merge main --ff-only` 同步，全部修复在 reui 上进行。

## Bug 1：恢复 debug/自定义节点的「编辑表达式」按钮

**根因**：main 上的重构从上游谱系重建，丢掉了 zrule 分支的 fork 增补（`createJdmNode` 默认 renderNode 中的 `openTab` + `t('editExpression')` 按钮，新 i18n 目录中无此 key）。

改动（3 文件 + 2 个 i18n 目录）：

1. `packages/jdm-editor/src/components/decision-graph/nodes/custom-node/index.tsx`——默认 `renderNode` 恢复按钮：从 `useDecisionGraphActions()` 取回 `openTab`，用新 i18n 的 `useT()` 渲染 `<Button key='edit-expression' onClick={() => openTab(id)}>{t('<key>')}</Button>`（key 命名对齐 theming/messages 现有惯例，如 `dg.node.editExpression`）
2. `packages/jdm-editor/src/components/decision-graph/graph/graph.tsx`——未注册类型的 fallback GraphNode 同步恢复
3. `packages/jdm-editor/src/theming/messages/en.ts` + `zh-CN.ts`——新增 key：en `'Edit Expression'` / zh `'编辑表达式'`

## Bug 2：模拟器面板恢复底部全宽停靠

**根因**：`4ebb7d9e` 转 Tailwind 时丢失全部 grid-area 赋值，面板被自动布局塞进右侧窄列（模板 `'sidebar graph component' / 'bottom bottom component'` 仍在 tailwind.css）。

改动（3 文件，纯 className 追加）：

1. `dg-panel.tsx`——Resizable 根节点追加 `[grid-area:bottom]`（这一条即恢复底部全宽）
2. `graph/graph-side-toolbar.tsx`——根节点追加 `[grid-area:sidebar]`
3. `dg-wrapper.tsx`——内容 div 追加 `[grid-area:graph]`（2/3 保证 `hidden-left-toolbar` 变体模板也正确归位）

## Bug 3：business 模式单元格高度对齐

**根因**：重构丢失 master 的构建器内边距（`.eb/.seb { padding: 7px 8px }`），business 盒子 23.5px vs dev 单元格 37.5px。

改动：

1. `table-default-cell.tsx`（:204 input 与 :219 output 两处容器）——`'relative w-full [--b-font-size:14px]'` 追加 `py-[7px] px-2`（23.5 + 14 = 37.5px，与 dev 精确对齐；改容器不改构建器根，避免影响独立使用场景）
2. `business/expression-builder/value-inputs.tsx` StrInput——追加 `border-0! shadow-none!`（消除比其他控件高 2px 的边框与可见矩形）
3. 顺手的原语修缮（同为 business 单元格内可见问题，风险收敛于 suffixIcon={null}/controls={false} 的现有调用方）：`primitives/select.tsx` 在 `suffixIcon === null` 时隐藏 Radix 下拉箭头；`primitives/input-number.tsx` 真正消费 `controls={false}` 隐藏步进箭头

## 验证

1. `pnpm build`（两包）+ `pnpm verify` 全量门禁
2. `pnpm size` 预算（改动为样式/JSX 级，预算余量充足）
3. Storybook 构建，人工核对三处回归点（画布 debug 节点按钮、模拟器底部停靠、business 单元格对齐）；必要时用浏览器工具截图确认

## 提交

三个 bug 各一个 commit（`fix(decision-graph): ...` ×2、`fix(decision-table): ...`），全部在 reui 分支推送；完成后提示是否同步回 main（按此前约定 main 为默认开发线，通常应回并）
