# Architecture / 架构

> English is canonical. Chinese version: [`architecture.zh-CN.md`](./architecture.zh-CN.md).
>
> This document describes the repository **after** the fork adjustments: support packages are consumed from npm
> and only `packages/jdm-editor` lives in this repo.

## 1. Overview

JDM Editor is a React component library for building and editing **JDM (JSON Decision Model)** documents:
a decision graph of nodes (decision tables, functions, expressions, switches, I/O), each backed by
specialized editors. The library ships as compiled ESM (`dist/`) plus a single stylesheet (`dist/style.css`)
and embeds its own expression language toolchain via WebAssembly.

Key architectural properties:

- **Model-driven**: the JDM JSON document is the source of truth; graph/table views are projections.
- **Store-first state**: zustand stores (with immer) own editor state; view libraries (reactflow,
  TanStack Table) are treated strictly as view layers.
- **Language intelligence in WASM**: expression validation, AST, completions, and type inference come from
  the Rust `zen-expression` crate compiled to WebAssembly.
- **Self-contained styling**: SCSS + CSS custom properties (`--grl-*`), themed light/dark at runtime.

## 2. Repository layout

```
jdm-editor/                  # internal fork of gorules/jdm-editor
├── packages/
│   └── jdm-editor/          # the only local package — React component library (@gorules/jdm-editor)
├── .github/workflows/       # CI: validate, publish, version, version-beta, pages
├── docs/                    # this documentation set
├── pnpm-workspace.yaml      # workspace = packages/*
├── lerna.json               # independent versioning, conventional commits
└── eslint/prettier/tsconfig # shared tooling config
```

Upstream keeps three more packages locally (`lezer-zen`, `lezer-zen-template`, `zen-engine-wasm`);
this fork removed them from the workspace and pins their **published npm artifacts** instead:

| Dependency | npm package | Version | Role |
|---|---|---|---|
| Grammar | `@gorules/lezer-zen` | ^0.8.1 | Lezer grammar for the Zen expression language (CodeMirror parsing/highlighting) |
| Grammar | `@gorules/lezer-zen-template` | ^0.4.0 | Lezer grammar for Zen templates (`{{ ... }}` interpolations) |
| Engine | `@gorules/zen-engine-wasm` | ^0.23.1 | wasm-bindgen bindings to Rust `zen-expression`: validation, AST, completions, type inference |

Versions were identical to the upstream sources at fork time, so behavior is unchanged.

## 3. Package internals (`packages/jdm-editor`)

Build: Vite 6 + SWC (`vite.config.ts`), types via `vite-plugin-dts`, styles compiled to a single
`dist/style.css`. Storybook 8 provides component playgrounds (`*.stories.tsx`).

```
src/
├── index.ts                 # public entry: re-exports components, theme, helpers
├── theme.tsx                # JdmConfigProvider — theming + global CSS variables
├── helpers/                 # cross-cutting utilities (no UI)
│   ├── wasm.ts              #   lazy WASM init: ensureWasmLoaded / useWasmReady / isWasmAvailable
│   ├── codemirror.ts        #   CodeMirror bundle helper exported to consumers
│   ├── schema.ts            #   zod schemas for JDM documents (nodeSchema etc.)
│   ├── traversal.ts         #   graph traversal on reactflow Node/Edge models
│   └── …                    #   monaco.ts, excel.ts, node-data.ts, use-persistent-state.ts, …
└── components/
    ├── decision-graph/      # flagship component (see §4)
    ├── decision-table/      # spreadsheet-style rule table
    ├── code-editor/         # CodeMirror 6 wrapper + extensions
    │   └── business/        # visual Expression Builder UIs
    ├── expression/          # standalone Zen expression editor
    ├── function/            # JavaScript function node editor (Monaco-based)
    ├── shared/              # small shared UI pieces
    └── index.ts             # public component exports
```

### Component matrix

| Module | View engine | State |
|---|---|---|
| decision-graph | reactflow (→ @xyflow/react) | zustand store `dg-store.context.tsx` (+immer) |
| decision-table | @tanstack/react-table + @tanstack/react-virtual | zustand store `dt-store.context.tsx` |
| code-editor / expression | CodeMirror 6 (+ Lezer grammars) | uncontrolled / props |
| function | Monaco (`@monaco-editor/react`) | props |

## 4. Decision Graph data flow

The most important flow in the codebase:

```
JDM JSON document
   ▲  serialize/deserialize (context/serializer.context.tsx, dg-util.ts)
   │
zustand store (context/dg-store.context.tsx)          ← actions: addNodes/removeNodes/addEdges/
   │  selectors: useDecisionGraphState/Actions/…         handleNodesChange/handleEdgesChange/pasteNodes…
   ▼
graph/graph.tsx — controlled <ReactFlow>
   nodesState = useNodesState([]) / edgesState = useEdgesState([])
   nodeTypes: memoized per-kind renderers (module-level defaultNodeTypes + useMemo for custom nodes)
   edgeTypes: { edge: custom-edge.tsx }
```

- The store is authoritative. reactflow receives `nodes`/`edges` from local `useNodesState`/`useEdgesState`
  tuples whose refs are mirrored into `graphReferences` so store actions can mutate the graph imperatively.
- Node rendering goes through **specifications** (`nodes/specifications/*`): each built-in kind registers a
  specification object (`renderNode`, `generateNode`, `inferTypes`, `renderTab`, …) — see `specifications.tsx`.
  Third-party extension uses the same protocol via `components`/`customNodes` props (`custom-node/`).
- Edge validation (no self-loop, no duplicates, cycle detection via DFS with `getOutgoers`) lives in
  `graph/graph.tsx → isValidConnection`.
- Serialization framework (`context/serializer.context.tsx`, added upstream in “graph view serialization”)
  lets any part register named slices (`viewport`, `tabs`, `componentsOpened`) into a snapshot object.

## 5. Editor infrastructure

### CodeMirror 6 + Lezer

- Grammars come from npm (`@gorules/lezer-zen`, `@gorules/lezer-zen-template`); they provide parser +
  highlight style for Zen expressions and templates.
- `code-editor/extensions/` wires behavior:
  - `linter.ts` — calls WASM `validateExpression`/`validateUnaryExpression`
  - `completion.ts` — maps WASM `getCompletions` into CodeMirror completion sources
  - `highlight.ts`/`zen.ts` — grammar wiring
- Monaco is intentionally limited to JS-function editing, simulator JSON input, and JSON-schema tabs
  (`helpers/monaco.ts`). Self-hosting instructions for consumers are in the root README.

### WASM engine layer

`helpers/wasm.ts` lazily initializes `@gorules/zen-engine-wasm` exactly once and exposes:

- `ensureWasmLoaded()` — memoized singleton promise (also invoked by `JdmConfigProvider`)
- `isWasmAvailable()`, `useWasmReady()` — readiness gate for UI that depends on inference

Consumers of the binding (~30 call sites): linting, completions, `VariableType` trees
(`createVariableType` from the package’s `util/` entry), the visual Expression Builders
(`business/expression-builder.tsx` uses the `ExpressionBuilder` WASM class;
`standard-expression-builder.tsx` uses `parseStandardExpression`), and type inference in stores/specifications.

## 6. Theming system

`theme.tsx → JdmConfigProvider`:

PLACEHOLDER-NOPE
2. Merges user token overrides into the static palette and injects a `:root` `<style>` block exposing ~40
   **`--grl-*` CSS custom properties** (colors, fonts, radii, table-specific colors).
3. All component SCSS (10 files under `src/`) consumes only these variables — i.e., theming is already
   decoupled behind the `--grl-*` contract, which also carries the shadcn/ui tokens consumed by Tailwind classes.
4. Also hosts `DictionaryProvider`/`useDictionaries` for enum label/value dictionaries used by selects.

## 7. Build, test & release

Scripts (root): `pnpm build|test|typecheck` fan out through Lerna; `lint` (ESLint 9 flat+legacy hybrid),
`prettier`, `format`/`format:fix`.

Automated tests (added by this fork): `packages/jdm-editor` runs **Vitest** (jsdom + Testing Library)
for unit/component tests — `pnpm --filter @gorules/jdm-editor test` (watch: `test:watch`) — and a
headless Storybook smoke suite via `test:storybook` (static storybook build → `http-server` →
`@storybook/test-runner` in Chromium; one-time prerequisite `npx playwright install chromium`). The
vestigial CRA-era jest block was removed from `package.json`. First-batch coverage: zod schemas,
dg-util mappers, graph traversal walker, decision-graph store actions, and DecisionGraph /
DecisionTable mount smoke. jsdom stubs for `ResizeObserver`/`matchMedia` plus a `monaco-editor`
resolve alias live in `vitest.config.ts` / `src/setupTests.js`.

GitHub workflows (`.github/workflows/`):

| Workflow | Trigger | What it does |
|---|---|---|
| `validate.yaml` | push/PR to master | format check (eslint+prettier) → build → typecheck (**no test job**) |
| `publish.yaml` | push with `chore(release)` message | build then `lerna publish from-package` |
| `version.yaml` / `version-beta.yaml` | manual dispatch | `lerna version` (patch/minor/major; beta ids) |
| `pages.yaml` | push master / manual | Storybook build → gh-pages demo site |

Known gaps recorded for this fork: CI still has no test job (tests run locally; wiring into
`validate.yaml` is a deliberate follow-up); publishing pipeline assumes npm credentials that an
internal fork may not need (candidate for removal/adaptation).

## 8. Public distribution model

- Compiled package: `main/module/types → dist/`, exports `.` , `./dist/schema`, `./dist/style.css`.
- Peer deps: `react >= 18`, `react-dom >= 18`.
- Consumer setup notes (Monaco workers self-hosting) live in the root README.
