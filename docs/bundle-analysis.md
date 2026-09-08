# Bundle Analysis — index.js composition

> Method: `BUILD_ANALYZE=1 pnpm --filter @republicroad/jdm-editor build` emits
> `bundle-stats.json` (rollup-plugin-visualizer raw-data). The table below is
> derived from the rendered (pre-minification) sizes across all emitted
> chunks. Regenerate after significant feature work; do not commit
> `bundle-stats.json`.

## Composition (measured 2026-09-08, Vite 8 / Rolldown)

Rendered total: **827.6 kB** across chunks → minified on disk: `index.js`
**451 kB** (raw) / **118 kB** (gzip) plus a lazy `function-*.js` chunk
(~210 kB raw / 47 kB gzip) that Rolldown splits out of the main entry
automatically. Monaco and react are external (peers/deps) and not included.
Compared to the Vite 7 baseline (713 kB raw / 169 kB gzip single-file) the
minified entry dropped ~37% raw / ~30% gzip.

| Module group | Rendered | Share |
|---|---:|---:|
| `decision-graph` (graph, simulator, CF tab, specs) | 270.6 kB | 32.7% |
| `function` (function node + debugger; lazy chunk) | 119.0 kB | 14.4% |
| `decision-table` | 94.3 kB | 11.4% |
| `code-editor` (CM6 skin, pool, highlighter) | 78.4 kB | 9.5% |
| `helpers` (request-schema, traversal, utility…) | 33.3 kB | 4.0% |
| `primitives` + `ui` (shadcn primitives) | 56.8 kB | 6.9% |
| `custom-function-table` | 27.1 kB | 3.3% |
| dep: dayjs (date-picker chain) | 24.1 kB | 2.9% |
| `reui` motion icons | 19.8 kB | 2.4% |
| `expression` components | 17.3 kB | 2.1% |
| remaining (~15 groups, incl. deps) | ~86 kB | ~10% |

Dependency contribution is tiny — the biggest single dep (`dayjs`, via the
date picker) is 2.9%. There is no meaningful win in dependency pruning.
All dependencies and peerDependencies stay external; the only bundled
third-party code is `dayjs`/`fast-deep-equal`/`zustand` **subpath** files
(ESM, safe). `use-sync-external-store` (CJS) is deliberately externalized —
bundling it under Rolldown keeps its `require('react')` and crashes hosts
(see `vite.config.ts`).

## Monaco dependency model (master vs current)

Master (upstream) declared `monaco-editor ^0.52.2` as a plain
**dependency** — consumers installed it automatically while the lib build
kept it external. The fork moved it to **peerDependencies** (roadmap 0.3.0
§1.1, ~5 MB install slim-down) and, per S008, made the kernel source
**type-only** toward monaco: the single former value import
(`MarkerSeverity` in `function.tsx`) is now a local literal (`Error = 8`,
monaco's fixed persisted-data contract), and the runtime instance arrives
via the `useMonaco()` / `loader.config({ monaco })` bridge
(`helpers/monaco.ts`, byte-identical to master) with worker wiring
documented as the host's responsibility (`MonacoEnvironment.getWorker`).

Rationale — monaco's three library-hostile properties: **global
singleton** (two copies silently break markers/themes/languages), **worker
wiring** (host bundler/deployment specific), **5 MB size**. Therefore the
library must not statically value-import monaco, must not bundle it, and
must keep the single-instance guarantee by letting the host own the
dependency. Restoring the static import would buy nothing (the literal
passes the identical value) while re-creating the S008 poisoning (any
consumer applying tsconfig paths to runtime resolution pulls
`editor.api.d.ts` in as JS). CodeMirror 6 libraries can bundle their
editor precisely because CM6 lacks all three properties — the patterns are
not transferable.

## Split decision (roadmap §3.1)

`decision-graph` + `decision-table` account for **44%** of the rendered
bundle. A surface split (`./dist/graph`, `./dist/table` entry points) would
let single-surface hosts skip roughly a third of the payload, at the cost of:

- shared-chunk bookkeeping (theming/code-editor/primitives become common
  chunks or get duplicated),
- an exports-map and host-guidance update,
- cross-surface features (graph embedding a decision-table node) needing the
  other chunk anyway — hosts must include both or accept dynamic imports.

**Recommendation:** defer until a host actually reports single-surface usage;
the absolute gzip cost today (118 kB) is moderate for an editor SDK, and the
split's bookkeeping is not free. Re-evaluate if index.js crosses ~180 kB gzip
or a single-surface host use-case materializes. Host-side tree shaking is the
main lever, but note the `sideEffects` experiment was REVERSED (2026-09-08):
under Rolldown the array-glob declaration shook the i18n catalogs out of the
dist — see roadmap §3.1 for the full post-mortem. Host-side tree shaking is the
primary lever (`sideEffects` is declared; see roadmap §3.1).

### Experiment result (measured 2026-09, Vite 7)

A `manualChunks` surface split was attempted (`chunk-graph-side` /
`chunk-table-side` / `chunk-editor` by module path). **Vite lib mode ignores
`manualChunks`** — the build emitted a single index.js as before. The only
viable split path is **multiple lib entries** (`entry: { index, graph, table }`)
plus an exports-map review and host guidance; cross-surface imports (graph
embedding table nodes) will pull both chunks for mixed hosts regardless.
Under Vite 8 the equivalent knob is Rolldown's `advancedChunks` /
`codeSplitting` option. Decision: recorded as the concrete implementation
path for a future major if single-surface demand materializes; not scheduled.

## Cheap wins (no split needed)

- `dayjs`: only the date-picker needs it — if the picker moves to a native
  input, 24 kB drops out (candidate only if the picker itself is dropped).
- `@types/big.js` appears in the rendered graph (~16 kB via `?raw` d.ts
  imports for the function editor) — verify it ships no runtime code.

## How to regenerate

```powershell
$env:BUILD_ANALYZE = '1'
corepack pnpm@10 --filter @republicroad/jdm-editor build
node -e "..."   # see commit history for the analyzer snippet
```
