# Host Migration Guide — `@gorules/jdm-editor` → `@republicroad/jdm-editor`

> This fork has diverged significantly from upstream (`ReactFlow 12`, `shadcn/ui
> + ReUI`, seed-derived theming, scoped injection, pooled editors) and will not
> track upstream merges. Publish as `@republicroad/jdm-editor` starting at `0.1.0`
> (pre-1.0, API may change — semver 0.x convention).

## Quick Switch

```diff
- npm i @gorules/jdm-editor
+ npm i @republicroad/jdm-editor
```

```diff
- import '@gorules/jdm-editor/dist/style.css';
- import { DecisionGraph, JdmConfigProvider } from '@gorules/jdm-editor';
+ import '@republicroad/jdm-editor/dist/style.css';
+ import { DecisionGraph, JdmConfigProvider } from '@republicroad/jdm-editor';
```

## What Changed (breaking)

| Change | Impact | Migration |
|---|---|---|
| Scoped injection (P3) | Variables resolve from the island, not `:root` | Ensure your app wraps content in `.grl-root` (already required for preflight). If you consume `var(--background)` etc. **outside** the island, see below |
| Semantic bridge scoped | `var(--background)` etc. only resolve inside `.grl-root` | Wrap consumer content in `.grl-root`, or copy the bridge variables to your own `:root` |
| Pooled display path (A2) | Lazy code editors use a read-only EditorView pool by default | Opt-out: `localStorage.gru-hl-view = '0'` (grayscale escape hatch) |
| `--grl-primary-color(-bg)` removed | Duplicates of `--grl-color-primary(-bg)` | Use `--grl-color-primary(-bg)` |

## What's New

- **One-click retheming**: `<JdmConfigProvider seeds={{ primary: '#7c3aed' }}>` derives both light and dark palettes
- **Multi-island**: multiple `.grl-root` islands on one page, each independently themed
- **Dark custom-variant isolation**: a light island won't be affected by a host page's dark scope
- **Seeds Playground**: Storybook story for interactive palette visualisation

## `--grl-*` Variable Contract

All `--grl-*` variables are injected inline on the `.grl-root` container. The
following are **contract-stable** (not changing in the 1.x lifecycle):

All `--grl-color-*` palette tokens, `--grl-font-family`, `--grl-line-height`,
`--grl-border-radius`, `--grl-control-outline`, `--node-color-*`.

Previously-host-facing-only keys (`--grl-primary-color(-bg)`,
`--grl-color-primary-text-hover`, `--grl-color-info-text`, `--grl-color-bg-mask`)
are removed in 1.0.0 — see [`grl-var-flatten.md`](./grl-var-flatten.md) for the
migration checklist.

## Antd Type Aliases

All `Antd*` exported types (e.g. `AntdButtonProps`) carry `@deprecated` JSDoc
pointing to neutral names (e.g. `ButtonProps`). They still work but will be
removed in a future major.

## What's New in 0.2.x

### New public exports

```ts
import {
  // Request (input) node tab surface
  TabRequest, type TabRequestProps,
  // request-schema helpers (definitions, example sources, normalization)
  getRequestDefinitions, getRequestExampleSources, getRequestSchemaSourceValue,
  stringifyRequestSchemaValue, resolveRequestSchemaValue,
  buildRequestSchemaFromDefinitions, buildRequestExampleTemplateFromDefinitions,
  updateRequestSchemaExamples, normalizeRequestDefinitionOrders,
  normalizeRequestFieldKey, normalizeRequestJsonKeys,
  type RequestDefinition, type RequestDefinitionType, type RequestExampleSource,
  // simulator auto-sync
  useSimulatorAutoSync, AUTO_SYNC_DEBOUNCE_MS, type UseSimulatorAutoSyncParams,
  // custom function surface
  CustomFunctionTable, type TabCustomFunctionProps,
  // json schema helper
  jsonSchemaToVariableType,
} from '@republicroad/jdm-editor';
```

### New `DecisionGraph` props

```tsx
<DecisionGraph
  value={graph}
  // resolve the current user for user-aware custom node tabs
  userResolver={async () => ({ user: currentUser.id })}
  // function signatures available to custom nodes' "function" expression mode
  customFunctions={myFunctionSignatures}
/>
```

- `userResolver`: `() => Promise<{ user?: string } | null>` — resolved once per
  mount; failures fall back to `''` (warned in console).
- `customFunctions`: signature list consumed by `CustomFunctionTable`'s
  function mode and forwarded to custom node `renderTab` calls.

### Custom node authoring

`createJdmNode` specifications may now provide `renderTab` receiving
`{ id, user?, customFunctions? }`, and custom nodes carrying
`content.kind` route their tab through the matching `customNodes` spec.

### Request (input) node tab

The input node opens a three-view tab: **Definitions / Data / Schema**
(`TabRequest`). Node content now carries `{ schema, expressions[], inputField,
outputPath }`; graphs loaded with legacy `;;`-joined values keep working.

### i18n increments

New namespaces since 0.1: `request.*`, `simulator.*`, `cf.*`, plus the
existing `dt.*`/`dg.*`/`expression.*`/`func.*`. See
[`i18n.md`](./i18n.md) for the fallback chain and `theming/messages/en.ts`
for the full catalog.

### Upcoming in 0.3.0 (heads-up)

- `monaco-editor` moves to `peerDependencies` — hosts add it explicitly
  (`npm i monaco-editor`), installs slim down by ~5 MB.
- See [`roadmap-0.3.0.md`](./roadmap-0.3.0.md) for the draft plan.
