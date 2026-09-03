# Troubleshooting Notes / 故障排查记录

> English is canonical; [`troubleshooting.zh-CN.md`](./troubleshooting.zh-CN.md) is the synced translation.
> Each entry records symptom → investigation → root cause → fix → verification, so future
> maintainers can reuse the diagnostic technique, not just the conclusion.

## 1. Decision-table stress story froze the whole test run

**Date:** 2026-08 · **Fixed in:** `9ba5a82` (+ `06dbe4d` lint follow-up)

### Symptom

`test-storybook` reported 3 failures in `decision-table.test.js`, all
`Exceeded timeout of 15000 ms`: `Stress Test`, `Business Mode`,
`Business Mode Dictionaries`. The failures looked random per run and were
initially blamed on local machine slowness ("CI will pass").

### Investigation timeline

1. **Reproduce under CI-like conditions.** Instead of the dev server, build
   Storybook statically and serve it (`storybook build -o docs` +
   `http-server`), then run the suite. Result: still failing, but now only
   **2** tests failed — and the *suspects had changed*: `Stress Test`
   **passed**, while both tiny `Business Mode` stories timed out at the new
   120 s cap. Suite time: **250 s**.
2. **Do the arithmetic.** `decision-table.test.js` took 246.5 s for 4 tests.
   Two capped timeouts = 240 s ⇒ the other two tests (incl. a 10k-row stress
   render) finished in ~6 s total. Tests in one Jest worker share one browser;
   iframes of the same origin share one Chromium renderer process. A test that
   keeps the CPU busy *after finishing* starves every later same-origin test
   in that worker.
3. **Probe pages solo.** Load each story's `iframe.html` directly with
   Playwright:
   - `business-mode`: rendered in ~10 s, 13 rows, zero console errors,
     page responsive.
   - `stress-test`: the probe froze — `page.evaluate('1+1')` never returned,
     even after >170 s. A poll loop printing every 5 s produced no output at
     all, meaning the renderer process was fully saturated.
   
   Inversion explained: Business Mode was collateral damage, StressTest was
   the poisoner.

### Root cause

The story wrapped `<DecisionTable tableHeight='100%'>` inside
`<div style={{height:'100%'}}>`, but Storybook's iframe gives
`#storybook-root` no height. The chain broke:

```
#storybook-root      height: unset
└─ wrapper div       height: 100% of auto  → auto
   └─ .grl-dt        (no height)
      └─ container   maxHeight: '100%' against an auto-height parent
                     → percentage resolves to none → NO constraint
```

TanStack Virtual sizes its window from the scroll element's `clientHeight`.
With no constraint the "window" equals the full content, so **all 10k rules**
(~100k DOM nodes: contenteditable cells, icons, handlers) rendered at once.
Continuous layout/paint work pegged the renderer main thread indefinitely.

### Fix

- `dt.stories.tsx` — `StressTest` uses an absolute unit,
  `tableHeight='90vh'`. `vh` resolves without any ancestor height, so the
  virtualizer window stays bounded (~25 rows) regardless of host CSS.
- `test-runner-jest.config.cjs` — raise jest `testTimeout` to 120 s as a
  defensive margin for slower CI runners (the runner picks up any
  `test-runner-jest*` file in cwd and passes it to jest as `--config`; keep
  the file CJS because jest loads it directly under `"type": "module"`).

### Verification

- Solo probe after fix: responsive from t=6 s, stable 25 rendered rows,
  zero errors, browser closes cleanly.
- Full static suite: `decision-table.test.js` **246 s → 5.9 s**, total run
  **250 s → 9.8 s**, **55/55 passing**.

### Lessons / checklist

- **Virtualizer + unresolved percentage height = unbounded render.** Any
  story or demo rendering large data must give the scroll container an
  absolute height (`px`/`vh`), never rely on `100%` chains inside
  Storybook iframes.
- **A timeout on test N may be caused by test N-1.** Compare per-suite wall
  time against the sum of individual caps; leftovers reveal CPU starvation.
- **`page.evaluate('1+1')` with a short timeout is the cheapest busy-loop
  detector** for a frozen renderer.
- Don't trust *which* test fails — trust *how long* everything took.

## 2. Boolean dropdown silently refuses to change value

**Date:** 2026-08 · **Fixed in:** `d9773f7` (boolean un-coercion; clear-button semantics in `b6f70c0`)

### Symptom

In the expression builder's boolean field, the value dropdown opened and
showed both `true` / `false` options, but picking `false` did **nothing**:
the trigger kept showing `true`, the expression preview stayed `true`, and
the popup didn't even close. String-valued selects (status
`Pending → Cancelled`) worked fine through the same component, and the bug
was noticed right after the SCSS→Tailwind restyle — so it initially looked
like a migration regression.

### Investigation timeline

1. **DOM probe of the failing story.** The dropdown rendered 2 enabled
   options; clicking `false` left `[data-slot="select-content"]` still
   mounted and the trigger text unchanged. A *successful* Radix selection
   closes the popper, so the click was never registering as a selection.
2. **Control experiment.** The enum-type story selects fine through the
   same primitive `Select` ⇒ basic wiring works; something about the
   boolean *values* specifically.
3. **Instrumented probe.** Re-clicked via `elementFromPoint`-verified mouse
   coordinates (topmost element at the option center was the item itself,
   ruling out overlay/z-index interception) — this time with a
   `pageerror` listener attached:

   ```
   Error: invalid type: string "false", expected a boolean
   ```

### Root cause

The shimmed primitive `Select` maps antd-style props onto Radix, and Radix
only ever speaks strings: `onValueChange` delivered `"false"` regardless of
the option's declared value. The handler forwarded that coerced string
verbatim:

```tsx
onSelect?.(next, option);
onChange?.(next, option);          // next = 'false' — string!
```

so `BoolInput` stored `{type:'boolean', value:'false'}` — a string inside a
boolean-typed field. The zen-engine serializer threw on the next serialize,
aborting the update chain: no state commit, no re-render, popup stays open.
The error was invisible in the UI (console-only), which is why it presented
as "dropdown can't select". String-valued options masked the bug because
string→string coercion is lossless. **Pre-existing**, unrelated to the
styling work — surfaced by manual acceptance testing.

### Fix

`primitives.tsx` — emit the matched option's original value, per antd
contract:

```tsx
const option = list.find((item) => String(item.value) === next)
  ?? ({} as AntdSelectOption);
const raw = option.value ?? next;   // `??` keeps false; falls back only if unmatched
onSelect?.(raw, option);
onChange?.(raw, option);
```

Call-site audit before changing semantics: only `BoolInput` passes
non-string option values; granularity/enum selects use strings;
`DAYS`/`QUARTERS` feed the custom chip UI, not `Select`. No consumer relied
on receiving the stringified form.

### Verification

- Probe after fix: clicking `false` closes the popup, trigger shows
  `false`, expression preview updates — in both the expression builder and
  the standard builder boolean stories, zero page errors.
- Full gates: typecheck 0 · lint clean · vitest 86/86 · static suite 55/55.

### Lessons / checklist

- **Radix Select only transmits strings.** Any antd-compatible shim must
  un-coerce through the matched option before calling `onChange`/`onSelect`
  — otherwise numeric and boolean options corrupt downstream state.
- **"Opens but won't select" ⇒ check whether the popup closes.** If it
  doesn't close, the click never became a selection; attach a `pageerror`
  listener before suspecting CSS, z-index, or pointer events.
- **Type mismatches fail far from the input.** A wrong-typed value sailed
  through React state and only exploded in the Rust serializer — keep
  console/pageerror capture in every DOM probe.
- **When a functional bug appears right after a styling migration, run a
  control on a sibling first.** One passing control (enum select) split the
  problem from "migration broke Selects" to "non-string values break", in
  one step.

### Follow-up: repo-wide onChange bridge audit (`b6f70c0`)

The lesson was generalized into a standing project rule (also encoded in
`.opencode/skills/antd-shim-value-uncoerce/SKILL.md`): **any antd-compatible
shim must un-coerce values through the matched option before calling
`onChange`/`onSelect` — otherwise numeric and boolean options silently
corrupt downstream state.** Every `onChange` bridge path in the repo was
then audited:

| Bridge path | Verdict |
| --- | --- |
| Select single `onValueChange` | broken → fixed above (`d9773f7`) |
| Select multi/tags → `string[]` | safe — consumers expect string arrays; `ArrayInput` re-parses numbers itself via `parseFloat` |
| Select clear button | same-family bug → fixed in `b6f70c0` (see below) |
| Select `onSelect`, sole consumer (graph-excel-dialog) | safe — ignores first arg, reads `option`; clearing goes through explicit `onClear` |
| InputNumber | safe — already un-coerces via `Number()`, emits `null` when empty |
| DatePicker / TimePicker | safe — emit dayjs objects per antd contract |
| Checkbox / Switch | safe — plain booleans |
| Radio group | safe — custom React context forwards the original `value` prop, not Radix |
| Tabs | safe — tab keys are strings by antd design too |
| Input allowClear | safe — emits `{target:{value:''}}` event semantics, matching antd Input |

Scope closure: `primitives.tsx` is the only importer of the shadcn Select
and the only Radix→antd value bridge in the repo — no other `onValueChange`
bridges exist outside `components/ui/*`.

The audit surfaced one more member of the same family: the Select **clear
button emitted `''`**, while antd's contract is clear-to-`undefined`. That
silently defeated the explicit `val ?? undefined` guards in
`dt-excel-dialog.tsx` (`'' ?? undefined` is still `''`). It stayed latent
because every downstream reader used truthiness checks
(`filter(Boolean)`, ternaries), but the trap was real — fixed in `b6f70c0`
by emitting `undefined`.

## 3. Expression key-column textarea collapses in edit mode after SCSS→Tailwind migration

**Date:** 2026-08 · **Fixed in:** `d7a89d6` (noStyle passthrough + className restore)

### Symptom

In the `decision-graph--controlled` story, clicking "Edit Expression" on a
node opens the expression tab. The **key** column renders correctly in
read-only state (matches the expression column height), but the moment the
user clicks into the key field to edit, the textarea collapses to roughly
half its expected height. The expression column (CodeMirror-based) is
unaffected.

### Investigation timeline

1. **Diff the old SCSS against the new Tailwind.** The deleted
   `expression.scss` had a `[contenteditable]` rule under
   `.expression-list-item__key` that set `padding: 12px 12px`,
   `font-size: 13px`, `line-height: 1.5em`, `border: 0`, and
   `font-family: var(--mono-font-family)`. The A1 migration commit
   (`c23e136`) incorrectly classified these as dead code and dropped them.
2. **Trace the component chain.** `expression-item.tsx` passes `noStyle` to
   `DiffAutosizeTextArea`. In `diff-text-area.tsx`, `noStyle` is destructured
   out of props but **never forwarded** to `AutosizeTextArea` in the
   non-diff path (line 42). So `AutosizeTextArea` always receives the
   `grl-textarea-input` class, which adds `border: 1px solid`,
   `padding: 4px 11px`, `font-size: 14px` — different dimensions from the
   old SCSS.
3. **Compare the two bugs.** The `noStyle` passthrough was one problem (wrong
   base styles applied). Even after fixing passthrough, the bare
   `contentEditable` div had **zero padding and no height constraint**, so it
   collapsed to content-only height in edit mode.

### Root cause

Two layered issues:

| Layer | Problem |
| --- | --- |
| `diff-text-area.tsx:42` | `noStyle` destructured but not forwarded to `AutosizeTextArea` in non-diff path → `grl-textarea-input` always applied |
| `expression-item.tsx:117` | Even with `noStyle` working, the bare `contentEditable` has no padding/height/font styling → collapses on focus |

The old SCSS `[contenteditable]` rule provided all sizing. The Tailwind
migration dropped it (misidentified as dead code) and the `noStyle` prop
was broken, so no replacement styling was ever applied.

### Fix

**Part 1 — `autosize-text-area.tsx` + `diff-text-area.tsx`** (noStyle
passthrough, squashed into `d7a89d6`):

- `AutosizeTextAreaProps` gains `noStyle?: boolean`.
- `AutosizeTextArea` conditionally applies `grl-textarea-input`:
  `className={clsx(!noStyle && 'grl-textarea-input', className)}`.
- `DiffAutosizeTextArea` non-diff path forwards `noStyle` to
  `AutosizeTextArea`.

**Part 2 — `expression-item.tsx`** (className restore, same commit):

```tsx
<DiffAutosizeTextArea
  noStyle
  className='min-h-full py-3 px-3 text-[13px] leading-[1.5em]
             [font-family:var(--mono-font-family)] focus:shadow-none'
  ...
/>
```

This restores the old SCSS dimensions as Tailwind utilities:

| Old SCSS | Tailwind equivalent |
| --- | --- |
| `padding: 12px 12px` | `py-3 px-3` |
| `font-size: 13px` | `text-[13px]` |
| `line-height: 1.5em` | `leading-[1.5em]` |
| `font-family: var(--mono-font-family)` | `[font-family:var(--mono-font-family)]` |
| `&:focus { box-shadow: none }` | `focus:shadow-none` |
| *(fill parent)* | `min-h-full` |

### Verification

- Storybook `decision-graph--controlled`: click Edit Expression → key
  column textarea height matches expression column in both read-only and
  edit states.
- Full gates: typecheck 0 · lint clean · vitest 92/92 · static suite 55/55.

### Lessons / checklist

- **`[contenteditable]` selectors are not dead code** even when the
  component name suggests a `<textarea>`. `AutosizeTextArea` renders a
  `<div contentEditable>`, which matches `[contenteditable]` — verify the
  actual DOM output before dropping CSS rules during migration.
- **`noStyle` / `noBorder` props must be forwarded through every wrapper
  layer.** If a prop is destructured but not passed down, the "opt-out"
  silently fails and the consumer gets the default styling.
- **When removing a CSS rule during migration, grep for the selector in the
  DOM** (not just the source) to confirm no third-party component renders
  matching elements.

## 4. Map Excel Data panel: row Edit/Delete buttons dead + dialog overflows both viewport edges

**Date:** 2026-08 · **Fixed in:** working tree (`primitives/popover.tsx`, `primitives/popconfirm.tsx`, `primitives/modal.tsx`) · Registered as **GRL-STYLE-HACK[HK-14]**

### Symptom

In `decision-table--controlled`, import an Excel file so the "Map Excel
data" dialog opens. Per-row **Edit** and **Delete** icon buttons do
nothing when clicked (no popover, no confirm dialog, zero console
errors). Additionally the panel renders taller than the viewport on
small windows: its top/bottom — including the footer OK button — are
clipped out of reach.

### Investigation timeline

1. **Reproduce headlessly.** Crafted an xlsx in memory with exceljs and fed it
   through `setInputFiles`; only-read Playwright probes measured geometry and
   click outcomes at multiple viewport sizes.
2. **Isolate with control experiments.** Inside the same dialog the row
   **Switch** toggled fine via real mouse clicks and header-section
   **Add Input** opened its Popover normally — portal mounting, z-index and
   the Modal itself were healthy. Every failing control shared one trait:
   they passed a custom trigger composed as `<Tooltip>` wrapping `<Button>`,
   while every working one used a bare DOM child trigger.
3. **Event-flow probe.** A real mouse click delivered
   `pointerdown → mousedown → click` to the Edit button (verified by capture
   listeners), yet no Radix popper wrapper ever appeared; a direct DOM
   `.click()` also produced nothing — handlers were attached to something,
   just not doing anything.
4. **DOM audit of the trigger chain.** The Button carried only
   `data-slot="tooltip-trigger"`; walking up gave plain DIVs then
   `dialog-content`. No popover/trigger attributes anywhere up the chain.
5. **Sizing probe.** At 480px viewport height the dialog reported computed
   `max-height: 432px` yet measured **482px** — exactly its own `p-6`
   padding ×2, i.e. classic `content-box` behavior.

### Root cause

Two independent migration-era defects:

| Defect | Mechanism |
| --- | --- |
| Dead triggers | Radix `asChild` (`Slot`) clones its props/handlers onto its **direct child only**. Both rows wrapped their Buttons as `<TooltipTrigger asChild><Button/></Tooltip>` inside `<PopoverTrigger asChild>` / `<AlertDialogTrigger asChild>`. `Tooltip.Root` is a context provider — no DOM node, no event forwarding — so the outer Slot's cloned handler landed on nothing that could receive events. |
| Dialog overflow | Radix DialogContent is fixed-centered with no height contract. Tall content overflowed both viewport edges with no scrolling. On top of that: the fix's `maxHeight` initially *didn't bind*, because **Radix portals mount under `<body>`, outside `.grl-root`**, so the library's scoped mini-preflight (`:where(*) { box-sizing: border-box }`) never reaches portaled nodes and the shadcn template defaults back to UA `content-box` — `maxHeight` excluded the dialog's own padding (+48px). |

### Fix

- **`primitives/popover.tsx`** — always wrap children in a real DOM span:
  `<UiPopoverTrigger asChild><span class="inline-flex">{children}</span></UiPopoverTrigger>`.
  The span receives the cloned handlers; nested Tooltip keeps hover-only duty.
- **`primitives/popconfirm.tsx`** — same wrapper around
  `AlertDialogTrigger asChild` (repairs *every* Popconfirm in the library,
  not just this panel).
- **`primitives/modal.tsx`** — height contract on the dialog:
  `maxHeight: calc(100dvh - 48px)` + grid rows `[auto minmax(0,1fr)_auto]`
  with the body in a `min-h-0 overflow-y-auto` slot; footer stays outside
  the scroll area. Plus explicit `boxSizing: 'border-box'` because portals
  escape the scoped preflight.

### Verification

- Probe matrix 11/11 PASS: Add Input / input-row Edit / output-row Edit /
  Delete→AlertDialog→Remove actually deletes a row (4→3); dialogs fully
  visible at 480px and 380px viewport heights (clipT=clipB=0); body scrolls;
  OK button inside viewport at both heights; Edit still opens while
  constrained.
- Regression smoke outside the dialog: header field-pill popover (default
  trigger path) and `codeeditor--lazy-parity` single-click-to-edit +
  geometry parity all hold.
- Gates: typecheck 0 · lint clean · vitest 206/206.

### Lessons / checklist

- **`asChild` requires a real-DOM direct child.** Any context-only wrapper
  (Tooltip.Root, etc.) between the Slot and the Button silently eats
  handlers. Library shims should guarantee a DOM element themselves
  (that's what F1/F2 do) instead of trusting call sites.
- **Portaled nodes live outside `.grl-root`.** All library styling that the
  scoped preflight normally provides (box-sizing first) must be re-declared
  explicitly inside portaled primitives — or portals must target a
  container carrying `.grl-root` (roadmap §P3 makes this systemic).
- **Dialog needs a height contract, not page scroll.** Fixed-centered
  overlays clip both ends simultaneously; cap them and scroll the body.
- **Isolation ladder saves hours:** default-trigger works vs custom-trigger
  fails → composition bug; Switch works vs Select/Edit/Delete fail inside
  the same overlay → not z-index/portal-wide.
- **Probes are contaminating state too:** pressing Escape mid-test closes
  the whole Radix modal, and stale refs report `rect(0,0)` — reset scene or
  relaunch rather than reusing coordinates.

## 5. Standing checklist item → follow-ups

The table below tracks known members of the two defect families this case
introduced (see also Appendix A of `shadcn-theming-roadmap.zh-CN.md`):

| Follow-up | Where | Status |
| --- | --- | --- |
| Other portaled primitives relying on implicit border-box | `ui/dialog.tsx`, `ui/alert-dialog.tsx`, `ui/popover.tsx`, `ui/select.tsx`, `ui/tooltip.tsx` | open — batch under roadmap §P1/P3 |
| Portal targeting scope (multi-island theming) | roadmap §P3 | planned |

## 6. consumer-smoke host build fails: code-split chunk deleted by the cleanup script

**Date:** 2026-08 · **Fix location:** `scripts/clean-dist.mjs` · Not registered as GRL-STYLE-HACK (build issue)

### Symptom

`pnpm test:consumer` — Vite building the host app — died with a Rolldown
`UNRESOLVED_IMPORT`: `Could not resolve './index-DNumq_39.js'`, referencing a
dynamic-import chunk that `dist/index.js` still points at.

### Investigation

1. Re-ran consumer-smoke with its `--keep` flag and reproduced `vite build`
   directly inside the scratch host project.
2. Rolldown's error located the dynamic import at `dist/index.js:13253`.
3. `packages/jdm-editor/dist/` held exactly 8 files — no chunks at all.

### Root cause

`scripts/clean-dist.mjs` cleaned `dist/` with a **hard-coded 9-file whitelist**.
Vite lib mode code-splits the `React.lazy` story wrapper and emits a hashed
pointed chunk (`index-DNumq_39.js`); the whitelist deleted it while
`dist/index.js` kept referencing it, so the consumer host failed at build time
with UNRESOLVED_IMPORT.

### Fix

`clean-dist.mjs` now cleans by **pattern match**: it keeps everything matching
the known artifact set (`.js`/`.css`/`.map` and vite-plugin-dts output) and
removes only non-artifact `.d.ts` files. Hashed pointed chunks survive.

### Verification

- `pnpm test:consumer` — React 18 + React 19 hosts PASS
- `pnpm --filter @republicroad/jdm-editor build` — dist keeps the chunk files
- All other gates green

### Lessons / checklist

- **Never clean build output with a hard-coded file whitelist.** Bundlers
  (Vite/Rollup) may code-split (React.lazy, dynamic import) and emit hashed
  chunks; clean by artifact pattern instead.
- **Anything reachable via `import()` must be part of the release surface.**
- **`pnpm size` only checks listed files** — it cannot detect a missing chunk;
  consumer-smoke is the guard that covers this.

## 7. Consumer host build fails: `Invalid qualified rule` from lightningcss on dist/style.css

**Date:** 2026-09 · **Fix location:** `src/styles/custom-function.css` · Not a GRL-STYLE-HACK (build/tooling issue)

### Symptom

`pnpm test:consumer` (and CI Validate's consumer-smoke step) failed while
building the HOST app — the library's own `pnpm build` passed. Vite 8
(rolldown + lightningcss) reported:

```
[plugin vite:css-post]
SyntaxError: [lightningcss minify] Invalid qualified rule
...op:50%;right:3px;...}--inline__resultOverlay:is(.expression-list .expressio...
```

### Investigation

1. The failure surfaced only in the **host** build, during `vite:css-post`
   minification of the library's `dist/style.css` — the library build itself
   was green, so the usual library gates never saw it.
2. Inspected `dist/style.css` around the offset: invalid selectors like
   `__value:is(.expression-list .expression-list-item)`,
   `--inline__resultOverlay:is(...)` — bare `__value` / `__resultOverlay`
   fragments emitted as **element names**.
3. Traced them to the freshly ported `styles/custom-function.css`, which
   preserved Sass compound suffixes (`&__value`, `&__resultOverlay--inline`)
   inside a plain-CSS `@layer components` block.

### Root cause

**Sass nesting is not plain-CSS nesting.** In SCSS, `&__value` concatenates
into `.expression-list-item__value`. In plain CSS nesting (what lightningcss
implements), `&__value` parses as the parent reference followed by an
**element selector** named `__value` — producing unmatchable, invalid
qualified rules once flattened. The corrupted selectors then failed the
host's lightningcss minifier.

### Fix

Rewrote `custom-function.css` with **fully explicit class names** and
descendant-only nesting (`.expression-list-item__value { ... }` instead of
`&__value { ... }`); also deduplicated a `resultOverlayTooltip` rule that the
port had emitted twice.

### Verification

- `grep` on rebuilt `dist/style.css`: orphan `__value:is` gone;
  `expression-list-item__value .cm-content` present.
- `pnpm test:consumer` — React 18 + React 19 hosts PASS.
- Gates: 321 unit tests, eslint, compiler lint, style-debt 12/18, bundle
  budgets green.

### Lessons / checklist

- **Never carry Sass `&__suffix` compound selectors into plain CSS.** When
  porting SCSS to a CSS-nesting stylesheet, write every BEM compound name out
  in full; reserve `&` for pseudo-classes/elements and true descendant
  composition.
- **The library build is not the CSS gate — the host minifier is.** A style
  sheet can compile cleanly in the library pipeline and still be rejected by
  the host's lightningcss. consumer-smoke (which minifies through the host
  toolchain) is the detection point; keep it in CI.
- **Fast triage:** `grep '__\|__:is' dist/style.css` (or search for selectors
  starting with `_`/`-`) catches this class of corruption before shipping.
