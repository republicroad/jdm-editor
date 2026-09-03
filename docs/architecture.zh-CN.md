# 架构文档

> 中文对照版,英文原版:[`architecture.md`](./architecture.md)。
>
> 本文档描述分叉调整后的仓库形态:支撑包改为从 npm 引入,本仓库仅保留 `packages/jdm-editor`。

## 1. 总览

JDM Editor 是一个 React 组件库,用于构建与编辑 **JDM(JSON Decision Model)** 文档:以决策图组织节点
(决策表、函数、表达式、开关、输入/输出),每个节点配备专属编辑器。库以编译后的 ESM(`dist/`)加单一
样式表(`dist/style.css`)发布,并通过 WebAssembly 内嵌自己的表达式语言工具链。

核心架构特征:

- **模型驱动**:JDM JSON 文档是唯一事实源;图/表视图均为其投影。
- **Store 优先的状态管理**:zustand(配合 immer)持有编辑器状态;视图库(reactflow、TanStack Table)
  严格作为视图层使用。
- **语言智能在 WASM**:表达式校验、AST、补全、类型推断均来自编译为 WASM 的 Rust `zen-expression` crate。
- **样式自包含**:SCSS + CSS 自定义属性(`--grl-*`),运行时切换亮/暗主题。

## 2. 仓库结构

```
jdm-editor/                  # gorules/jdm-editor 的内部分叉
├── packages/
│   └── jdm-editor/          # 唯一的本地包 —— React 组件库(@republicroad/jdm-editor)
├── .github/workflows/       # CI:validate、publish、version、version-beta、pages
├── docs/                    # 本文档集
├── pnpm-workspace.yaml      # workspace = packages/*
├── lerna.json               # independent 版本模式,conventional commits
└── eslint/prettier/tsconfig # 共享工具配置
```

上游在本地还维护另外三个包(`lezer-zen`、`lezer-zen-template`、`zen-engine-wasm`);
本分叉已将它们移出 workspace,改为固定引用其 **npm 发布产物**:

| 依赖 | npm 包 | 版本 | 职责 |
|---|---|---|---|
| 语法 | `@gorules/lezer-zen` | ^0.8.1 | Zen 表达式语言的 Lezer 语法(CodeMirror 解析/高亮) |
| 语法 | `@gorules/lezer-zen-template` | ^0.4.0 | Zen 模板(`{{ ... }}` 插值)的 Lezer 语法 |
| 引擎 | `@gorules/zen-engine-wasm` | ^0.23.1 | Rust `zen-expression` 的 wasm-bindgen 绑定:校验、AST、补全、类型推断 |

分叉时三者版本与上游源码完全一致,行为无变化。

## 3. 包内结构(`packages/jdm-editor`)

构建:Vite 6 + SWC(`vite.config.ts`),类型由 `vite-plugin-dts` 生成,样式编译为单一
`dist/style.css`。Storybook 8 提供组件演示环境(`*.stories.tsx`)。

```
src/
├── index.ts                 # 公共入口:转发 components、theme、helpers 导出
├── theme.tsx                # JdmConfigProvider —— 主题与全局 CSS 变量
├── helpers/                 # 横切工具(无 UI)
│   ├── wasm.ts              #   WASM 懒加载:ensureWasmLoaded / useWasmReady / isWasmAvailable
│   ├── codemirror.ts        #   面向消费方的 CodeMirror 打包辅助
│   ├── schema.ts            #   JDM 文档的 zod schema(nodeSchema 等)
│   ├── traversal.ts         #   基于 reactflow Node/Edge 模型的图遍历
│   └── …                    #   monaco.ts、excel.ts、node-data.ts、use-persistent-state.ts 等
└── components/
    ├── primitives/             # 基于 ui/* 的 antd 形态封装——每组件一个模块,
    │                           #   `primitives.tsx` 为纯桶文件
    ├── decision-graph/      # 核心组件(见 §4)
    │   ├── hooks/              # use-node-add / use-graph-dnd /
    │   │                       #   use-graph-serializers / use-graph-clipboard
    │   └── graph/              # 画布、标签页、Excel 导入对话框
    │       └── *-excel-dialog/ #   对话框目录: index.tsx + types +
    │                           #   纯数据变换模块(已单测)
    ├── decision-table/      # 电子表格式规则表
    ├── code-editor/         # CodeMirror 6 封装 + 扩展
    │   └── business/
    │       └── expression-builder/  # 操作符目录(constants.ts)、取值输入、
    │                               # 下拉、WASM 状态 hook
    ├── expression/          # 独立 Zen 表达式编辑器
    ├── function/            # JavaScript 函数节点编辑器(基于 Monaco)
    ├── shared/              # 小型共享 UI 片段
    └── index.ts             # 公共组件导出
```

### 组件技术选型矩阵

| 模块 | 视图引擎 | 状态 |
|---|---|---|
| decision-graph | reactflow(→ @xyflow/react) | zustand store `dg-store.context.tsx`(+immer) |
| decision-table | @tanstack/react-table + @tanstack/react-virtual | zustand store `dt-store.context.tsx` |
| code-editor / expression | CodeMirror 6(+ Lezer 语法) | 非受控 / props |
| function | Monaco(`@monaco-editor/react`) | props |

## 4. 决策图数据流

代码库中最关键的数据流:

```
JDM JSON 文档
   ▲  serialize/deserialize(context/serializer.context.tsx、dg-util.ts)
   │
zustand store(context/dg-store.context.tsx)        ← actions:addNodes/removeNodes/addEdges/
   │  selectors:useDecisionGraphState/Actions/…        handleNodesChange/handleEdgesChange/pasteNodes…
   ▼
graph/graph.tsx —— 受控 <ReactFlow>
   nodesState = useNodesState([]) / edgesState = useEdgesState([])
   nodeTypes:按 kind 记忆化的渲染器(模块级 defaultNodeTypes + useMemo 处理自定义节点)
   edgeTypes:{ edge: custom-edge.tsx }
```

- store 是权威数据源。reactflow 从本地 `useNodesState`/`useEdgesState` 元组接收 `nodes`/`edges`,
  其引用被镜像到 `graphReferences`,供 store actions 以命令式方式修改图。
- 节点渲染经由**规格对象(specifications)**(`nodes/specifications/*`):每个内置 kind 注册一个规格
  对象(`renderNode`、`generateNode`、`inferTypes`、`renderTab` 等),见 `specifications.tsx`。
  第三方扩展通过相同协议经 `components`/`customNodes` props 接入(`custom-node/`)。
- 连线校验(禁自环、禁重复、基于 DFS + `getOutgoers` 的防环)位于 `graph/graph.tsx → isValidConnection`。
- 序列化框架(`context/serializer.context.tsx`,来自上游 "graph view serialization")允许任意部分向快照
  对象注册命名切片(`viewport`、`tabs`、`componentsOpened`)。

## 5. 编辑器基础设施

### CodeMirror 6 + Lezer

- 语法规包来自 npm(`@gorules/lezer-zen`、`@gorules/lezer-zen-template`),提供 Zen 表达式与模板的
  解析器和高亮样式。
- `code-editor/extensions/` 负责行为接线:
  - `linter.ts` —— 调用 WASM `validateExpression`/`validateUnaryExpression`
  - `completion.ts` —— 将 WASM `getCompletions` 映射为 CodeMirror 补全源
  - `highlight.ts`/`zen.ts` —— 语法接线
- Monaco 仅用于 JS 函数编辑、模拟器 JSON 输入和 JSON-schema 标签页(`helpers/monaco.ts`)。
  消费方自托管 Monaco worker 的说明见根 README。

### WASM 引擎层

`helpers/wasm.ts` 惰性初始化 `@gorules/zen-engine-wasm`(仅一次),并暴露:

- `ensureWasmLoaded()` —— 记忆化的单例 promise(`JdmConfigProvider` 也会触发它)
- `isWasmAvailable()`、`useWasmReady()` —— 依赖类型推断的 UI 的就绪门控

绑定消费方(约 30 处调用):lint、补全、`VariableType` 类型树(包 `util/` 入口的
`createVariableType`)、可视化 Expression Builder(`business/expression-builder.tsx` 使用 WASM 类
`ExpressionBuilder`;`standard-expression-builder.tsx` 使用 `parseStandardExpression`)以及
store/规格中的类型推断。

## 6. 主题系统

`theme.tsx → JdmConfigProvider`:

1. 用本地 `App` 原语(`components/primitives.tsx`,基于 shadcn/ui `AlertDialog`)包裹子组件,
   提供命令式 `modal.confirm`;`mode: 'light' | 'dark'` 选择内置亮/暗两套静态 token 调色板。
2. 将用户 token 覆写合并进调色板,注入 `:root` `<style>` 块,暴露约 40 个
   **`--grl-*` CSS 自定义属性**(颜色、字体、圆角、决策表专属色)。
3. 全部组件 SCSS(`src/` 下 10 个文件)只消费这些变量——即主题层早已与具体 UI 库实现解耦,
   收敛于 `--grl-*` 契约,该契约同时承载 Tailwind 类消费的 shadcn/ui token。
4. 同文件还托管 `DictionaryProvider`/`useDictionaries`,为下拉框提供枚举 label/value 字典。

## 7. 构建、测试与发布

脚本(根目录):`pnpm build|test|typecheck` 经 Lerna 分发;`lint`(ESLint 9 flat+legacy 混合)、
`prettier`、`format`/`format:fix`。

自动化测试(本分叉新增):`packages/jdm-editor` 使用 **Vitest**(jsdom + Testing Library)执行单元/组件测试
——`pnpm --filter @republicroad/jdm-editor test`(监听模式:`test:watch`);另通过 `test:storybook` 运行无头
Storybook 冒烟套件(静态构建 → `http-server` → `@storybook/test-runner` 于 Chromium 中逐 story 渲染;
一次性前置 `npx playwright install chromium`)。`package.json` 中 CRA 时代遗留的 jest 配置块已移除。
首批覆盖:zod schema、dg-util 映射器、图遍历 walker、决策图 store 动作,以及 DecisionGraph /
DecisionTable 挂载冒烟。jsdom 缺失的 `ResizeObserver`/`matchMedia` stub 与 `monaco-editor` 解析别名
位于 `vitest.config.ts` / `src/setupTests.js`。

GitHub 工作流(`.github/workflows/`):

| 工作流 | 触发条件 | 内容 |
|---|---|---|
| `validate.yaml` | push(master/reui)/PR | lint+build+test+typecheck、体积预算、双 React 消费者冒烟 |
| `publish.yaml` | push 且提交信息以 `chore(release)` 开头 | build 后执行 `lerna publish from-package` |
| `version.yaml` / `version-beta.yaml` | 手动 dispatch | `lerna version`(patch/minor/major;beta 标识) |
| `pages.yaml` | push master / 手动 | Storybook 构建并部署到 gh-pages 演示站 |

本分叉记录的已知缺口:发布流水线假设具备 npm 凭据,内部分叉可能不需要(待裁剪/改造)。

## 8. 公共分发模型

- 编译包:`main/module/types → dist/`,导出 `.`、`./dist/schema`、`./dist/style.css`。
- 运行时:基于 React 19 开发与验证;Peer 依赖保持 `react >= 18`、`react-dom >= 18`(由消费者冒烟脚本在 React 18/19 双版本下验证)。
- 宿主接入约定:消费方在最外层容器挂 `grl-root` 类以启用库作用域 mini-preflight(表单控件、表格、标题、列表、图片)。重置规则全部使用 `:where()`(零特异性),组件类与 Tailwind 工具类天然胜出,不会泄漏到宿主文档。`ui/button.tsx` 另带基类归一化作为兜底,覆盖 portal 到 body 的弹层按钮(Radix Dialog/Alert/Toaster 等逃逸出 `.grl-root` 作用域的元素)。
- 消费方接入说明(Monaco worker 自托管)见根 README。

### 8.1 导入契约(方案 D)

内核内部导入统一使用 **Node subpath imports**(`#` 前缀),声明于包的 `imports` 字段,类型经由 tsconfig `paths`(`#* -> ./src/*`)映射:

| 导入 | 指向 |
| --- | --- |
| `#icons` | `src/icons.tsx`(lucide 别名 + ReUI motion 图标)|
| `#components/ui/*` | `src/components/ui/*`(shadcn 原语)|
| `#lib/*` | `src/lib/*` |
| `#reui/icons/*` | `src/reui/icons/*`(动效图标)|

规则:

1. **内核内部导入一律用 `#`** —— 不会出现在公开面(宿主按设计无法解析 subpath imports)。
2. **公开 API 仅限 `exports` 暴露的内容**(`.`、`./dist/schema`、`./dist/style.css`)。
3. 旧 `@/*` 路径别名已**移除**(`@/` 导入被 lint 阻断);vite/storybook 原生解析 `#`(vite ≥ 5.1),vitest 经 alias 块解析。

迁移于 `246a0586`(81 文件)。
