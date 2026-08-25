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
