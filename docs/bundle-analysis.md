# Bundle Analysis — index.js composition

> Method: `BUILD_ANALYZE=1 pnpm --filter @republicroad/jdm-editor build` emits
> `bundle-stats.json` (rollup-plugin-visualizer raw-data). The table below is
> derived from the rendered (pre-minification) sizes of `dist/index.js`.
> Regenerate after significant feature work; do not commit `bundle-stats.json`.

## Composition (measured 2026-09)

Rendered total: **890.9 kB** → minified on disk: **713 kB** (raw) / **169 kB**
(gzip). Monaco and react are external (peers/deps) and not included.

| Module group | Rendered | Share |
|---|---:|---:|
| `decision-graph` (graph, simulator, CF tab, specs) | 303.7 kB | 34.1% |
| `function` (function node + debugger) | 121.3 kB | 13.6% |
| `decision-table` | 105.6 kB | 11.9% |
| `code-editor` (CM6 skin, pool, highlighter) | 87.9 kB | 9.9% |
| `helpers` (request-schema, traversal, utility…) | 37.9 kB | 4.3% |
| `theming` (compute/derive/i18n/portal) | 31.3 kB | 3.5% |
| `primitives` | 30.9 kB | 3.5% |
| `ui` (shadcn primitives) | 30.7 kB | 3.4% |
| `custom-function-table` | 30.6 kB | 3.4% |
| dep: dayjs (date-picker chain) | 21.3 kB | 2.4% |
| `reui` motion icons | 19.9 kB | 2.2% |
| `expression` components | 19.2 kB | 2.2% |
| remaining (~20 groups, incl. deps) | ~56 kB | ~6% |

Dependency contribution is tiny — the biggest single dep (`dayjs`, via the
date picker) is 2.4%. There is no meaningful win in dependency pruning.

## Split decision (roadmap §3.1)

`decision-graph` + `decision-table` account for **46%** of the bundle. A
surface split (`./dist/graph`, `./dist/table` entry points) would let
single-surface hosts skip roughly 40% of the payload, at the cost of:

- shared-chunk bookkeeping (theming/code-editor/primitives become common
  chunks or get duplicated),
- an exports-map and host-guidance update,
- cross-surface features (graph embedding a decision-table node) needing the
  other chunk anyway — hosts must include both or accept dynamic imports.

**Recommendation:** defer until a host actually reports single-surface usage;
the absolute gzip cost today (169 kB) is moderate for an editor SDK, and the
split's bookkeeping is not free. Re-evaluate if index.js crosses ~250 kB gzip
or a single-surface host use-case materializes.

## Cheap wins (no split needed)

- `dayjs`: only the date-picker needs it — if the picker moves to a native
  input, 21 kB drops out (candidate only if the picker itself is dropped).
- `@types/big.js` appears in the rendered graph — verify it is not shipping
  runtime code via a transitive import.

## How to regenerate

```powershell
$env:BUILD_ANALYZE = '1'
corepack pnpm@10 --filter @republicroad/jdm-editor build
node -e "..."   # see commit history for the analyzer snippet
```
