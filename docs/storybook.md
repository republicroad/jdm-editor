# Storybook Guide

> How Storybook is configured, run, tested, and extended in this monorepo.
> English canonical; `.zh-CN.md` files are synced translations.
> 中文对照:[`storybook.zh-CN.md`](./storybook.zh-CN.md)。

## Quick Start

```bash
# Dev server (foreground, Ctrl+C to stop)
corepack pnpm@10 --filter @republicroad/jdm-editor storybook
# → http://localhost:9009

# Build static site
corepack pnpm@10 --filter @republicroad/jdm-editor build:storybook

# Build + serve + run all interaction tests (CI-grade)
corepack pnpm@10 --filter @republicroad/jdm-editor test:storybook
```

## Configuration

### `.storybook/main.ts`

| Setting | Value | Notes |
|---|---|---|
| `stories` | `../src/**/*.stories.tsx` | Auto-discovers all story files under `src/` |
| addons | links, dark-mode, docs, mcp | No a11y addon currently |
| `staticDirs` | `zen-engine-wasm/dist → /zen-engine-wasm` | WASM binary served at a stable path for `preview.tsx` |
| framework | `@storybook/react-vite` (strictMode) | Vite bundler |
| `viteFinal` | Tailwind CSS v4 plugin + `@/` alias | Ensures Tailwind compiles for Storybook the same way as the library build |

### `.storybook/preview.tsx`

The global decorator implements the **canonical host shape**: `.grl-root` wraps
`JdmConfigProvider`, which wraps the story. This means:

- Every story exercises the **scoped injection path** (P3) — variables are set
  as inline properties on the island container, `data-mode` lives there.
- All Radix portals mount **inside** the island (via `GrlContainerProvider`).
- Dark mode toggling via `storybook-dark-mode` flips the provider's `mode`,
  which cascades through the `--grl-*` → semantic variable chain.
- The decorator injects a `<style>` to set `html` background color (matching
  mode) and pin `body`/`#storybook-root` to `height: 100vh/100%` — required by
  the virtualized table and full-height code editors (see
  [`storybook-height-chain.md`](./storybook-height-chain.md)).

### `.storybook/preview-head.html`

Sets `#root { padding: 20px }` for visual breathing room.

### `.storybook/manager-head.html`

Sets the manager tab title to "JDM Editor" and a favicon.

## Story Inventory (57 stories / 9 files)

| File | Stories | Notable |
|---|---|---|
| `components/code-editor/ce.stories.tsx` | Uncontrolled, Controlled, FullHeight, NoStyle, **LazyParity**, Debug, LivePreview | **LazyParity** is the geometry regression guard: single-click edit + display↔edit first-line box parity (dX/dY ≤ 0.5px, padding equal) |
| `components/decision-table/dt.stories.tsx` | Controlled, Uncontrolled, CustomRenderer, StressTest, BusinessMode, BusinessModeDictionaries | **StressTest** renders 10k rules; uses `tableHeight='90vh'` to bound virtualizer window |
| `components/decision-graph/dg.stories.tsx` | Controlled, Uncontrolled, Disabled, Extended, CustomNode, InputFormCustomNode, UnknownCustomNode, **Simulator**, Diff, View, Serialize, BusinessMode | Most feature-rich component |
| `components/expression/expression.stories.tsx` | Uncontrolled, Controlled | |
| `components/function/function.stories.tsx` | Uncontrolled, Controlled, WithError | |
| `components/code-editor/business/expression-builder.stories.tsx` | 15 stories (auto-type, string-type, number-type, boolean-type, date-type, enum-type, dictionary-enum, …) | |
| `components/code-editor/business/standard-expression-builder.stories.tsx` | (1 story) | |
| `components/theming.stories.tsx` | **SeedsPlayground** | Interactive seed→derived-token visualiser with copy-to-clipboard `--grl-*` JSON |
| `components/isolation.stories.tsx` | **Isolation** | Dual-island isolation harness (Batch S4): light-default vs dark-violet islands side-by-side, host-style probe outside |

### Story ID Reference

Story IDs are derived from the file path and export name (kebab-cased):

| Story file | ID prefix | Example |
|---|---|---|
| `ce.stories.tsx` | `codeeditor--` | `codeeditor--lazy-parity` |
| `dt.stories.tsx` | `decision-table--` | `decision-table--controlled` |
| `dg.stories.tsx` | `decision-graph--` | `decision-graph--controlled` |
| `expression.stories.tsx` | `expression--` | `expression--uncontrolled` |
| `function.stories.tsx` | `function--` | `function--uncontrolled` |
| `expression-builder.stories.tsx` | `expressionbuilder--` | `expressionbuilder--boolean-type` |
| `standard-expression-builder.stories.tsx` | `standard-expression-builder--` | |
| `theming.stories.tsx` | `theming--` | `theming--seeds-playground` |
| `isolation.stories.tsx` | `theming-isolation--` | `theming-isolation--isolation` |

## Interaction Tests (`test:storybook`)

```bash
pnpm --filter @republicroad/jdm-editor test:storybook
```

This is a three-stage pipeline run via `concurrently`:

1. **SB**: `storybook build -o docs --quiet` → static build into `docs/`
2. **Serve**: `http-server docs -p 9009 --silent` (requires port 9009 to be free)
3. **TST**: `wait-on tcp:127.0.0.1:9009 && test-storybook --url http://127.0.0.1:9009`

Every story with a `play()` function is executed in headless Chromium.

### play() Functions

| Story | Assertions |
|---|---|
| `LazyParity` | Single click enters edit; display↔edit content/line boxes dX/dY ≤ 0.5px; padding identical; deterministic display-state bootstrap (blur when autofocus steals it) |

### Known Gotchas

- **Port conflict**: stop any dev server on 9009 before running `test:storybook`.
- **First-paint autofocus**: Storybook dev canvas may autofocus a story tab,
  flipping lazy editors to edit mode before `play()` runs. The LazyParity
  bootstrap handles this via `document.activeElement.blur()`.
- **jsdom vs real browser**: `test:storybook` runs in real Chromium, while
  `pnpm test` uses jsdom. Radix Select needs pointer-capture polyfills in
  jsdom but not in Chromium — see `primitives-keyboard.test.tsx` for the
  jsdom shim.

## Height Chain

Percentage-height chains (`height: 100%`) silently fail inside the Storybook
iframe unless every ancestor has an explicit height. The decorator pins
`#storybook-root { height: 100% }` and the StressTest story uses `90vh`.
Full investigation: [`storybook-height-chain.md`](./storybook-height-chain.md).

## Scoped Injection (.grl-root) in Stories

The decorator's `.grl-root` wrapper makes every story exercise the **scoped
injection path** (P3): `--grl-*` variables are set as inline properties on the
island container, `data-mode` lives there, and Radix portals target the island
via `GrlContainerProvider`.

**Multi-island testing**: to verify island isolation, render your own
`.grl-root` + `JdmConfigProvider` inside a story (as `Isolation` does). The
innermost `.grl-root` wins for scope resolution. Do NOT nest providers without
their own `.grl-root` wrapper — that would cause the inner provider to resolve
the outer island as its container.

## Dark Mode

`storybook-dark-mode` addon provides a toolbar toggle. The decorator reads it
via `useDarkMode()` and passes `mode` to `JdmConfigProvider`. Dark mode flips
`[data-mode]` on the island container, which cascades through the semantic
variable bridge (`tokens.css`).
