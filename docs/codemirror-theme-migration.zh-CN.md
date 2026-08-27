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

### 2.2 Batch D（phase-1）迁移实录与迭代轨迹（2026-08，`bc2cd84`）

皮肤整体迁入 `code-editor/theme.ts` 后，几何守卫探针的回归轨迹完整记录如下——
每一轮 FAIL 都对应一类「共享规则被误删/被 theme 接管后高亮器失联」的问题，
修复手段也成为**残留 CSS 的边界清单**：

| 迭代 | dX / dY | 暴露问题 | 修复 |
| --- | --- | --- | --- |
| 初迁 | content pad 4px11px、lh 24 vs 高亮器 0/normal | 删除了共享的 `.grl-ce .cm-content/-scroller/-line` 几何规则——**高亮器手工 DOM 不经过 theme()** | 在 marker 后补 `Highlighter PARITY ONLY` 块（lh/pad/scroller 字体仅作用于 `.grl-ce-highlighter`） |
| 二迁 | dx=dy=1.00 | 真实编辑器经 theme() 拥有 1px 边框，高亮器侧丢边框 | 补 `.grl-ce-highlighter .cm-editor { border: 1px solid var(--grl-color-border) }` |
| 终态 | **dX=0.00 / dY=0.00** + padding/lh 全等 | — | 奇偶校验块封版；LazyParity 持续守护 |

经验并入检查清单：
- **theme() 只覆盖真编辑器**：任何与编辑器共享视觉的兄弟 DOM（高亮器、预览）
  需要独立奇偶块，删除共享规则前必须枚举其全部消费者。
- **1px 边框也会进探针雷达**：盒模型参与方（border/padding/min-height）逐一核对，
  不要假设“视觉小差异”在 caret 定位里无害。

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

1. ✅（Batch D phase-1，`bc2cd84`）新增 `code-editor/theme.ts`：单对象 `buildZenSkin(): Extension`
   （值全部 var() 引用，明暗/token 覆盖零重注册），ce-base 追加于扩展列表最末。
2. ✅ 同批：按 3.2 表删除 tailwind.css 对应规则 315 行；`!important` 存量 35→18；
   straggler `#f5f5f5` 归位 `--tooltip-bg`。
3. ⬜ **phase-2 前置设计（gated）：高亮器替换**——当前 `CodeHighlighter` 手工 DOM 是
   lazy 态性能优化（免 EditorView 常驻）。替换候选：(a) 只读共享单例 EditorView + 视口复用，
   (b) 静态 SVG/HTML 渲染管线。**在方案评审通过前**，其奇偶校验 CSS 块（PARITY ONLY 四则 +
   border）保留，禁止抢先删除。
4. ⬜ phase-2 执行清单：高亮器替换 → 删 PARITY 块与 `.grl-ce-highlighter` 全段 →
   LazyParity 断言改为「两侧均由 theme() 驱动」→ 注册表 HK-03/HK-07 清零。
5. ⬜ 收口：D3 padding 改 props 下发（删 `[--ce-*]` 工具类通道需先证明 theme() 内
   `var(--ce-*)` 与 utilities 覆盖解耦成立——Batch D 已实证）。


### 3.5 Spike 决策备忘录（2026-08，Batch H）——候选 A 不予实施

候选 A（只读 EditorView 替代高亮器）PoC 已按 `localStorage.gru-hl-view=1` 实装在
`ce-highlight-view.tsx`（默认关闭），三指标实测（decision-table--stress-test 10k 行 /
controlled 切换 ×5）：

| 指标 | Baseline(高亮器) | 候选 A | 结论 |
| --- | --- | --- | --- |
| heap（稳定后） | 104 MB | **141 MB (+36%)** | ❌ 决定性负项：每个可见格常驻一个 EditorView |
| 滚动 FPS | 61 | 61 | 持平 |
| 切换时延(×5 均值) | 79–148ms 区间 | 88ms | 噪声带内，无优势 |

**决定**：候选 A 出局。phase-2 重新定位为「维持高亮器 + 双轨守护」：
- PARITY 奇偶块保留（4 规则 + 边框），由 LazyParity 与 $0.00 探针持续锁定；
- 候选 B（静态管线）仅在将来出现更大规模渲染压力或 CM 高亮 API 破坏性变更时重启评估；
- 收益即本轮已得的 theme() 化本身：!important 35→15、双轨几何由测试硬锁。

删除 PARITY 块与 `.grl-ce-highlighter` 全段的既定清单作废，相应注册表
HK-03/HK-07 状态由「待删除」改为「长期共存（测试守护）」。

### 3.6 后继尝试：池化形态（Spike-A2，已归档待触发）

> 2026-08 复盘：§3.5 出局候选 A 的唯一决定性指标是稳定态 heap +36%（104→141MB）。
> 但该测量**未强制 GC**——10k 行初始渲染与滚动销毁产生的浮动垃圾可能被计入，
> 「真常驻」与「未回收垃圾」的占比未分离，因此结论标记为**可复核**，本节归档其
> 复活路径设计。

**A2 核心设计（Table 级固定容量池）**

- 容量 = 可见行 × CE列 + 2 余量；池所有权在虚拟izer之外的 Table 作用域
  （TanStack Virtual 滚动会卸载 cell，池必须挂在稳定作用域，cell 经 context
  acquire/release）。
- `acquire(cellId)`：取闲置 view → reparent `view.dom` → 全量 doc 替换（小串
  <1ms）+ compartments 重配(type/placeholder) → `view.requestMeasure()`。
- `release(cellId)`：doc 置空串防大值常驻 → 归还池；只读视图**禁用 history**
  （防跨格状态串扰），复用时显式清 selection。
- 编辑接管：点击 → release → 既有 ce-base 协议零改动（高亮器路径同构）。

**测量修正前置（翻案硬门槛）**

- Playwright 以 `--js-flags=--expose-gc` 启动，堆读数前 `window.gc()` ×2。
- Baseline / PoC 两条路径同法重测得 **Δ_true**；**Δ_true ≤ ~10%** 才进入池化
  PoC，否则本节连同 §3.5 一并永久结案。

**守卫三断言（池化 PoC 必过）**

1. 复用后光标偏移 = 0（LazyParity 同规格）；
2. 无跨格串扰：A 格 selection 不得出现在 B 格；
3. placeholder 正确渲染与清除。

**决策阈值与体量**

- 进入实施条件：Δ_true 达标 且 滚动无 long task 且 三断言全绿。
- 体量：Spike ≈0.5d；正式实施 ≈1–1.5d。

**建议触发条件**：出现滚动 long task / GC 停顿类投诉，或 CodeMirror 高亮 API
破坏性变更迫使高亮器重写时，作为首选复活路径执行本节。


### 3.4 风险与回滚

- Tooltip/completion 为 portal 渲染于 view 外部时，theme 仅作用于 view 树内部元素——确认过 CM6 tooltips
  挂载于 `.cm-editor` 内（含 fixed 定位），可被 theme 覆盖；若个别子树例外，为其单独保留少量非 layer CSS。
- 每个 CodeEditor 实例重复携带同样字符串成本 ≈ 忽略量级（KB 级×实例数)，如在意可模块级缓存 theme Extension。
- 回滚：第 4 步按批提交，任一批异常 revert 该批即可回到当前已验证状态。
