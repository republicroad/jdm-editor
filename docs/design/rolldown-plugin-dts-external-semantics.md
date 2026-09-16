# rolldown-plugin-dts issue 草稿：TS 源码直发 workspace 包的 dts 打包闭包无界（OOM）

- 日期: 2026-09-16
- 状态: 草稿（待提交上游 rolldown-plugin-dts）
- 关联: [verdict-weave 迁移计划](./verdict-weave-migration-plan.md) 追记节（发现场景）、
  [BP-06 ESM-only 源码发布](../bp/esm-source-publish.md)（被波及的发布模式）
- 提交目标: https://github.com/rolldown/rolldown-plugin-dts/issues （`feat`/`bug` 标签待定）

---

## 以下为 issue 正文（英文，可直接粘贴）

### Title

**dts bundling inlines the entire type closure of TS-source-published workspace packages → OOM; no way to keep them external**

### Environment

- `rolldown-plugin-dts` 0.28.5
- `vite` 8.2.2 (rolldown engine), lib mode
- pnpm 10.34 workspace; Node 22; Windows (also expected on POSIX)
- Consumer package `types` field of the dependency resolves to `src/index.ts` (TS source publish, no dist)

### Scenario

pnpm monorepo with two packages:

- `packages/kernel` — **TS source-published** package: `main`/`types` → `src/index.ts`
  (ESM source-publish model: no build step, consumers bundle TS directly). It imports
  `monaco-editor`, `codemirror`, `react`, … so its type graph is large.
- `packages/app` — lib-mode Vite build that consumes `@republicroad/kernel` from the
  workspace and emits a bundled `dist/index.d.ts` via `rolldown-plugin-dts`.

App tsconfig maps the specifier to the kernel source (source-direct):

```json
"paths": { "@republicroad/kernel": ["../kernel/src/index.ts"] }
```

### Reproduction

`vite build` in the app → dts generation phase crashes:

```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

- Reproduces with the default heap (~4 GB) and with `--max-old-space-size=8192`.
- Partial evidence the generator itself works: a bundled `dist/index.d.ts`
  (~1.7k lines) was observed on disk from the crashed run — emission starts,
  the process dies holding/closing the full type closure.

### Root cause

When the consumed package is **TS source-published**, every import of it resolves —
through the pnpm workspace symlink (realpath) — to files **inside the monorepo**.
The plugin therefore classifies the whole kernel type graph as inline-able and holds
it in memory while bundling declarations. For a large kernel (monaco/codemirror/react
type graphs) this exceeds feasible heap.

Notably, this is independent of tsconfig `paths`: we removed the paths mapping so the
specifier resolves purely through `node_modules` (workspace symlink) — still OOM,
because the symlink realpath lands in kernel `src` either way.

### Why we need this (impact)

"ESM source publish" (ship TS source, no dist) is a deliberate model for
internal tool packages (fast iteration, zero build step). In that model, **no dist
d.ts exists to be referenced**, so a dts *bundling* plugin has nothing to link against —
it must walk source. That walk is unbounded for big source graphs and currently ends
in OOM, which blocks adopting `rolldown-plugin-dts` in exactly the monorepos where
source publish is most attractive.

### Feature request

An escape hatch to keep selected specifiers external in the emitted declarations,
mirroring rolldown's own `external` semantics, e.g.:

```ts
dts({
  external: ['@scope/kernel', /^@scope\/.*/],
})
```

Emitted d.ts would then contain `export * from '@scope/kernel'` / `import type { … }`
references **without following the closure**, so the app's own bundled d.ts stays
small and the external package remains responsible for its own types (consumers
already depend on it at runtime).

### Current workaround

Keep the previous dts plugin (multi-file emit that preserves import specifiers and
never inlines the closure), or pre-build the dependency's d.ts and consume it via
TS project references. Both work but forfeit rolldown-plugin-dts's bundled-output
ergonomics.

### Notes

- Happy to provide a minimal reproduction repository.
- Possibly related to how other plugins treat `publishConfig`-rewritten or
  source-published entries; we believe first-class support matters as source-publish
  gains adoption.
