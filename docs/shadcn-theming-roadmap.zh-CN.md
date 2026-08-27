# shadcn/ReUI 一键换肤路线图（长期计划）

> **文档地位**：CSS/主题体系的长期目标架构与分阶段实施计划。
> 2026-08 由「决策表单元格交互 bug 修复」（单击切换退化 + 光标偏移，见
> `codemirror-theme-migration.md` 与 `troubleshooting.zh-CN.md`）引出：
> 层叠 hack 只能救急，系统性换肤能力需要按本路线收敛。
>
> 维护约定：本文暂为中文单语（仓库默认英文为准 + zh-CN 对照的规则对此文档**豁免**，
> 与 `docs/README.md` 的例外说明一致）。

---

## 0. 一键换肤验收标准

满足以下全部条件时，「换一套风格」才是平滑的：

| # | 标准 | 判定方式 |
|---|---|---|
| A1 | 新皮肤只需提供 4~8 个种子值（brand/success/warning/error/中性轴/radius/font）或一个语义变量覆盖块 | 新增一份主题文件后目测全站 |
| A2 | 组件源码、`tailwind.css` 规则、第三方皮肤（CodeMirror/Monaco）零改动 | `git diff` 仅含 token 文件 |
| A3 | 无 `!important` 存量参与换肤路径；未分层 CSS 不再增长 | CI 预算断言（§P4） |
| A4 | 明暗切换、品牌切换两个维度正交，可任意组合 | Storybook Theming/Seeds Playground（Batch E/F 达成 ✅） |
| A5 | 编辑器态调色板（语法高亮、Monaco）跟随 token 派生而非独立硬编码 | 目测 + 断言 |

## 1. 现状：三层 token 管道

```
JdmConfigProvider(theme.tsx)
  ├─ lightTokens/darkTokens 手写 hex 表 (~35 项 ×2)
  └─ GlobalCssVariables → 运行时注入 --grl-* 于 :root
          │
tokens.css   语义桥接层
  └─ --primary/--border/--ring … = var(--grl-color-primary) (+ 静态回退)
          │
tailwind.css @theme inline
  └─ bg-primary / border-border … 工具类在构建期内联为 var() 引用
```

已达标项：`@theme inline` ✅ · `[data-mode='dark']` 域覆盖式暗色 ✅ · provider `token` 直通注入 ✅。

结构性问题（即本路线要解决的）：

1. **双重真源**：`theme.tsx` 手写整张色阶表 + 多处 light/dark 三元硬编码——新皮肤需重抄全表。
2. **组件级泄漏**：14 处硬编码 hex 在 token 管道之外（HK-09~12 等，见附录 A）。
3. **层叠债务**：CodeMirror 皮肤未分层 + `!important` 存量；任何换肤都会被第三方运行时样式反噬（本次 bug 的直接教训）。
4. **`:root` 全局注入**：单页仅一个主题实例，且污染宿主根节点（§P3）。

## 2. 分阶段路线

> 决策记录（2026-08）：**优先修用户可见的交互 bug，长期能力按阶段推进；
> P3 因改变宿主可见行为单独立项。**

### P0 — 种子派生替代手写色阶（核心）✅ v1 已落地（2026-08，Batch C）
- `theme.tsx` 内部改为 种子(seed) → OKLCH `color-mix()` 派生 → 全量 `--grl-*` 输出。
- **公共 API 不变**：`JdmConfigProvider.token` 的 antd 词表键名继续接受并生效，内部映射到种子派生——不破坏现有宿主。
  ✅ 实施为 additive API：`<JdmConfigProvider seeds={{primary,...}}>`；无 seeds 时默认走冻结校准表（字节级回归零风险）。
- 中性灰轴也走派生（oklch 色相旋转 0°），删除 `--grl-color-border-hover/-fade`、`--grl-color-primary-bg-fade` 三处 light/dark 三元字面量。
  ✅ 三元已收编至 `MODE_EXTRAS` 常量表（theme.tsx 导出）。
- editor chrome 静态项（`--tooltip-bg`、`--diagnostic-chip-bg`、`--error-line-bg`）已随 theme()/tokens 消费链归位。
- **phase-2 ✅（2026-08 Batch F）**：暗色品牌族改用零依赖 OKLab——以 dark-ops.ts 烘焙锚点做
  hue 旋转，亮部键按种子亮度比缩放；不变式测试守护（默认种子字节透传、自定义种子 hue 跟随）。
  浅色仍为线性光混合梯子（warningBorder Δ66 容差如前登记）。

### P1 — 关闭组件级硬编码泄漏（14 处）
- tokens.css 新增业务语义组：`--grl-field-input(-border/-hover)`、`--grl-field-output(-border/-hover)`、`--grl-field-*-foreground`。
- 替换 HK-10/11/12（field 胶囊与 Excel 弹窗共用一组）、HK-13（placeholder 色 → `var(--grl-color-text-placeholder)`）、HK-09 的 `#fff`。
- 双层结构期间这些变量同样由 P0 派生输出。

### P2 — 层叠清偿（第三方皮肤归位）
- CodeMirror 皮肤迁入 `EditorView.theme()` 扩展（详案：`codemirror-theme-migration.md` §3，含映射表与五步法）。
- 回归护栏先行落地：`ce.stories.tsx` **LazyParity** story 已就位（单次点击进编辑 + 展示/编辑首行坐标差 ≤0.5px + padding 相等），迁移期间每批删除都跑它。
- 目标：`!important` 存量归零；未分层区仅剩决策图段且逐块收缩到 React Flow 节点自己的 className API + utilities。

### P3 — 作用域化注入（独立后期项 ⚠️）
- `GlobalCssVariables` 的 `:root` 注入改为「最近 `.grl-root` 容器优先，无则回退 :root」；`data-mode` 同理改挂容器。
- 收益：多主题岛屿并存、不再污染宿主根节点——**一键换肤的真正使能器**。
- **顺带清偿 HK-14**：Portal 一律以最近 `.grl-root` 为 `container` 后，作用域 preflight
  （box-sizing 等）重新覆盖 portaled 弹层，Modal 里那次显式 `border-box` 补丁即可退役；
  Radix Portal 加 container 同属此批工作。
- ⚠️ 改变宿主可见全局行为（选择器不再落在 documentElement 上），需通知所有接入方回归验证后再上。
- 依赖：P0/P1/P2 完成，避免两头同时动。

### P4 — 护栏固化（贯穿各阶段）🟡 部分落地（Batch A/E）
- CI 计数断言：原始 hex 白名单外新增即 fail；`!important` 预算只减不增。✅ `pnpm lint:debt`（Batch A），⚠️ 尚未挂 CI runner，经 `pnpm verify` 聚合入口（Batch E）统一执行
- 几何对齐探针进 `test-storybook`（依托 LazyParity）。✅ 已随静态套件运行
- Storybook 加 modes × palettes 组合预览页。✅ **Theming / Seeds Playground** story（Batch E；『应用到页面』留待 P3）

## 3. 双层结构决策记录

**决定**：保留双层（`--grl-*` 运行时层 + shadcn 语义桥接层），先脱钩后扁平化。

- ~~过渡期：`--grl-*` 键名不变、但取值来源从「antd 词表手抄」改为「种子派生」~~
  ✅ **过渡期完成**（2026-08 Batch C）：默认种子走冻结校准表，宿主传 `seeds` 即触发
  `theming/derive.ts` 派生覆盖（浅色），显式 token 仍最高优先。
- 终态：扁平化为 shadcn 语义名单层；`--grl-*` 标记 `@deprecated` 并分两批移除——第一批移除未被桥接引用的键，第二批随消费方改为语义名一并清空。（待 P2/P4 收口后启动）

## 附录 A — 样式债务注册表

> 全局检索命令：`rg -n 'GRL-STYLE-HACK' packages/jdm-editor/src`
> 类别：cascade-layer（未分层覆盖）· important（!important 压制）· hardcoded-color（脱离 token 的字面色）· vendor-dom（工具类反制第三方 DOM）· inline-beat（对抗内联样式）
> 状态列为 2026-08 批次执行进度：Batch A = portal border-box + 护栏；Batch B = P1 硬编码收口。

| ID | 位置 | 类别 | 内容摘要 | 归属阶段 | 状态 |
|---|---|---|---|---|---|
| HK-01 | ~~tailwind.css json-tree 对抗块~~ → function-debugger-log.tsx theme 注入 | ~~inline-beat~~ 原语内 theme | react-json-tree 0.20 的 `tree.display` + `value` stylable 函数按 keyPath 复刻默认缩进、根节点贴左；6 条 `!important` 与整块 CSS 删除（2 条死选择器一并清退） | P2 | ✅ Batch G |
| HK-02 | ~~tailwind.css `.grl-inline-tabs`~~ → primitives/tabs.tsx compact 分支 | ~~important~~ utilities | tablist/tab 间距节奏改由原语内部 utilities 承载（m-0 p-0! / px-3.5 text-[13px]），调用点零改动 | P2 | ✅ Batch D |
| HK-03 | tailwind.css CM 皮肤横幅 | cascade-layer | ~~整个 CodeMirror 皮肤未分层~~ **phase-1 已迁入 `code-editor/theme.ts`（EditorView.theme）**，未层残段=高亮器骨架+布局类；Spike 证实候选 A 内存 +36% 出局 → 残段转为「长期共存+测试守护」（见 migration doc §3.5；池化复活路径设计已归档 §3.6，触发条件见该节） | P2 | 🔒 关闭（共存） |
| GRL-LAYER-GUARD | tailwind.css `@layer components { .grl-ce {--ce-*} }` | （正向范例）| token 默认值必须留 layer——移出曾致单元格静默回退 4px/11px | 勿动 | — |
| HK-04 | tailwind.css `[data-severity]` 三连 | important | severity 底色压制 CM baseTheme → theme() 内自然胜出 | P2 | ✅ Batch D |
| HK-05 | tailwind.css scroller/content/preview 几何声明 | important | 光标偏移修复本体 → 全部 var() 化进 theme()，LazyParity dX/dY=0.00 | P2 | ✅ Batch D |
| HK-06 | tailwind.css completion/tooltip/lint 视觉群 | important | 整簇随 skin 进 theme()；`#f5f5f5` 顺带归位 `--tooltip-bg` token | P2 | ✅ Batch D |
| HK-07 | tailwind.css hover-tooltip + 高亮器 flex 骨架 | important | hover-tooltip 已入 theme()；高亮器骨架 CSS 转为长期共存（Spike 决策，§3.5） | P2 | 🔒 关闭（共存） |
| HK-08 | tailwind.css 决策图区横幅 | cascade-layer | 为胜过 @xyflow/react 未分层样式而整体裸奔（有意为之，需逐步收缩）。Batch 收缩已执行：自有 DOM 子集（edge-delete/palette）迁 @layer components，余下 react-flow__* 为平台约束长期共存 | P2 后期 | 🟡 已收缩 |
| HK-09 | tailwind.css Excel 向导段 + `color:#fff` | cascade-layer + hardcoded-color | 选择器式控件对齐 + 白色激活态字面量（hardcoded 部分已并入 `--grl-color-text-light-solid`） | P1+P2 | color ✅ Batch B · selector 段留 P2 |
| HK-10 | field-edit-popover.tsx 胶囊 triggerClassName 默认 | hardcoded-color | `#acccec`/`#8ab8de` 输入胶囊 → `--grl-color-field-input(-hover)` | P1 | ✅ Batch B |
| HK-11 | output-field-edit.tsx triggerClassName | hardcoded-color | `#c7e0ba`/`#a8cc96` 输出胶囊 → `--grl-color-field-output(-hover)` | P1 | ✅ Batch B |
| HK-12 | graph-excel-dialog/index.tsx dataTypeConfig | hardcoded-color | 列章鱼色 → 同一组 field token（var() 内联保活换肤） | P1 | ✅ Batch B |
| HK-13 | expression-item.tsx DiffCodeEditor className | vendor-dom + hardcoded-color | placeholder hex → `--grl-color-text-placeholder`；几何统一 `--ce-*:12px`（pr-[60px] 控件槽保留） | P1 | ✅ Batch B |
| HK-14 | tailwind.css 作用域 preflight 边界 + primitives/modal.tsx | boundary（结构性缺口） | Radix Portal 挂载于 `<body>`、逃出 `.grl-root`，`:where(*){box-sizing:border-box}` 够不到 → 全部 portaled 弹层隐式 content-box。排查全录见 troubleshooting 案例 #4 | P3 | 六原语已加显式 `box-border`（Batch A）✅；portal 归属作用域留 P3 |

另有三类**显式豁免**（非债）：`theme.tsx`/`tokens.css`（token 真源）；编辑器调色板（diagnostic.tsx / function-debugger-log.tsx / ce-preview BugIcon——随 P0 纳入派生通道即可）；stories 演示样式（沙盒）。
