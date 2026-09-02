# 功能文档

> 中文对照版,英文原版:[`features.md`](./features.md)。

公共包:`@republicroad/jdm-editor`(`packages/jdm-editor`)。所有组件从包根导出;样式通过
`import '@republicroad/jdm-editor/dist/style.css'` 引入。

## 1. 决策图 DecisionGraph(`components/decision-graph`)

面向 JDM 文档的交互式节点图编辑器。受控用法:

```tsx
<JdmConfigProvider>
  <DecisionGraph value={graph} onChange={setGraph} />
</JdmConfigProvider>
```

### 1.1 内置节点类型(`nodes/specifications/`)

| Kind(`NodeKind`)| type 字符串 | 用途 |
|---|---|---|
| Input | `inputNode` | 声明图的输入 schema |
| Output | `outputNode` | 声明图的输出 schema |
| Decision Table | `decisionTableNode` | 承载内嵌决策表 |
| Function | `functionNode` | JavaScript 函数体 |
| Expression | `expressionNode` | Zen 表达式 + 输出字段赋值 |
| Switch | `switchNode` | 按表达式结果多路分支 |

每种类型实现为**节点规格对象**(`specification-types.ts → NodeSpecification`):`displayName`、
`icon`、`color`、`generateNode`、`renderNode`、`renderTab`(设置面板)、`renderSettings`、
`inferTypes`(输出类型推断,供智能提示使用)、`onNodeAdd`、`getDiffContent`。注册表见
`specifications.tsx`。

### 1.2 自定义节点

消费方传入 `components?: CustomNodeType[]` / `customNodes` —— 与内置节点相同的规格协议,经通用
`customNode` 渲染器渲染(`nodes/custom-node/`)。无需改动内部代码即可扩展领域节点。

### 1.3 图编辑行为

- **连线**(`graph/graph.tsx → isValidConnection`):禁止自环;禁止重复的 source/target+handle 组合;
  通过 DFS 遍历 `getOutgoers` 拒绝成环。
- **拖拽**:组件侧栏(`graph-components.tsx`)提供可拖拽面板;落点经 reactflow 实例由屏幕坐标投影;
  支持自定义 payload 直接投递完整节点数据。
- **快捷键**(`content-wrapper` 上):`⌘/Ctrl+C` 复制选中、`⌘V` 粘贴(带偏移)、`⌘D` 创建副本、
  `Backspace` 删除(选中节点时弹确认框)。删除逻辑委托给 store actions。
- **剪贴板**:`hooks/use-graph-clipboard.ts` —— 跨图复制/粘贴,保留相对位置。
- **连线交互**:hover 状态记录在 store(`setHoveredEdgeId`),由 `custom-edge.tsx` 高亮渲染;
  边使用 bezier 路径与 label renderer。
- **紧凑模式**:Controls 上的按钮切换(`toggleCompactMode`)。
- **标签页**:节点在编辑器标签页中打开(决策表/函数/表达式设置);打开的标签状态属于序列化视图的一部分。

### 1.4 模拟器(`simulator/dg-simulator.tsx`)

以 JSON 输入执行决策图。类型定义于 `simulation.types.ts`:`Simulation = { result } | { error }`;
成功结果包含 `performance`、`result`、实际执行的图 `snapshot`,以及按 nodeId 索引的 `trace`
(每个节点的输入/输出/耗时/traceData),用于可视化执行顺序并检查各节点 I/O。

当图中包含输入(Request)节点时,左面板会切换为**请求面板**(`simulator-request-panel.tsx`):
编辑器绑定到节点上的具名用例数据源,与节点 Definitions 及 schema.examples 双向同步
(`use-simulator-auto-sync`),经 WASM 推断请求的 `VariableType`,并把编辑器修改持久化回绑定的
schema 示例(`use-request-example-persistence`)。节点执行轨迹列表位于 `simulator-nodes-panel.tsx`。

### 1.4a 请求节点页签(`graph/tab-request.tsx`)

输入节点的编辑页签提供三个视图:**字段定义**(递归字段树,含类型/默认值/描述)、
**用例数据**(具名数据源 + JSON 编辑器,inlay 提示展示字段描述,含数据与定义比对的字段摘要)
与 **Schema**(原始 JSON Schema 编辑器,支持格式化与 JSON→Schema 转换)。配套助手位于
`helpers/request-schema/*`(规范化、示例/定义合并、冲突检测)与 `helpers/json-path-extractor.ts`。

### 1.5 Diff 支持(`diff/`)

对比当前与历史 JDM 文档(`comparison.ts`、`utility.ts`);各节点规格提供 `getDiffContent` 以投影可比内容;
diff 标记呈现在表格(`_diff.fields.*`)与命令栏(`diffHitPolicy`)中。

### 1.6 视图序列化(`context/serializer.context.tsx`)

通过 `useGraphSerializer<T>(key, { serialize, restore })` 注册命名切片。内置切片:`viewport`
(reactflow 视口)、`tabs`(openTabs/activeTab)、`componentsOpened`(侧栏状态)。
`DecisionGraphRef.serialize()/restore()` 生成/恢复完整快照(上游特性 "graph view serialization",#239)。

## 2. 决策表 Decision Table(`components/decision-table`)

基于 TanStack Table v8 + 行虚拟化(`@tanstack/react-virtual`)的电子表格式规则编辑器,受控组件:

```tsx
<DecisionTable value={table} onChange={setTable} inputsSchema={...} outputsSchema={...} />
```

关键能力:

- **命中策略(Hit Policy)**:`'first' | 'collect'`(`dt-store.context.tsx → HitPolicy`);
  命令栏可切换,`disableHitPolicy` 可锁定。
- **权限**:`'edit:full' | 'edit:rules' | 'edit:values'` —— 分别限制"整表编辑 / 仅规则结构 / 仅单元格值"。
- **输入/输出字段**:带类型的列(string/number/boolean/array/object/date-time),支持枚举定义
  (`enum-utils.ts`)、内联字段编辑器(`input-field-edit.tsx`、`output-field-edit.tsx`、
  `field-type-tags.tsx`)、排序对话框(`order-dialog.tsx`)。
- **规则行**:右键菜单(`context-menu.tsx`)与命令栏支持增删/复制/清空;选中行高亮;模拟期间提供
  命中可视化(`activeRules`、`debugIndex`)。
- **单元格编辑**:popover 编辑器(`cell-edit-popover.tsx`),输入感知 Zen 表达式;`cellRenderer`
  prop 允许完全自定义单元格。
- **Excel 往返**:经 exceljs 导入/导出(`helpers/excel.ts` + `excel-dialog.tsx`),尽量保留命中策略与 schema。
- **列宽**:`minColWidth` / `colWidth`,表头可拖拽调宽。

## 3. 表达式与代码编辑

### CodeEditor(`components/code-editor`)

CodeMirror 6 封装,扩展包括:zen 语法高亮、WASM lint(`extensions/linter.ts`)、补全
(`extensions/completion.ts` —— 来自引擎元数据的变量/函数/方法)、placeholder、焦点辅助
(`business/focus-helper.ts`)。语言模式:`zen`、`zen-template`,另支持普通 JSON。

### 表达式编辑器(`components/expression`)

绑定字段名的独立单行/多行 Zen 表达式控件 —— 用于表达式节点和表格单元格。

### 可视化表达式构建器(`code-editor/business`)

- `expression-builder.tsx` —— 结构化条件构建器,底层为 WASM `ExpressionBuilder` 类
  (标准表达式解析/编辑为操作数-运算符树)。
- `standard-expression-builder.tsx` —— 使用 `parseStandardExpression` 的规范形式编辑器。
两者在 WASM 不可用时优雅降级(`useWasmReady` 门控)。

## 4. 函数编辑器(`components/function`)

基于 Monaco 的 JavaScript 函数编写环境,内置环境类型声明(`helpers/*.d.ts`:`zen`、`http`、`zod`,
全局库见 `libs.ts`)、默认模板(`default-function.js`),以及回填图类型推断的返回类型探测
(`determine-type.ts`)。

## 5. 共享基础设施

- **`JdmConfigProvider`**(`theme.tsx`):主题模式(亮/暗)、设计令牌覆写、
  枚举 `dictionaries`(各编辑器的下拉框消费)、触发 WASM 预加载。
- **WASM 生命周期**:`ensureWasmLoaded()` / `useWasmReady()` 已导出,宿主应用可显式控制加载时机。
- **Schema**(`helpers/schema.ts`):决策图/表的 zod 校验(`./dist/schema` 子路径导出)。
- **持久化**:`usePersistentState` hook(localStorage 存储)。
- **工具集**:图遍历辅助、Excel 辅助、monaco 加载辅助(`codemirror` 打包导出,供消费方直接内嵌 CodeMirror)。

## 6. 公共 API 速查

```ts
// 组件
DecisionGraph, DecisionGraphProps, DecisionGraphRef
DecisionTable, DecisionTableProps, DecisionTablePermission, HitPolicy
ExpressionBuilder(UI), CodeEditor, CodeEditorProps
CustomNodeType, CustomNodeSpecification
// 主题/配置
JdmConfigProvider, JdmConfigProviderProps, ThemeConfig, DictionaryProvider
// hooks/helpers
useNodeType, usePersistentState, ensureWasmLoaded, useWasmReady
codemirror, schema 工具
```

(精确导出清单见 `src/index.ts` 与 `src/components/index.ts`。)
