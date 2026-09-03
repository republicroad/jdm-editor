# JDM Editor — Internal Fork Documentation / 内部维护文档索引
> **Live storybook (interactive demo) / 在线演示:** https://republicroad.github.io/jdm-editor/

> **Fork notice / 分叉声明**
> This repository is an internally maintained fork of [gorules/jdm-editor](https://github.com/gorules/jdm-editor).
> Baseline: upstream `master` at commit `283bb11` (`chore(release): publish`). The fork intentionally diverges
> from upstream (planned: ReactFlow 12, shadcn/ui + ReUI stack) and will not track upstream merges.
>
> 本仓库是 [gorules/jdm-editor](https://github.com/gorules/jdm-editor) 的内部长期维护分叉。
> 基线为上游 `master` 提交 `283bb11`。本分叉将按既定技术栈路线(ReactFlow 12、shadcn/ui + ReUI)演进,不同步上游。

## Document map / 文档地图

| Document / 文档 | Language | Contents / 内容 |
|---|---|---|
| [`architecture.md`](./architecture.md) | EN | System architecture: monorepo layout, package graph, state flow, editor infrastructure, theming, CI |
| [`architecture.zh-CN.md`](./architecture.zh-CN.md) | 中文 | 架构文档(中文对照):仓库结构、包依赖、状态流、编辑器基础设施、主题系统、CI |
| [`features.md`](./features.md) | EN | Feature reference: Decision Graph, Decision Table, editors, simulator, public API surface |
| [`features.zh-CN.md`](./features.zh-CN.md) | 中文 | 功能文档(中文对照):决策图、决策表、编辑器、模拟器、公共 API |
| [`migration/01-reactflow-v12.md`](./migration/01-reactflow-v12.md) | EN | ReactFlow 11 → `@xyflow/react` 12 migration plan (executed on this branch) |
| [`migration/01-reactflow-v12.zh-CN.md`](./migration/01-reactflow-v12.zh-CN.md) | 中文 | ReactFlow 12 迁移方案(中文对照,已在本分支实施) |
| [`migration/02-ui-stack-shadcn-reui.md`](./migration/02-ui-stack-shadcn-reui.md) | EN | Migration record: antd → Tailwind + shadcn/ui + ReUI (completed) |
| [`migration/02-ui-stack-shadcn-reui.zh-CN.md`](./migration/02-ui-stack-shadcn-reui.zh-CN.md) | 中文 | UI 技术栈迁移记录(中文对照,已完成) |
| [`migration/03-post-migration-fixes.md`](./migration/03-post-migration-fixes.md) | EN | Post-migration regression fixes: node color vars, fitView, ellipsis icon, Radix ref anchoring |
| [`migration/03-post-migration-fixes.zh-CN.md`](./migration/03-post-migration-fixes.zh-CN.md) | 中文 | 迁移后回归修复(中文对照):节点色变量、fitView、竖向三点图标、Radix ref 锚点 |
| [`migration/04-react-19.md`](./migration/04-react-19.md) | EN | React 18 → 19 upgrade record (+ zustand 5), peer policy kept `>=18`, dual-host verification |
| [`migration/04-react-19.zh-CN.md`](./migration/04-react-19.zh-CN.md) | 中文 | React 19 升级记录(中文对照,含 zustand 5),peer 保持 `>=18`,双宿主验证 |
| [`migration/05-dnd-kit.md`](./migration/05-dnd-kit.md) | EN | react-dnd → @dnd-kit/core rewrite across four drag scenarios; manager prop removed |
| [`migration/05-dnd-kit.zh-CN.md`](./migration/05-dnd-kit.zh-CN.md) | 中文 | react-dnd → @dnd-kit 改写(中文对照,四个拖拽场景),移除 manager 属性 |
| [`styling-scss-vs-tailwind.md`](./styling-scss-vs-tailwind.md) | EN | SCSS vs Tailwind comparison & decision guide: utility classes, build-time scanning, runtime data-driven coloring, plain-CSS boundary, SCSS applicable scenarios, migration target |
| [`styling-scss-vs-tailwind.zh-CN.md`](./styling-scss-vs-tailwind.zh-CN.md) | 中文 | SCSS 与 Tailwind 对比与选型指南(中文对照):工具类、构建时扫描、运行时数据驱动着色、纯 CSS 边界、SCSS 适用场景、迁移目标 |
| [`codemirror-theme-migration.md`](./codemirror-theme-migration.md) | EN | CodeMirror skin cascade-layer debt: root cause of display↔edit cursor drift, the accepted CSS workaround, the EditorView.theme() migration (Batch D log + iteration trajectory), the Spike-A reject memo, and the archived pooled-revival path |
| [`codemirror-theme-migration.zh-CN.md`](./codemirror-theme-migration.zh-CN.md) | 中文 | CodeMirror 皮肤层叠债(中文对照):光标漂移根因、已接受 workaround、theme() 迁移实录与迭代轨迹、Spike-A 否决备忘、池化复活路径归档 |
| [`shadcn-theming-roadmap.md`](./shadcn-theming-roadmap.md) | EN | One-click retheming roadmap: acceptance criteria, token pipeline review, P0–P4 phases (seed derivation incl. OKLab dark, hardcoded closure, cascade cleanup incl. Spike-A verdict, scoped injection deferred, CI guards), double-layer decision record, style-debt registry |
| [`shadcn-theming-roadmap.zh-CN.md`](./shadcn-theming-roadmap.zh-CN.md) | 中文 | 一键换肤长期路线图(中文对照):验收标准、token 管道、P0–P4 阶段计划、双层结构决策记录、样式债务注册表(GRL-STYLE-HACK 索引) |
| [`editor-engines.md`](./editor-engines.md) | EN | CodeMirror 6 vs Monaco: usage matrix (table cells / expressions / function body / simulator / JSON schema), the four decisive selection dimensions, and the shared token-theming contract |
| [`editor-engines.zh-CN.md`](./editor-engines.zh-CN.md) | 中文 | 编辑器引擎选型说明(中文对照):CodeMirror 6 与 Monaco 的场景矩阵、四个决定性选型维度、共享 token 主题契约 |
| [`storybook.md`](./storybook.md) | EN | Storybook guide: configuration (main.ts/preview.tsx), decorator setup (.grl-root scoped injection), story inventory (57 stories), interaction test pipeline (test:storybook), height chain, multi-island testing |
| [`storybook.zh-CN.md`](./storybook.zh-CN.md) | 中文 | Storybook 指南(中文对照):配置(main.ts/preview.tsx)、装饰器设置(.grl-root 作用域注入)、story 清单(57 个)、交互测试流水线(test:storybook)、高度链、多岛测试 |
| [`i18n.md`](./i18n.md) | EN | i18n guide: provider setup via JdmConfigProvider, useT/createT, en+zh-CN catalogs, fallback chain, interpolation, coverage and known limitation (renderNode specs) |
| [`i18n.zh-CN.md`](./i18n.zh-CN.md) | 中文 | 国际化指南(中文对照):Provider 接入、useT/createT、en+zh-CN 词条表、回退链、插值、覆盖范围与已知限制(renderNode 规格回调) |
| [`troubleshooting.md`](./troubleshooting.md) | EN | Debugging case log: symptom → investigation → root cause → fix → verification |
| [`troubleshooting.zh-CN.md`](./troubleshooting.zh-CN.md) | 中文 | 排查案例记录(中文对照):压力测试冻结渲染进程的高度链问题、布尔下拉静默失效的 Radix 字符串强转问题、`asChild`+Tooltip 组合吞掉弹层事件与 Portal 逃逸作用域 preflight(Map Excel Data 按钮失效/弹窗溢出)等 |
| [`host-migration-guide.md`](./host-migration-guide.md) | EN | Host migration guide: @gorules → @republicroad quick switch, breaking changes, --grl-* contract, 0.2.x additions (new exports, DecisionGraph props, custom node authoring, i18n increments), 0.3.0 heads-up |
| [`host-migration-guide.zh-CN.md`](./host-migration-guide.zh-CN.md) | 中文 | 宿主迁移指南(中文对照):快速切换、破坏性变更、--grl-* 契约、0.2.x 新增(导出、DecisionGraph 属性、自定义节点开发、i18n 增量)、0.3.0 预告 |
| [`roadmap-0.3.0.md`](./roadmap-0.3.0.md) | EN | 0.3.0 draft roadmap: monaco peer move (staged), trigger-gated majors (pooled flag, L2 sweep, --grl-* deprecation), new candidates (code splitting, drag keyboard support) |
| [`roadmap-0.3.0.zh-CN.md`](./roadmap-0.3.0.zh-CN.md) | 中文 | 0.3.0 路线草案(中文对照):monaco peer 化(已就位)、触发门控 major 项(池化开关、L2 清扫、--grl-* 废弃)、新候选(代码分割、拖拽键盘支持) |

English files are canonical; `.zh-CN.md` files are translations kept in sync.
英文文档为准,`.zh-CN.md` 为同步维护的译文。


## CI / Release / 快速命令

| 操作 | 命令 |
|---|---|
| 全量本地门禁 | `pnpm verify` |
| 样式债务预算 | `pnpm lint:debt` |
| Playwright 探针(UI 冒烟) | `pnpm test:probes` |
| npm 安装冒烟 | `pnpm test:npm-smoke` |
| Storybook 交互套件 | `pnpm --filter @republicroad/jdm-editor test:storybook` |
| 双宿主冒烟 (React 18+19) | `pnpm test:consumer` |
| Bundle 尺寸检查 | `pnpm size` |
| 版本发布触发 | `git commit --allow-empty -m "chore(release)" && git push` |
| 版本号升级 | GitHub Actions → Version → Run workflow → 选 patch/minor/major |

详见 [CONTRIBUTING.md](../CONTRIBUTING.md) CI Workflows 一节。

## Quick facts / 快速事实

- Main deliverable: `@republicroad/jdm-editor` — React component library for JDM (JSON Decision Model) editing.
  主要产物:`@republicroad/jdm-editor`,用于编辑 JDM(JSON Decision Model)的 React 组件库。
- Support packages (`@gorules/lezer-zen`, `@gorules/lezer-zen-template`, `@gorules/zen-engine-wasm`)
  are consumed **from npm**, not from this repository.
  支撑包(`@gorules/lezer-zen`、`@gorules/lezer-zen-template`、`@gorules/zen-engine-wasm`)直接取自 npm,不在本仓库内维护。
- Stack / 技术栈:React 19 (peer `>=18`) · Tailwind CSS + shadcn/ui primitives · zustand 5 · reactflow → @xyflow/react · CodeMirror 6 · Monaco · TanStack Table · Vite 7 · Storybook 10 · Rust/WASM engine bindings.
- Host integration / 宿主接入:Consumers wrap their app in a `.grl-root` container to opt in to the scoped mini-preflight (form controls, tables, headings, lists, images). The reset uses `:where()` (zero specificity) so component classes always win and never leak into the host document.
  消费方在最外层容器挂 `grl-root` 类以启用库作用域 mini-preflight(表单控件、表格、标题、列表、图片)。重置规则全部使用 `:where()`(零特异性),组件类天然胜出,不会泄漏到宿主文档。
