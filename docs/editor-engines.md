# Editor Engines: CodeMirror 6 vs Monaco — Usage Matrix & Selection Rationale

> Which engine this library uses where, and why the split is intentional.
> Bilingual pair: [`editor-engines.zh-CN.md`](./editor-engines.zh-CN.md).

## Usage Matrix

| Scene | Engine | Language / Shape |
| --- | --- | --- |
| **Decision-table cells** (Zen expressions, unary/standard) | CodeMirror 6 | custom DSL, `@gorules/lezer-zen` grammar |
| **Expression nodes** (expression-item) | CodeMirror 6 | same |
| **Diff display** (diff-ce, rule change comparison) | CodeMirror 6 | same, inline two-row |
| **Function editor** (tab-function / function.tsx script body) | **Monaco** | JavaScript + **DiffEditor** + error-line markers (`MarkerSeverity` / `errorLineContent` decoration) |
| **Simulator input** (simulator-editor) | **Monaco** | JavaScript |
| **JSON ↔ JSON Schema dialog / Schema tab** | **Monaco** | JSON/JS conversion preview |
| Debugger display (read-only) | CodeMirror 6 | reuses the CE skeleton |

## Selection Logic (four decisive dimensions)

**1. Data shape: custom DSL vs standard languages**

- Zen expressions are a **home-grown DSL** — CodeMirror 6's Lezer system makes
  custom grammars first-class: the syntax tree directly drives highlighting,
  structured completions, hover tooltips, and the wasm type-checking injected
  as diagnostics (all in `extensions/zen.ts` + `extensions/*`). Monaco's
  Monarch (regex-based) grammars are a tier weaker for this, and semantic/type
  integration would be hand-rolled.
- Function bodies and the simulator are **standard JavaScript/JSON** — Monaco
  ships TS-grade semantics, error markers, formatting, and folding out of the
  box; hand-rolling those is unrealistic.

**2. Instance economics: many-small vs few-heavy**

- The table is a **10k rows × one-editor-per-visible-cell** shape (~25 live
  instances after virtualization): CodeMirror 6 instances are lightweight, have
  no mandatory DOM structure, and embed inside 38px-tall grid cells.
- Monaco's kernel is ~1MB+ and heavy per instance — but function/simulator
  surfaces host only **1–2 large editors per page**, so the cost is justified.
- Counter-proof from the P2 Spike: a pool of **lightweight read-only**
  single-instance EditorViews already cost +36% heap — putting Monaco inside
  table cells is a non-starter.

**3. Interaction shape: inline-embedded vs canvas-style**

- CM6 is shell-less and composable, suited to embedding against surrounding UI
  (cell `h-full`, inline diffs, hover tooltips).
- Monaco is a canvas-style IDE surface, at home in sidebar/main-region large
  editing areas.

**4. Bundle strategy: resident vs on-demand**

- CM6 is modular (pay per feature) and ships resident with the package — the
  table/expression main path pays nothing extra.
- Monaco goes through the `@monaco-editor/react` **loader pattern**
  (`helpers/monaco.ts` centralizes config) — the kernel loads only when a
  function/simulator/schema surface is actually opened, keeping the table main
  path free of the ~1MB tax.

## Theming integration (shared contract)

Both engines consume the same `--grl-*` token layer: Monaco through the
light/dark theme definitions in `helpers/monaco.ts`, CodeMirror through the
`EditorView.theme()` skin (`code-editor/theme.ts`, Batch D). Neither engine
hardcodes palette literals.

## One-line Summary

**The right engine for the right language**: home-grown DSL + many small
instances → CodeMirror 6 (Lezer-first, light, embeddable); standard JS/JSON +
few large canvases → Monaco (VSCode-grade semantics, Diff/markers out of the
box) with loader-based on-demand loading isolating its size.
