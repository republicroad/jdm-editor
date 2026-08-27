# CodeMirror Skin Cascade Problem & EditorView.theme() Migration

> Record of the "decision-table cell display ↔ edit cursor drift" and
> "single-click-to-edit regression" bugs (2026-08), the accepted CSS
> workaround, the batch migration to CodeMirror's native theming API, and the
> Spike decision on the highlighter replacement.
> Chinese canonical: [`codemirror-theme-migration.zh-CN.md`](./codemirror-theme-migration.zh-CN.md).

## 1. Background & Root Cause

### 1.1 The cascade war (CSS layers vs runtime-injected `<style>`)

CodeMirror 6 injects its baseTheme as **unlayered** plain `<style>` at runtime
(e.g. `.ͼ1 .cm-content { padding: 4px 0 }`, `.ͼ1 .cm-line { padding: 0 2px 0 6px }`,
`.ͼ1 .cm-scroller { line-height: 1.4 }`).

Cascade rule: **any unlayered declaration beats every same-importance `@layer`-ed
rule** — regardless of specificity or order. The library's CodeMirror skin lived
inside `@layer components` in `tailwind.css`, so it lost everywhere; the antd-era
`ce.scss` was unlayered plain SCSS and was immune by construction. Same lesson the
decision-graph section had already learned from `@xyflow/react`.

### 1.2 Measured drift (before the fix)

| Property | Display (highlighter) | Edit (CodeMirror) | Result |
| --- | --- | --- | --- |
| `.cm-content` padding | 9px 12px (cell tokens) | **4px 0px** (CM injection won) | 5px top offset |
| `.cm-line` padding | 0 | **0 2px 0 6px** (CM injection won) | ~6px left offset |
| Line height | 21px (`--ce-lineHeight:1.5em`) | **19.6px (1.4)** (CM injection won) | multi-line cumulative drift |

## 2. Applied Fix (`src/styles/tailwind.css`) — now superseded by §3

1. **The whole CM skin moved out of every layer** (`.grl-ce …`, `.grl-ce-highlighter …`)
   into the unlayered third-party zone, next to the decision-graph section.
2. `!important` on the **three geometry-critical declarations CM also emits**
   (content padding, line padding, scroller line-height) plus the preview reset —
   CM's `<style>` lands late in the document and wins same-specificity ties by order.
3. **Pitfall record**: the token defaults
   `.grl-ce { --ce-lineHeight / --ce-verticalPadding / --ce-horizontalPadding }`
   must stay inside a small `@layer components` block. Moving them out (first
   migration attempt) let unlayered defaults beat the cells'
   `[--ce-verticalPadding:9px]` utilities — custom properties obey the cascade —
   silently reverting every cell to 4px/11px. Rule of thumb:
   *"token defaults that utilities may override live in a layer; geometry rules
   that must beat runtime injection stay out of layers."*

### 2.1 Verification (Playwright probe @ Storybook :9009)

```
contentPadding identical in both states (9px 12px from cell tokens)
line-height 21px both; cm-line padding 0 both
first-line box dX = 0.00, dY = 0.00
```

Benign residual: the edit-side `.cm-content` is stretched by CM's
`min-height:100%` (display side is natural height). First-line coordinates are
unaffected (empty-editor hit-area behavior) — accepted.

Gates: typecheck ✅ / vitest 206 ✅ / lint:compiler 0 errors ✅.

### 2.2 Batch D (phase-1) migration log & iteration trajectory (`bc2cd84`)

After moving the skin into `code-editor/theme.ts`, the geometry probe recorded
this regression trajectory. Each FAIL maps to one class of
"shared rule deleted / display side left behind", and each fix defined the
**residual CSS boundary**:

| Iteration | dX / dY | Problem exposed | Fix |
| --- | --- | --- | --- |
| First cut | content pad 4px11px, lh 24 vs highlighter 0/normal | The shared `.grl-ce .cm-content/-scroller/-line` geometry rules were deleted — **the manual highlighter DOM does not go through theme()** | Added the `Highlighter PARITY ONLY` block (lh/pad/scroller font scoped to `.grl-ce-highlighter`) |
| Second | dx=dy=1.00 | The real editor owns a 1px border via theme(); the highlighter lost its border | Added `.grl-ce-highlighter .cm-editor { border: 1px solid var(--grl-color-border) }` |
| Final | **dX=0.00 / dY=0.00** + padding/lh all equal | — | Parity block sealed; LazyParity keeps guarding |

Lessons folded into the checklist:
- **theme() only reaches the live editor**: any sibling DOM sharing the editor's
  visuals (highlighter, preview) needs its own parity block; enumerate every
  consumer of a shared rule before deleting it.
- **Even 1px borders enter the probe radar**: check every box-model participant
  (border/padding/min-height); never assume "visually tiny" is harmless to
  caret positioning.

## 3. Long-term plan (executed): migrate into `EditorView.theme()`

CSS could win, but every collision needed `!important` or a layer change, and
the maintenance cost grows with each CM release. CodeMirror's theme-extension
API sits at the right precedence by construction, ending the war.

### 3.1 Motivation

- **Precedence guaranteed by the framework**: `EditorView.theme(spec, { dark })`
  generates editor-scoped classes injected after baseTheme with higher
  specificity — no layers, no `!important`.
- **Scope automatic**: styles apply only to the EditorView instance carrying
  the theme, never leaking into global `.cm-*`.
- **Static removal**: when the manual `CodeHighlighter` DOM (ce-highlight.tsx)
  disappears, its CSS goes with it.

### 3.2 Mapping (skin → theme spec)

| CSS selector | Destination |
| --- | --- |
| `.grl-ce .cm-editor` (background/radius/focus ring/severity) | `theme({ '&': …, '&.cm-focused': …, '&[data-severity=…]': … })` |
| `.grl-ce .cm-content` (padding/wrapping) | `'& .cm-content'` |
| `.grl-ce .cm-line` (padding/caret-color) | `'& .cm-line'` |
| `.grl-ce .cm-scroller` (font-family/line-height) | `'& .cm-scroller'` |
| completion / tooltip / lint visuals | `'& .cm-tooltip'…` sub-keys, or the existing `zenStyleLight/Dark` HighlightStyle |
| `.grl-ce.max-rows/.full-height/.no-style/.grl-ce-single` | **stays in Tailwind** — component-owned layout, not CM skin |
| token defaults `--ce-*` | stay layered (GRL-LAYER-GUARD); consumption via `var()` in theme keeps the utilities-override channel alive |

### 3.3 Implementation steps

1. ✅ (Batch D phase-1, `bc2cd84`) `code-editor/theme.ts`: single-object
   `buildZenSkin(): Extension` (all values are `var()` references — mode flips
   and per-instance token overrides need zero re-registration); appended LAST
   in ce-base's extension list.
2. ✅ Same batch: deleted 315 lines of tailwind.css rules per the mapping;
   `!important` inventory 35 → 18; straggler `#f5f5f5` moved onto its existing
   `--tooltip-bg` token.
3. ⬜ **phase-2 prerequisite design (gated): highlighter replacement** — the
   manual `CodeHighlighter` DOM is a lazy-mode performance optimization.
   Candidates: (a) read-only shared EditorView instances, (b) static
   SVG/HTML render pipeline. **Until that design review passes**, the PARITY
   block stays; do not delete it early.
4. ⬜ phase-2 checklist: replace highlighter → delete PARITY block +
   `.grl-ce-highlighter` section → LazyParity assertions become
   "both sides driven by theme()" → registry HK-03/HK-07 closed.
5. ⬜ Close-out: cell padding as props (dropping the `[--ce-*]` utility channel
   requires proving theme()-internal `var(--ce-*)` decoupling from utilities —
   empirically proven in Batch D).

### 3.4 Risks & rollback

- Tooltips/completion render inside the view tree (incl. fixed positioning), so
  theme() covers them; any exceptional subtree keeps a small non-layer CSS patch.
- Each CodeEditor instance carries the theme object (~KB per instance); a
  module-level cache is available if it ever matters.
- Rollback: deletions were batched; reverting one batch returns to a verified state.

### 3.5 Spike decision memo (2026-08, Batch H) — candidate A rejected

Candidate A (read-only EditorView replacing the highlighter) was implemented
behind `localStorage.gru-hl-view=1` in `ce-highlight-view.tsx` (default off).
Measured on decision-table--stress-test (10k rows) + controlled toggles ×5:

| Metric | Baseline (highlighter) | Candidate A | Verdict |
| --- | --- | --- | --- |
| Heap (settled) | 104 MB | **141 MB (+36%)** | ❌ decisive: every visible cell carries a full EditorView |
| Scroll FPS | 61 | 61 | tie |
| Toggle latency (×5 avg) | 79–148ms band | 88ms | inside noise, no advantage |

**Decision**: candidate A rejected. Phase-2 re-scoped to "keep the highlighter
under test guard": the PARITY block stays, locked by LazyParity and the 0.00
probes; candidate B (static pipeline) is re-evaluated only under new render
pressure or a breaking CM highlight-API change. The real win of this batch is
the theme() migration itself: `!important` 35→15 and dual-track geometry
hard-locked by tests. The PARITY-deletion checklist is void; registry
HK-03/HK-07 moved from "pending deletion" to "long-term coexistence
(test-guarded)".

### 3.6 Follow-up attempt: pooled form (Spike-A2, archived pending trigger)

> Retrospective: the ONLY decisive metric in §3.5 was settled heap +36% — but
> that measurement **did not force GC**. Floating garbage from the 10k-row
> initial render and scroll churn may be included; true-resident vs
> un-collected was never separated. The verdict is therefore **reviewable**,
> and this section archives the revival design.

**A2 core design (Table-scope fixed-capacity pool)**

- Capacity = visible rows × CE columns + 2 spare; the pool owns its state at
  the Table scope (TanStack Virtual unmounts cells on scroll, so the pool must
  live outside that lifecycle; cells acquire/release via context).
- `acquire(cellId)`: take an idle view → reparent `view.dom` → full doc
  replacement (small strings, <1ms) + compartment reconfigure
  (type/placeholder) → `view.requestMeasure()`.
- `release(cellId)`: blank the doc (avoid large values resident) → return to
  pool; read-only views **disable history** (no cross-cell state bleed) and
  clear selection on reuse.
- Edit takeover: click → release → existing ce-base protocol unchanged.

**Measurement fix first (hard reopen gate)**

- Launch Playwright with `--js-flags=--expose-gc`; read the heap after
  `window.gc()` ×2.
- Re-measure both paths the same way to get **Δ_true**; **Δ_true ≤ ~10%**
  reopens the pooled PoC, otherwise this section and §3.5 close permanently.

**Guard assertions (pooled PoC must pass)**

1. Caret offset after reuse = 0 (LazyParity grade);
2. No cross-cell bleed: A-cell selection must never appear in B-cell;
3. Placeholder renders and clears correctly.

**Thresholds & sizing**

- Implementation gate: Δ_true within band AND no long tasks while scrolling
  AND all three assertions green.
- Sizing: spike ≈0.5d; production implementation ≈1–1.5d.

**Suggested triggers**: scroll long-task / GC-jank complaints, or a breaking
CodeMirror highlight-API change forcing a highlighter rewrite.
