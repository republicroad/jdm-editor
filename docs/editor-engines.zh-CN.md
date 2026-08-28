# 编辑器引擎：CodeMirror 6 与 Monaco 的使用矩阵与选型理由

> 本库在哪些场景使用哪个引擎，以及为什么这样拆分是有意设计。
> 英文正典:[`editor-engines.md`](./editor-engines.md)。

## 使用矩阵

| 场景 | 引擎 | 语言/形态 |
| --- | --- | --- |
| **决策表单元格**（Zen 表达式，unary/standard） | CodeMirror 6 | 自研 DSL，`@gorules/lezer-zen` 语法 |
| **表达式节点**（expression-item） | CodeMirror 6 | 同上 |
| **Diff 展示**（diff-ce，规则变更对比） | CodeMirror 6 | 同上，行内双行 |
| **函数编辑器**（tab-function / function.tsx 脚本体） | **Monaco** | JavaScript + **DiffEditor** + 错误行标记（`MarkerSeverity` / `errorLineContent` 装饰） |
| **模拟器输入**（simulator-editor） | **Monaco** | JavaScript |
| **JSON ↔ JSON Schema 对话框 / Schema tab** | **Monaco** | JSON/JS 双向转换预览 |
| 调试台展示（只读） | CodeMirror 6 | 复用 CE 骨架 |

## 选型逻辑（四个决定性维度）

**1. 数据形态：自研 DSL vs 标准语言**

- Zen 表达式是**自研 DSL**——CodeMirror 6 的 Lezer 体系让自定义语法成为一等公民：语法树直接驱动高亮、结构化补全、hover 提示，以及以诊断形式注入的 wasm 类型检查（全部位于 `extensions/zen.ts` 与 `extensions/*`）。Monaco 的 Monarch（正则式）语法在这一层表达力弱一档，语义/类型集成需要手写。
- 函数体与模拟器是**标准 JavaScript/JSON**——Monaco 开箱提供 TS 级语义、错误标记、格式化与折叠；这些自研不现实。

**2. 实例经济学：多而小 vs 少而重**

- 决策表是 **10k 行 × 每可见格一个编辑器**的形态（虚拟化后 ~25 个存活实例）：CodeMirror 6 实例轻量、无强制 DOM 结构、可嵌入 38px 行高的格子。
- Monaco 内核 ~1MB+、单实例重——但函数/模拟器场景**每页只有 1–2 个大面积编辑器**，成本完全成立。
- 反证来自 P2 Spike：仅只读**轻量**单实例 EditorView 池就已 +36% heap——把 Monaco 塞进表格单元格根本不可行。

**3. 交互形态：行内嵌入 vs 画布式**

- CM6 无壳、可组合，适合贴着周围 UI 嵌入（单元格 `h-full`、行内 Diff、hover tooltip）。
- Monaco 是画布式 IDE 面，适合侧栏/主区的大面积编辑区。

**4. 体积策略：常驻 vs 按需**

- CM6 模块化按特性付费，随包常驻——表格/表达式主路径零额外成本。
- Monaco 走 `@monaco-editor/react` 的 **loader 模式**（`helpers/monaco.ts` 统一配置）——只有真正打开函数/模拟器/Schema 面时才加载内核，表格主路径免受 ~1MB 拖累。

## 主题接入（共享契约）

两个引擎消费同一层 `--grl-*` token：Monaco 经 `helpers/monaco.ts` 的明暗主题定义，CodeMirror 经 `EditorView.theme()` 皮肤（`code-editor/theme.ts`，Batch D）。两者都不硬编码色板字面量。

## 一句话总结

**对的语言给对的编辑器**：自研 DSL + 海量小实例 → CodeMirror 6（Lezer 一等公民、轻量、可嵌入）；标准 JS/JSON + 低频大画布 → Monaco（VSCode 级语义与 Diff/Marker 开箱即得）+ loader 按需加载隔离体积。
