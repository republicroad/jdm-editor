# React Compiler PoC — adoption assessment

> Status: **evaluation only** (2026-08). No product code changed. English canonical;
> [`react-compiler-poc.zh-CN.md`](./react-compiler-poc.zh-CN.md).

## What was measured

`eslint-plugin-react-compiler@19.1.0-rc.2` run over all of
`packages/jdm-editor/src/**/*.{ts,tsx}` via the dedicated config
[`eslint.react-compiler.mjs`](../eslint.react-compiler.mjs):

```bash
pnpm exec eslint -c eslint.react-compiler.mjs "packages/jdm-editor/src/**/*.tsx"
```

## Results

| Metric | Value |
|---|---|
| Files scanned | ~180 tsx |
| Files with violations | **2** |
| Total violations | **3** |

| Location | Violation | Nature |
|---|---|---|
| `decision-table/table/table.tsx:60` | Mutating hook arguments (`scrollContainerRef.current = el`) | Intentional imperative ref out-param |
| `table.tsx:288` | Mutating props (`scrollApiRef.current = {...}`) | Public `TableScrollApi` contract |
| `dg-store.test.tsx:14` | Outer-variable reassignment | Test file — ignored by the compiler at runtime |

The codebase is effectively **compiler-ready**. Both real violations are the same pattern:
a parent-supplied ref object written by the child (the documented escape hatch for the public
`scrollApiRef` API). If/when enabling the compiler, mark `Table` with the `"use no memo"`
directive (or refactor onto `useImperativeHandle`) — one line each.

## Enablement notes (not executed)

- Build stack caveat: this repo builds with `@vitejs/plugin-react-swc`; the compiler ships as a
  Babel plugin (`babel-plugin-react-compiler`). Options: switch dev/build to
  `@vitejs/plugin-react`, or adopt the SWC experiment (`experimental.reactCompiler` in
  `@vitejs/plugin-react-swc` ≥4.x).
- Runtime requirement is satisfied: React 19.2.8.
- Recommended rollout: enable rule as CI warning now (**done** — `pnpm lint:compiler` runs in
  `validate.yaml` as an advisory, warning-only step), flip to error once zero violations, then
  opt the build in behind the SWC flag and A/B render counts on the decision-graph story
  (nodes re-render count before/after).

## Recommendation

Adopt in two steps when convenient: ① wire `eslint.react-compiler.mjs` into CI as warning-only to
keep violations at zero (**done**, 2026-08); ② after the Storybook/Vite toolchain settles, trial the compiler on the
decision-graph + decision-table stories and compare interaction profiling. Expected upside is
modest (the tree already uses zustand selectors surgically), so treat it as hygiene rather than a
performance lever.
