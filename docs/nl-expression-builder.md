# Natural-Language Rule Editing (Business View)

> How decision-table cells render typed, human-readable controls ("field + operator + value")
> instead of raw expression text, and how that stays a pure projection of the stored
> expression string. Verified against this fork (branch `main`); source anchors included.

## 1. Mental model

The business view has **no state of its own**. Every condition/output cell holds a
zen-expression string; `ExpressionBuilder` (unary conditions) and
`StandardExpressionBuilder` (output values) parse that string into structured data via
WASM, render typed controls from it, and serialize user edits back to the same string.
Business and dev (CodeMirror) views edit one source of truth and cannot drift.

## 2. Quick start

```bash
npm i @republicroad/jdm-editor
```

```tsx
import '@republicroad/jdm-editor/dist/style.css';
import { DecisionTable, JdmConfigProvider } from '@republicroad/jdm-editor';

<JdmConfigProvider
  dictionaries={{ tierDict: [{ label: '金牌会员', value: 'GOLD' }] }}
>
  <DecisionTable value={table} onChange={setTable} mode="business" tableHeight={400} />
</JdmConfigProvider>
```

- `mode="business"` turns on natural-language cells (`DecisionTableEmptyType.mode`,
  `src/components/decision-table/dt-empty.tsx`). Default is `mode="dev"` (CodeMirror).
- `dictionaries` may be passed per component or via `JdmConfigProvider` (prop wins).
- `fieldType` on input columns (and `outputFieldType` on output columns) selects the
  rendered control; without WASM the table falls back to dev cells until it loads.

## 3. Column type schemas (`src/helpers/schema.ts`)

```ts
columnEnumSchema     = { type: 'inline', values: {label,value}[], loose?: boolean }
                     | { type: 'ref', ref: string, loose?: boolean }

columnFieldTypeSchema = { type: 'any' }
                      | { type: 'string', enum?: columnEnumSchema }
                      | { type: 'number' } | { type: 'boolean' } | { type: 'date' }

outputFieldTypeSchema = { type: 'auto' }
                      | { type: 'string', enum? } | { type: 'string-array', enum? }
                      | { type: 'number' } | { type: 'boolean' } | { type: 'date' }
```

Only `string`/`string-array` columns accept `enum`. Enum editing UI (inline rows in the
`label;value` format, or dictionary refs) lives in
`src/components/decision-table/components/enum-utils.ts` / `input-field-edit.tsx`.

## 4. What each cell renders (business mode)

| Cell | Control |
|---|---|
| string + enum | operator icon + label dropdown (`label` shown, `value` stored; `loose` allows free text) |
| number | operator dropdown (equals/greater than/between…) + number input; `between` → `[a .. b]` interval with bracket toggles for open/closed ends |
| date | date picker + granularity (exact/week/month/quarter/year); `dayOfWeekIn` → Mon–Sun chips, `quarterIn` → Q1–Q4 chips |
| output | typed value input ⇄ expression mode toggle (CodeMirror); string outputs with enum render a dropdown |
| any cell | operator panel bottom "custom" tile = developer expression mode; expressions too complex to structure force custom automatically |

## 5. Operator → stored expression (canonical forms)

What the user clicks is projected from — and serialized back to — these strings
(verified against `@gorules/zen-engine-wasm` 0.23.1, see
`src/helpers/wasm-roundtrip.test.ts`):

| Operator (structured `type`) | Serialized unary expression |
|---|---|
| `eq` / literal | `"GOLD"`, `99`, `true` (bare value ⇒ `$ == value`) |
| `gt/gte/lt/lte` | `>= 1000`, `< 200000` |
| `between` | `[200000..1000000]`, `(1..5]`, `[1..10)` (brackets = inclusivity) |
| `in` (list) | `["a", "b"]` or `"INC","LTD","LLC"` (comma OR) |
| `notIn` | `not in [1, 2]` |
| `null` / `notNull` | `== null` / `!= null` |
| `contains` | `contains($, "ship")` |
| `startsWith` / `endsWith` | `startsWith($, "ORD-")` / `endsWith($, "-EU")` |
| `dateAfter` | `d($).isAfter("2024-01-15")` |
| `dayOfWeekIn` | `d($).weekday() in [1, 5]` |
| `quarterIn` | `d($).quarter() in [1, 4]` |
| `timeGt` | `d($).hour() * 60 + d($).minute() > 9 * 60 + 30` |
| anything unstructurable | kept verbatim, `kind: 'complex'` (custom mode) |

All forms above are engine-compatible zen unary expressions (`d($).weekday()` maps to
zen's `DateMethod`). Anything starting with `contains "x"` (no `($, …)`) is **not**
canonical and will be treated as a complex/custom expression.

## 6. WASM runtime contract

`src/helpers/wasm.ts` is the single entry point:

- Dependency: `@gorules/zen-engine-wasm`, **pinned** (`0.23.1`, no caret). Upgrades are
  a deliberate act: bump, run `pnpm test`, and reconcile any
  `src/helpers/__snapshots__/wasm-roundtrip.test.ts.snap` drift before shipping.
- Loading: `initWasm({ module_or_path })` with a URL resolved against
  `document.baseURI` as `zen-engine-wasm/zen_engine_wasm_bg.wasm`. Hosts must serve the
  package's `dist/*.wasm` at that path (root or sub-path both work because of the
  explicit baseURI resolution). The docs/storybook build vendors the artifact under
  `packages/jdm-editor/docs/zen-engine-wasm/`.
- Readiness: `useWasmReady()` / `isWasmAvailable()` gate business mode; cells render in
  dev form until WASM is ready (no blank cells, no partial hydration).
- Tests: `src/helpers/wasm-roundtrip.test.ts` loads the exact installed binary via
  `initSync` and asserts parse→serialize convergence, idempotent serialization,
  canonical-form identity, and validator agreement.

## 7. Engine compatibility caveat

`fieldType`/`outputFieldType` are **editor-layer** rich types. The engine-side JDM table
column is still a plain string type. When a model edited here is executed by a zen
engine, verify round-trip behavior against that engine version (this org's fork:
`zen` repo, `core/expression` unary grammar) before production use.

## 8. Source anchors

- Builder UI: `src/components/code-editor/business/expression-builder/`
  (`constants.ts` operator catalog, `value-inputs.tsx` typed controls)
- Output builder: `business/standard-expression-builder.tsx`
- Store wiring / kind inference: `business/expression-builder/use-expression-state.ts`
- Cell dispatch (dev ⇄ business + WASM gate): `decision-table/table/table-default-cell.tsx`
- Public props: `decision-table/dt-empty.tsx` (`DecisionTableEmptyType`)
- Dictionaries context: `src/theme.tsx` (`JdmConfigProvider`, `useDictionaries`)
