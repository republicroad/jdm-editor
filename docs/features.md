# Features / 功能

> English is canonical. Chinese version: [`features.zh-CN.md`](./features.zh-CN.md).

Public package: `@republicroad/jdm-editor` (`packages/jdm-editor`). All components are exported from the
package root; styling via `import '@republicroad/jdm-editor/dist/style.css'`.

## 1. DecisionGraph (`components/decision-graph`)

Interactive node-graph editor for a JDM document. Controlled usage:

```tsx
<JdmConfigProvider>
  <DecisionGraph value={graph} onChange={setGraph} />
</JdmConfigProvider>
```

### 1.1 Built-in node kinds (`nodes/specifications/`)

| Kind (`NodeKind`) | type string | Purpose |
|---|---|---|
| Input | `inputNode` | Declares graph input schema |
| Output | `outputNode` | Declares graph output schema |
| Decision Table | `decisionTableNode` | Hosts an embedded decision table |
| Function | `functionNode` | JavaScript function body |
| Expression | `expressionNode` | Zen expression with assigned output field |
| Switch | `switchNode` | Multi-branch routing on expression results |

Each kind is implemented as a **node specification** object (`specification-types.ts → NodeSpecification`):
`displayName`, `icon`, `color`, `generateNode`, `renderNode`, `renderTab` (settings panel),
`renderSettings`, `inferTypes` (output-type inference feeding intellisense), `onNodeAdd`,
`getDiffContent`. Registry: `specifications.tsx`.

### 1.2 Custom nodes

Consumers pass `components?: CustomNodeType[]` / `customNodes` — same specification protocol as built-ins,
rendered through the generic `customNode` renderer (`nodes/custom-node/`). Enables domain-specific nodes
without forking internals.

### 1.3 Graph editing behaviors

- **Connections** (`graph/graph.tsx → isValidConnection`): self-loops forbidden; duplicate
  source/target+handle edges forbidden; cycles rejected via DFS over `getOutgoers`.
- **Drag & drop**: components sidebar (`graph-components.tsx`) provides draggable palette; drop position is
  projected from screen coords via reactflow instance; custom payload transfer supports pre-built nodes.
- **Keyboard** (in `content-wrapper`): `⌘/Ctrl+C` copy selection, `⌘V` paste (with offset), `⌘D` duplicate,
  `Backspace` delete (with confirm dialog when nodes are selected). Delete key handling is delegated to
  store actions.
- **Clipboard**: `hooks/use-graph-clipboard.ts` — cross-graph copy/paste including relative positions.
- **Edge interactions**: hover state tracked in store (`setHoveredEdgeId`) for highlight rendering in
  `custom-edge.tsx`; edges use bezier path with label renderer.
- **Compact mode**: toggle from Controls button (`toggleCompactMode`).
- **Tabs**: nodes open in editor tabs (decision table/function/expression settings); open-tab state is part
  of the serialized view.

### 1.4 Simulator (`simulator/dg-simulator.tsx`)

Runs the graph against a JSON input. Types in `simulation.types.ts`: `Simulation = { result } | { error }`;
successful runs expose `performance`, `result`, the executed graph `snapshot`, and per-node `trace`
(input/output/performance/traceData per nodeId) used to visualize execution order and inspect node I/O.

When the graph contains an input (Request) node, the left panel becomes the **request panel**
(`simulator-request-panel.tsx`): the editor binds to a named example source on the node, syncs with the
node's Definitions and schema examples bidirectionally (`use-simulator-auto-sync`), infers the request's
`VariableType` via WASM, and persists editor edits back into the bound schema example
(`use-request-example-persistence`). The node trace list lives in `simulator-nodes-panel.tsx`.

### 1.4a Request node tab (`graph/tab-request.tsx`)

The input node's edit tab offers three views: **Definitions** (recursive field tree with types,
defaults, descriptions), **Data** (named example sources with JSON editors, inlay hints showing
definition descriptions, and a field summary comparing data vs definitions), and **Schema**
(raw JSON schema editor with format + JSON→Schema conversion). Helpers live in
`helpers/request-schema/*` (normalization, example/definition merge, conflict detection) and
`helpers/json-path-extractor.ts`.

### 1.4b Custom function table (`custom-function-table/`, `graph/tab-custom-function-table.tsx`)

Hosts building custom nodes over `createJdmNode` can supply `renderTab` and receive the
`CustomFunctionTable` surface: a spreadsheet-style expression editor with per-row drag reorder
(@dnd-kit), key/expression columns, three expression modes (expression / function with
`customFunctions` signature picker / JSON code mode), legacy `;;` string migration to string
arrays, simulation trace sync with per-row result overlays, and diff-aware row tinting.
Helpers: `helpers/custom-function-schema.ts` (scoped function contracts) and the operator
expression utilities in `helpers/utility.ts`. `DecisionGraph` accepts `userResolver` and
`customFunctions` props; `setDecisionGraph` normalizes incoming custom node expressions.

### 1.5 Diff support (`diff/`)

Compares current vs previous JDM documents (`comparison.ts`, `utility.ts`); specifications provide
`getDiffContent` so each node kind can project comparable content; diff flags surface in tables
(`_diff.fields.*`) and command bar (`diffHitPolicy`).

### 1.6 View serialization (`context/serializer.context.tsx`)

Named slices registered via `useGraphSerializer<T>(key, { serialize, restore })`. Built-in slices:
`viewport` (reactflow viewport), `tabs` (openTabs/activeTab), `componentsOpened` (sidebar state).
`DecisionGraphRef.serialize()/restore()` produce/consume full snapshots (upstream feature
“graph view serialization”, #239).

## 2. Decision Table (`components/decision-table`)

Spreadsheet-style rule editor built on TanStack Table v8 with row virtualization
(`@tanstack/react-virtual`), rendered as controlled component:

```tsx
<DecisionTable value={table} onChange={setTable} inputsSchema={...} outputsSchema={...} />
```

Key capabilities:

- **Hit policy**: `'first' | 'collect'` (`dt-store.context.tsx → HitPolicy`); switchable in command bar,
  lockable via `disableHitPolicy`.
- **Permissions**: `'edit:full' | 'edit:rules' | 'edit:values'` — restricts column-structure vs cell-value
  editing.
- **Input/output fields**: typed columns with field types (string/number/boolean/array/object/date-time),
  enum definitions (`enum-utils.ts`), inline field editors (`input-field-edit.tsx`,
  `output-field-edit.tsx`, `field-type-tags.tsx`), reordering dialog (`order-dialog.tsx`).
- **Rule rows**: add/remove/duplicate/clear via context menu (`context-menu.tsx`) and command bar;
  selected-row highlighting; debug/hit visualization during simulation (`activeRules`, `debugIndex`).
- **Cell editing**: popover editors (`cell-edit-popover.tsx`) with Zen-expression aware inputs;
  `cellRenderer` prop allows full custom cells.
- **Excel round-trip**: import/export via exceljs (`helpers/excel.ts` + `excel-dialog.tsx`), preserving hit
  policy and schemas where possible.
- **Column sizing**: `minColWidth` / `colWidth`, resizable headers.

## 3. Expression & code editing

### CodeEditor (`components/code-editor`)

CodeMirror 6 wrapper with extensions: zen grammar highlighting, WASM lint (`extensions/linter.ts`),
completions (`extensions/completion.ts` — variables/functions/methods from engine metadata), placeholder,
focus helpers (`business/focus-helper.ts`). Language modes: `zen`, `zen-template`, plus plain JSON.

### Expression editor (`components/expression`)

Standalone single-line/multi-line Zen expression control bound to a field name — used by expression nodes
and table cells.

### Visual Expression Builders (`code-editor/business`)

- `expression-builder.tsx` — structured condition builder backed by the WASM `ExpressionBuilder` class
  (parse/edit standard expressions into operand/operator trees).
- `standard-expression-builder.tsx` — canonical form editor using `parseStandardExpression`.
Both fall back gracefully when WASM is unavailable (`useWasmReady` gating).

## 4. Function editor (`components/function`)

Monaco-based JavaScript function authoring with bundled ambient typings (`helpers/*.d.ts`: `zen`, `http`,
`zod`, global libs in `libs.ts`), default templates (`default-function.js`), and return-type detection
(`determine-type.ts`) that feeds graph type inference.

## 5. Shared infrastructure

- **`JdmConfigProvider`** (`theme.tsx`): theme mode (light/dark), design-token overrides,
  enum `dictionaries` (consumed by selects across editors), triggers WASM preload.
- **WASM lifecycle**: `ensureWasmLoaded()` / `useWasmReady()` exported for host apps that want explicit
  loading control.
- **Schemas** (`helpers/schema.ts`): zod validation for decision graph/table documents (`./dist/schema`
  subpath export).
- **Persistence**: `usePersistentState` hook (localStorage-backed).
- **Utilities**: graph traversal helpers, Excel helpers, monaco loader helper (`codemirror` bundle export
  for consumers embedding CodeMirror directly).

## 6. Public API quick reference

```ts
// components
DecisionGraph, DecisionGraphProps, DecisionGraphRef
DecisionTable, DecisionTableProps, DecisionTablePermission, HitPolicy
ExpressionBuilder (UI), CodeEditor, CodeEditorProps
CustomNodeType, CustomNodeSpecification
// theming/config
JdmConfigProvider, JdmConfigProviderProps, ThemeConfig, DictionaryProvider
// hooks/helpers
useNodeType, usePersistentState, ensureWasmLoaded, useWasmReady
codemirror, schema utilities
```

(Exact export list: `src/index.ts` + `src/components/index.ts`.)
