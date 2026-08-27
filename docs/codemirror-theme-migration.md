# CodeMirror 皮肤层叠问题与 EditorView.theme() 迁移计划

> 2026-08：决策表单元格「展示态(高亮器) ↔ 编辑态(CodeMirror)」切换时单击失效与光标偏移的根因复盘，
> 以及把 CSS 皮肤迁移进 CodeMirror 原生主题 API 的长期方案。

## 1. 背景与根因

### 1.1 层叠战争（CSS cascade layers vs runtime-injected `<style>`）

CodeMirror 6 在运行时把自己的 baseTheme 以**未分层(unlayered)**普通 `<style>` 注入 `<head>`
（如 `.ͼ1 .cm-content { padding: 4px 0 }`、`.ͼ1 .cm-line { padding: 0 2px 0 6px }`、`.ͼ1 .cm-scroller { line-height: 1.4 }`）。

层叠规则：**任何未分层规则，无条件击败所有 `@layer` 内的同重要性规则**——与选择器权重、书写顺序无关。
本库的 CodeMirror 皮肤原本写在 `tailwind.css` 的 `@layer components` 里，因此全部落败；
而 antd 时代的 `ce.scss` 是非分层裸 SCSS，天然免疫——这就是迁移后才出现回归的原因。

这与决策图区块早已踩过的坑同源（`@xyflow/react` 的样式也是未分层注入，见 `tailwind.css`
中 Decision-graph 一节的注释）；CodeMirror 区块漏掉了这条原则。

### 1.2 实测偏差（修复前）

对同一单元格逐一测量计算样式：

| 属性 | 展示态(高亮器) | 编辑态(CodeMirror) | 结果 |
| --- | --- | --- | --- |
| `.cm-content` padding | 9px 12px（单元格 token 生效） | **4px 0px**（CM 注入胜出） | 上边差 5px |
| `.cm-line` padding | 0 | **0 2px 0 6px**（CM 注入胜出） | 左边差 ~6px |
| 行高 | 21px (`--ce-lineHeight:1.5em`) | **19.6px (1.4)**（CM 注入胜出） | 多行累计漂移 |

## 2. 已落地修复（`src/styles/tailwind.css`）

1. **整个 CodeMirror 皮肤块移出所有 layer**（`.grl-ce …` 与 `.grl-ce-highlighter …`），
   置于文件未分层第三方区，与决策图区块相邻。这样多数规则与 CM 注入规则进入同一"赛道"。
2. 对**实测碰撞的三处声明**追加 `!important`——因为 CM 的 `<style>` 在文档中靠后，
   同特异性并列时按顺序获胜，仅移出 layer 不够：
   - `.grl-ce .cm-scroller { line-height: inherit !important; }`
   - `.grl-ce .cm-content { padding: var(--ce-verticalPadding) var(--ce-horizontalPadding) !important; }`
   - `.grl-ce .cm-line { padding: 0 !important; }`
   - 连带：`.grl-ce-preview … .cm-content { padding: 0 !important; }`（预览覆写需继续压制基础值）
3. **陷阱记录**：token 默认值 `.grl-ce { --ce-lineHeight / --ce-verticalPadding / --ce-horizontalPadding }`
   必须保留在一个小型 `@layer components` 块内。首次迁移时曾把它们一并移出 layer，
   导致未分层默认值压过单元格上 utilities 层的 `[--ce-verticalPadding:9px]`
   （自定义属性同样受层叠支配），全部单元格静默回退为 4px/11px。规范：
   *“要被 utilities 覆盖的 token 默认值放 layer，要赢过运行时注入的几何规则不进 layer。”*

### 2.1 验证（Playwright 探针 @ Storybook :9009，story: decision-table--uncontrolled）

```
contentPad 两态均为 9px 12px（来自单元格 token）
line-height 两态均为 21px；cm-line padding 均 0
首行文本盒 dX = 0.00、dY = 0.00
```

残余良性差异：编辑态 `.cm-content` 被 CM 的 `min-height:100%` 撑满容器（展示态为自然高）。
首行坐标不受影响，属空编辑器点击命中区行为，不作处理。

门禁：typecheck ✅ / vitest 206✅ / lint:compiler 0 error ✅。

## 3. 备选方案（长期）：迁移到 `EditorView.theme()`

CSS 层叠方案能赢，但每条碰撞都要显式 `!important` 或换赛道，维护成本随 CM 版本增长。
CodeMirror 提供的主题扩展 API 天然处于正确优先级区间，可一劳永逸消除这场战争。

### 3.1 动机

- **优先级由框架保证**：`EditorView.theme(spec, { dark })` 生成的是 editor-scoped class（如 `ͼf5`）前缀规则，
  生成在 baseTheme 之后注入，且特异性高于 baseTheme——无需 layer/!important 参战。
- **作用域自动限定**：样式只作用于挂载该 theme 的 EditorView 实例，不再全局污染 `.cm-*`。
- **静态消亡项**：`.grl-ce-highlighter` 手工 DOM（ce-highlight.tsx）不复存在时，对应 CSS 可整体删除。

### 3.2 映射表（皮肤 → theme spec）

| 现 CSS 选择器 | 去向 |
| --- | --- |
| `.grl-ce .cm-editor`（背景/圆角/focus 光环/severity 底色） | `theme({ '&': …, '&.cm-focused': …, '&[data-severity=…]': … })` |
| `.grl-ce .cm-content`（padding/wrapping） | `'& .cm-content'` |
| `.grl-ce .cm-line`（padding/caret-color） | `'& .cm-line'` |
| `.grl-ce .cm-scroller`（font-family/line-height） | `'& .cm-scroller'` |
| completion / tooltip / lint 视觉（`.cm-tooltip*`、`.cm-completionIcon*` 等） | `'& .cm-tooltip'…` 子键，或并入现有 `zenStyleLight/Dark` HighlightStyle |
| `.grl-ce.max-rows/.full-height/.no-style/.grl-ce-single` | **留在 Tailwind**：这是组件自有布局类，不是 CM DOM 皮肤 |
| token 默认值 `--ce-*` | 组件 prop / inline style（替换现 `--editorMaxRows` 传递方式），彻底告别 layer 问题 |

`maxRows` 高度公式 `calc(3px + N*lh + 2*vpad)` 建议由组件直接算出像素后作为 inline style 下发，
theme 只管视觉。

### 3.3 实施步骤

1. 新增 `code-editor/theme.ts`：导出 `zenTheme(dark: boolean, tokens: CeTokens): Extension`，纯数据结构。
2. `ce-base.tsx` 用新 Compartment `themeExt` 挂载，替换现 `compartment.theme.of(editorTheme(...))` 中的
   HighlightStyle 部分（语法配色仍走 HighlightStyle，不动）。
3. `ce.tsx` 把单元格 token(`9px/12px`) 作为 props 下发，删掉 table-default-cell 的 `[--ce-*]` 工具类。
4. 按 3.2 表逐条删除 `tailwind.css` 未分层区中的对应规则，每删一批跑一次 §2.1 探针脚本。
5. 全量门禁 + Storybook 目测（cells / field-edit / preview / hover-tooltip 四场景）。

### 3.4 风险与回滚

- Tooltip/completion 为 portal 渲染于 view 外部时，theme 仅作用于 view 树内部元素——确认过 CM6 tooltips
  挂载于 `.cm-editor` 内（含 fixed 定位），可被 theme 覆盖；若个别子树例外，为其单独保留少量非 layer CSS。
- 每个 CodeEditor 实例重复携带同样字符串成本 ≈ 忽略量级（KB 级×实例数)，如在意可模块级缓存 theme Extension。
- 回滚：第 4 步按批提交，任一批异常 revert 该批即可回到当前已验证状态。
