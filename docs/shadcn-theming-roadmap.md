# shadcn/ReUI One-Click Theming Roadmap

> Long-term target architecture and phased plan for the CSS/theme system.
> Origin (2026-08): the decision-table cell interaction bugs (single-click
> regression + cursor drift, see `codemirror-theme-migration.md` and
> `troubleshooting.zh-CN.md`) — cascade hacks only buy time; smooth retheming
> needs this roadmap.
> English is canonical; the `.zh-CN.md` file is the synced translation.

## 0. One-Click Retheming Acceptance Criteria

| # | Criterion | Check |
| --- | --- | --- |
| A1 | A new theme needs only 4–8 seed values (brand/success/warning/error/neutral axis/radius/font) or one semantic-variable override block | Add a theme file, eyeball the app |
| A2 | Zero changes to component sources, `tailwind.css` rules, or third-party skins (CodeMirror/Monaco) | `git diff` touches token files only |
| A3 | No `!important` on the theming path; the unlayered CSS zone stops growing | CI budget assertion (§P4) |
| A4 | Dark/light and brand switches are orthogonal, any combination | ✅ Theming / Seeds Playground story (Batches E/F) |
| A5 | Editor-chrome palettes (syntax highlight, Monaco) derive from tokens, not standalone hardcoding | eyeball + assertion |

## 1. Current State: the Three-Layer Token Pipeline

```
JdmConfigProvider (theme.tsx)
  ├─ lightTokens/darkTokens hand-written hex tables (~35 entries ×2)
  │    → since Batch C these are the CALIBRATED presets; hosts passing
  │      `seeds` get derived overlays (theming/derive.ts), light via a
  │      linear-light mix ladder, dark via OKLab hue/L transforms (dark-ops.ts)
  └─ GlobalCssVariables → computeTheme() → runtime --grl-* on :root
          │
tokens.css   semantic bridge
  └─ --primary/--border/--ring … = var(--grl-color-primary) (+ static fallback)
          │
tailwind.css @theme inline
  └─ bg-primary / border-border … utilities inline to var() at build time
```

Already in place: `@theme inline` ✅ · `[data-mode='dark']` domain-override dark
mode ✅ · provider `token` passthrough ✅ · `seeds` derivation both modes ✅
(A4). Structural issues this roadmap addressed:

1. **Double source of truth** — hand-written shade tables + light/dark ternaries
   → replaced by seed derivation with the frozen tables as calibration presets.
2. **Component-level leaks** — 14 hardcoded hexes outside the pipeline
   → closed in Batch B (registry HK-09..13), budget now 0 via `lint:debt`.
3. **Cascade debt** — CodeMirror skin unlayered + `!important` inventory
   → skin migrated to `EditorView.theme()` (Batch D), `!important` 35 → 11.
4. **`:root` global injection** — single theme instance per page, pollutes the
   host root (§P3, deferred).

## 2. Phased Plan

> Decision record (2026-08): user-visible interaction bugs first; long-term
> capability advances phase by phase. P3 is a separate item (host-visible
> behavior change).

### P0 — Seed derivation replaces hand-written shade tables ✅ (Batches C/F)
- Internally: seeds → derived values → full `--grl-*` output. Public API
  unchanged: `JdmConfigProvider.token` antd-vocabulary keys still win over
  everything; additive `seeds={{primary,...}}` triggers derivation. Default
  seed set short-circuits to the frozen preset (byte parity).
- Light mode: linear-light mix ladder, ratios reverse-calibrated offline
  (golden tolerances, worst warningBorder Δ66/255 recorded honestly).
- Dark mode (phase-2, Batch F): zero-dep OKLab (`color.ts`) — hue rotation +
  lightness scaling around the calibrated anchors in `dark-ops.ts`; invariant
  tests guard default passthrough and custom-seed hue following.
- Neutral axis folded into `MODE_EXTRAS`; editor-chrome statics
  (`--tooltip-bg`, `--diagnostic-chip-bg`, `--error-line-bg`) consume tokens.

### P1 — Close component-level hardcoded leaks ✅ (Batch B)
- tokens: `--grl-color-field-input/output(-hover)`, `--grl-color-text-light-solid`.
- Replaced HK-10/11/12 pills+chips, HK-09's `#fff`, HK-13 placeholder hex;
  expression editor geometry consolidated on `--ce-*:12px`.

### P2 — Cascade cleanup (third-party skins归位) 🟡
- ✅ phase-1 (Batch D): CM skin → `EditorView.theme()`; `!important` 35→15.
- ✅ HK-01 (Batch G): react-json-tree styled via its own theme stylables
  (tree.display + per-depth value fn), 6 `!important` + CSS block deleted.
- ✅ HK-02 (Batch G): inline-tabs rhythm moved to utilities on the primitive.
- ✅ HK-08 shrink: own-DOM blocks (edge delete button, palette dim) moved to
  `@layer components`; the remaining unlayered zone is platform-constrained
  (React Flow injects unlayered runtime styles).
- ✅ phase-2 highlighter replacement EXECUTED via the archived Spike-A2 revival (Batch A2): expose-gc Δ_true 5.9% passed the reopen gate; CellViewPool implemented behind the gru-hl-view flag (grayscale through minor);
  pooled revival path archived in migration doc §3.6 with reopen gates.
  HK-03/HK-07 are long-term coexistence under test guard (LazyParity).

### P3 — Scoped injection (separate later item ⚠️)
- `GlobalCssVariables` writes nearest-`.grl-root` first, `:root` fallback;
  `data-mode` on the container too. Also delivers HK-14 closure: Radix portals
  targeting the `.grl-root` container bring the scoped preflight (box-sizing)
  back to portaled nodes, retiring the explicit Modal patch.
- ⚠️ Host-visible behavior change — requires host regression sign-off.
- Depends on P0/P1/P2 being done.
- **Close-out Batch S (lexical-scope hardening) is chartered**: semantic bridge into the island / dark-variant island-boundary isolation / Shadow DOM memo / isolation harness — see the Batch S section below.

### P4 — Guardrails ✅ (Batches A/E, ongoing)
- `pnpm lint:debt`: `!important` budget (18→11) and raw-hex zero (whitelist =
  token truth-sources + editor syntax palettes + stories). ✅ wired into
  `.github/workflows/validate.yaml` (Style-debt budget step).
- `pnpm verify` aggregates lint/typecheck/compiler/debt/tests. ✅
- Geometry parity in `test-storybook` via LazyParity. ✅ wired into CI
  (Storybook interaction suite step, after the Playwright chromium install).
- Theming / Seeds Playground story. ✅ (Apply-to-page waits for P3.)
- **Contrast assertions** ✅ (theming/contrast.test.ts): WCAG ratio checks over the
  derived token maps for critical text/background pairs (body ≥4.5, large/solid
  ≥3.0, sampled custom seeds), running with vitest inside verify/CI. Two
  upstream traits recorded honestly: antd default primary on white measures
  4.10 (threshold set to 4.0 per industry practice for link text) and the
  warning text/bg pairing measures 2.76 (threshold 2.5, banners pair with
  icons/controls). Also fixed a float-to-hex bug in the new flattenOver helper
  surfaced by these very assertions.

P4 is complete.


## Batch S — Lexical-Scope Hardening (final close-out batch · chartered, unscheduled)

> Positioning: P3 topologized variables/portals/data-mode (scope decided by
> component tree). This batch pulls the remaining global leaks inside the same
> boundary — the closing act for library distribution and host style isolation.
> Audit baseline: 2026-08, three leaks (L-A/L-B/L-C) + one directional
> decision (S3).

### Leak audit

| # | Leak | Location | Risk scenario |
| --- | --- | --- | --- |
| L-A | Semantic bridge on `:root`: `tokens.css` defines `--background/--primary/--radius…` globally | `tokens.css:12-68` | A host also running shadcn has its own `:root` semantic layer; load order decides who clobbers whom — the canonical library-pollution incident |
| L-B | dark variant cross-island bleed: `@custom-variant dark` matches `[data-mode='dark']` and descendants | `tailwind.css` (`@custom-variant` line) | Host page sets `html[data-mode=dark]` while the island Provider forces light → island `dark:` variants still ignite; variables say light, components say dark |
| L-C | misc globals (`--mono-font-family`, `--grl-transition`…) | `tokens.css` / `tailwind.css` | generic names, constant values, benign collisions — document only |

### S1 · Semantic bridge into the island (core, fixes L-A)

A P3-established fact makes this clean: **on an island, `.grl-*` are always
defined** (inline-injected), so the bridge's static fallbacks are unreachable
there. Bridge selectors become:

```css
.grl-root { --background: var(--grl-color-bg-layout, #f5f5f5); /* …all semantic keys */ }

/* legacy: only when no island exists on the page */
:root:not(:has(.grl-root)) { /* existing light/dark mode blocks */ }
```

- Effect: the host's shadcn semantic layer and ours become fully mutually
  oblivious; multiple islands resolve independently
- `:has()` is green across evergreen browsers (2023+), acceptable for
  distribution
- Risk check: every bridged key (incl. `--radius`) must have an island-level
  upstream or its own default
- ⚠️ **Open question (must be answered before executing)**: hosts referencing
  `var(--background)`-style semantic vars OUTSIDE the island (to follow our
  theme) break under S1 — provide an explicit opt-out variable package
  (standalone css or a documented copy list) for those hosts

### S2 · dark-variant island-boundary isolation (fixes L-B)

Append a light-island exclusion to the custom variant:

```css
@custom-variant dark (
  &:where([data-mode='dark'], [data-mode='dark'] *):not(
    :where(.grl-root[data-mode='light'], .grl-root[data-mode='light'] *)
  )
);
```

Host dark + island light → island `dark:` variants no longer ignite; islands
declaring dark still hit the first arm; non-island elements behave as today.

### S3 · Shadow DOM decision memo (evaluated, NOT implemented, archived triggers)

The ultimate lexical scope, but hard-blocked:

- **Monaco relies on document-level listeners/globals with known shadow-DOM
  defects** — not viable while the function editor uses Monaco (see
  `editor-engines.md`)
- Feasible surfaces: CM6 supports a `root` option ✓ · Radix Portal
  `container=shadowRoot` ✓ · custom properties inherit across shadow
  boundaries ✓ (token layer is naturally compatible)
- Trigger: any point where Monaco is replaced/removed

### S4 · Isolation harness (regression guard)

New `theming--isolation` story + Playwright probes:

1. Two islands side-by-side (different seeds × modes) → same-name vars differ,
   no cross-influence
2. Mock host element outside islands (own `--background`) → unaffected by
   island/bridge
3. Host html forced dark + island light → island `dark:` variants inactive
   (S2 regression lock)
4. Full 57-story regression (S1 selector changes touch the whole surface)

### Explicitly out of scope

- **Utility prefix** (Tailwind prefix): README rules collisions benign; change
  surface = every component className, payoff disproportional
- **`@scope`**: Firefox not ready, fails the distribution baseline
- **Shadow DOM implementation**: see S3

### Sizing & order

S1 (0.5d) → S2 (0.25d) → S4 (0.5d) → S3 archive (0.1d); ≈1.5d total.
Execution gate: an answer to the S1 open question; host regression notice.

## 3. Double-Layer Structure Decision Record

**Decision**: keep both layers (`--grl-*` runtime layer + shadcn semantic
bridge), decouple first, flatten later.

- ✅ **Transition complete** (2026-08, Batch C/F): default seeds hit the frozen
  calibration presets; host `seeds` trigger derivation; explicit `token` still
  wins. `tokens.css` bridge untouched.
- End state: flatten to the shadcn semantic layer; mark `--grl-*` `@deprecated`
  and remove in two batches (unreferenced keys first, then as consumers move to
  semantic names).

## Appendix A — Style-Debt Registry

> Grep: `rg -n 'GRL-STYLE-HACK' packages/jdm-editor/src`
> Categories: cascade-layer · important · hardcoded-color · vendor-dom ·
> inline-beat · boundary. Status recorded per 2026-08 batches.

| ID | Location | Category | Summary | Phase | Status |
| --- | --- | --- | --- | --- | --- |
| HK-01 | function-debugger-log.tsx | ~~inline-beat~~ theme | react-json-tree styled via `tree.display` + `value` stylable; 6 `!important` + block deleted (2 dead selectors dropped) | P2 | ✅ Batch G |
| HK-02 | primitives/tabs.tsx | ~~important~~ utilities | tablist/tab rhythm as utilities (`m-0 p-0!`, `px-3.5 text-[13px]`); call sites untouched | P2 | ✅ Batch G |
| HK-03 | tailwind.css CM banner | cascade-layer | skin → `code-editor/theme.ts` (phase-1); residual = highlighter skeleton + layout classes, test-guarded | P2 | 🔒 coexistence |
| GRL-LAYER-GUARD | tailwind.css `@layer components { .grl-ce {--ce-*} }` | (positive example) | token defaults must stay layered — moving them out silently reverted cells to 4px/11px | do-not-touch | — |
| HK-04 | tailwind.css `[data-severity]` ×3 | important | severity backgrounds beat CM baseTheme inside theme() | P2 | ✅ Batch D |
| HK-05 | scroller/content/preview geometry | important | cursor-drift fix body → var()-driven in theme(); LazyParity dX/dY=0.00 | P2 | ✅ Batch D |
| HK-06 | completion/tooltip/lint cluster | important | migrated into theme(); `#f5f5f5` landed on `--tooltip-bg` | P2 | ✅ Batch D |
| HK-07 | hover-tooltip + highlighter flex | important | hover-tooltip in theme(); highlighter skeleton coexists under test guard | P2 | 🔒 coexistence |
| HK-08 | decision-graph banner | cascade-layer | own-DOM subset moved to components; react-flow__* are platform-constrained coexistence | P2-late | 🟡 shrunk |
| HK-09 | excel wizard + `color:#fff` | cascade-layer + hardcoded-color | white → `--grl-color-text-light-solid` (Batch B); selector segment stays with P2 | P1+P2 | 🟡 color ✅ |
| HK-10 | field-edit-popover pill | hardcoded-color | → `--grl-color-field-input(-hover)` | P1 | ✅ Batch B |
| HK-11 | output-field-edit pill | hardcoded-color | → `--grl-color-field-output(-hover)` | P1 | ✅ Batch B |
| HK-12 | graph-excel-dialog dataTypeConfig | hardcoded-color | same field tokens via var() | P1 | ✅ Batch B |
| HK-13 | expression-item editor className | vendor-dom + hardcoded-color | placeholder → semantic token; geometry on `--ce-*:12px`; `pr-[60px]` control gutter kept | P1 | ✅ Batch B |
| HK-14 | scoped preflight boundary + modal.tsx | boundary | Radix portals under `<body>` miss `.grl-root` border-box; six primitives carry explicit `box-border` (Batch A); portal scoping → P3 | P3 | 🟡 |

Explicit exemptions (not debt): `theme.tsx`/`theming/presets.ts`/`tokens.css`
(token truth); editor syntax palettes (`zen.ts`, `diagnostic.tsx`,
`function-debugger-log.tsx`, `ce-preview.tsx`); stories sandbox styles.
