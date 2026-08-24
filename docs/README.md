# JDM Editor — Internal Fork Documentation / 内部维护文档索引

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
| [`troubleshooting.md`](./troubleshooting.md) | EN | Debugging case log: symptom → investigation → root cause → fix → verification |
| [`troubleshooting.zh-CN.md`](./troubleshooting.zh-CN.md) | 中文 | 排查案例记录(中文对照):压力测试冻结渲染进程的高度链问题等 |

English files are canonical; `.zh-CN.md` files are translations kept in sync.
英文文档为准,`.zh-CN.md` 为同步维护的译文。

## Quick facts / 快速事实

- Main deliverable: `@gorules/jdm-editor` — React component library for JDM (JSON Decision Model) editing.
  主要产物:`@gorules/jdm-editor`,用于编辑 JDM(JSON Decision Model)的 React 组件库。
- Support packages (`@gorules/lezer-zen`, `@gorules/lezer-zen-template`, `@gorules/zen-engine-wasm`)
  are consumed **from npm**, not from this repository.
  支撑包(`@gorules/lezer-zen`、`@gorules/lezer-zen-template`、`@gorules/zen-engine-wasm`)直接取自 npm,不在本仓库内维护。
- Stack / 技术栈:React 19 (peer `>=18`) · Tailwind CSS + shadcn/ui primitives · zustand 5 · reactflow → @xyflow/react · CodeMirror 6 · Monaco · TanStack Table · Vite 7 · Storybook 10 · Rust/WASM engine bindings.
- Host integration / 宿主接入:Consumers wrap their app in a `.grl-root` container to opt in to the scoped mini-preflight (form controls, tables, headings, lists, images). The reset uses `:where()` (zero specificity) so component classes always win and never leak into the host document.
  消费方在最外层容器挂 `grl-root` 类以启用库作用域 mini-preflight(表单控件、表格、标题、列表、图片)。重置规则全部使用 `:where()`(零特异性),组件类天然胜出,不会泄漏到宿主文档。
