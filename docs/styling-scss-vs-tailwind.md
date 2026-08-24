# Styling: SCSS vs Tailwind — Comparison & Decision Guide

> English is canonical; [`styling-scss-vs-tailwind.zh-CN.md`](./styling-scss-vs-tailwind.zh-CN.md) is the
> synced translation.
> This doc explains why the fork is migrating component styling from hand-written SCSS to Tailwind
> utilities, what genuinely cannot be expressed as a Tailwind *utility*, and (for completeness) the
> cases where SCSS remains the right tool.

## 1. Context

The fork vendors **two parallel styling systems**:

- A global `src/styles/tailwind.css` (Tailwind v4 via `@tailwindcss/vite`), plus `tokens.css` which
  bridges the live antd-derived runtime tokens (`--grl-*`) to generic names (`--border`, `--primary`,
  …). All shadcn/ui and ReUI components are styled with Tailwind utilities.
- ~2 700 lines of hand-written SCSS (`dg.scss`, `dt.scss`, `ce.scss`, `expression.scss`,
  `function.scss`, `_builder-base.scss` + builders, `decision-node.scss`, `styles.scss`), compiled by
  the `sass` devDependency.

Both are imported in `src/index.ts` and ship in `dist/style.css`. The goal is to collapse the SCSS
layer into **Tailwind utilities where possible + a thin plain-CSS layer where not**, and eventually
drop the `sass` dependency without losing styling capability.

## 2. What a "utility class" is

Tailwind takes a **single CSS property per class name** and lets you compose them in `className`:

```tsx
// equivalent to: .box { display:flex; align-items:center; gap:8px; padding:8px; }
<div className="flex items-center gap-2 p-2">…</div>
```

Tailwind is **build-time**: it scans the source for literal `className="…"` strings and only emits CSS
for the classes it finds (`@tailwindcss/vite` + `@source '../'` in `tailwind.css`). It supports
variants (`hover:`, `dark:`, `focus-within:`, `data-[state=open]:`, `not-last:`), pseudo-elements
(`after:content-['']`), and arbitrary values `bg-[#ff0000]` / `text-[var(--x)]` / `[top:calc(50% - 1px)]`.

## 3. Comparison

| Dimension | SCSS (preprocessor) | Tailwind (utility-first) |
|---|---|---|
| **Authoring** | Separate `.scss` files, nesting + `&` + module system (`@use`/`@include`) | Classes in JSX; `@theme`, `@layer`, `@custom-variant` in CSS |
| **Build** | Runtime compile by `sass`; ships all 2 700 lines | Build-time scan; emits only used classes (smaller CSS) |
| **Reuse** | `@mixin` / `@include` shared partials | Duplicate utility string, or a shared React component |
| **Variables** | `$vars` + `sass math` (compile-time) | CSS custom properties (`--*`), `@theme inline` |
| **Runtime data-driven values** | Not a concern — you already use inline `style` / CSS vars | Same: use inline `style` or CSS vars; **never** build a class name at runtime |
| **Nested / pseudo states** | `&:hover`, `&::after`, `&:not(:last-child)` | `hover:`, `after:`, `not-last:`, `focus-within:` |
| **Deep selectors into 3rd-party DOM** | Easy, readable nesting | Possible via `[&_li>div+label+span]:hidden` but unmaintainable |
| **Computed token chains** | `$h: calc($fs * $lh + …)` once, reuse | Needs a CSS custom property (`--b-h`) held on the element |

## 4. What CANNOT be a Tailwind utility (but can be plain CSS)

The real boundary is **utility vs plain CSS**, **not SCSS vs Tailwind**. Three cases fall on the
plain-CSS side and never need Sass:

1. **Third-party DOM hooks.** Monaco line decorations apply a class *name* to DOM Monaco creates
   (`function.tsx` passes `className: 'grl-function__errorLineContent'` to
   `createDecorationsCollection`). A utility cannot be attached — a real CSS rule keyed by that class
   is required. Same for `react-json-tree` internals in `function-debugger-log.tsx`
   (`li > div + label + span`, `.log__values > ul:first-of-type > li:first-of-type`).

2. **Dynamically computed token values.** `_builder-base.scss` derives `--b-height`/`--b-max-height`
   with `calc(var(--b-font-size) * var(--b-line-height) + …)`. Tailwind utilities are statically
   generated; the computed value is carried instead by a CSS custom property on the element.

3. **Dynamic SVG data-URIs from function arguments.** See §6.

These live as a small **plain-CSS layer** (e.g. a "third-party DOM hooks" section in `tailwind.css`),
not as SCSS.

## 5. Runtime, data-driven coloring (nodes / edges / API)

"Node type decides edge color" and "color from an API return value" are **JS-computed at runtime**,
so they belong in **inline `style` or CSS variables** — independent of SCSS/Tailwind and always
available:

```tsx
// Edge color derived from a diff/status at runtime (custom-edge.tsx does exactly this)
<BaseEdge style={{
  ...(style || {}),
  stroke: match(diff)
    .with({ status: 'added' }, () => 'var(--grl-color-success)')
    .with({ status: 'removed' }, () => 'var(--grl-color-error)')
    .otherwise(() => undefined),
}} />

// Node color from data
<Node style={{ borderColor: nodeTypeColor(node.type) }} />
```

- **One dynamic-off value** → inline `style`.
- **A small enumerated palette** → literal class names backed by CSS variables, e.g.
  `className="fill-[var(--node-color-purple)]"` with the var flipped at runtime (the fork already
  exposes `--node-color-*` in `theme.tsx`).
- **Never** interpolate a class at runtime (`text-[${color}]`) — those classes are never scanned, so
  they don't exist in generated CSS.

None of this requires reintroducing SCSS.

## 6. The one genuinely SCSS-specific construct

`ce.scss` defines a `@function lintRangeImage($color, $stroke-width)` that returns an inline SVG
`data:image/svg+xml,…` with its color and stroke-width interpolated from the arguments. Tailwind
cannot generate a string from arguments — but this needs **plain CSS / a data-URI string**, not Sass.
It is eliminated either by precomputing the URI as a static value (or a tiny JS helper), so `sass` can
still be removed.

## 7. SCSS applicable scenarios (when it is still the right tool)

Being balanced: even in a Tailwind codebase, a few cases genuinely favour a preprocessor. Use SCSS
when you need **compile-time** computation or reuse that utilities can't describe cleanly:

1. **Value-producing `@function`s** — e.g. `lintRangeImage($color, $w)` building a data-URI from
   arguments. This is the clearest SCSS-only win (until you settle on a fixed URI).
2. **Deep styling of third-party DOM you don't own**, with complex combinators
   (`li > div + label + span`). SCSS nesting keeps it readable; the Tailwind arbitrary-variant
   equivalent (`[&_li>div+label+span]:hidden`) is hard to read and maintain.
3. **Build-time mixins reused across several components**, when you'd otherwise duplicate a long
   utility string in multiple TSX files and a shared React component isn't warranted.
4. **Computed token chains / layout math** that derive multiple values from a few base tokens
   (`--b-height`, `--b-max-height`), especially when those values feed several rules.
5. **Loops / conditional generation** (`@each`, `@for`, `@if`) producing many variants — e.g.
   generating a strip of shade classes at build time.
6. **Theme token system without Tailwind `@theme`** — if you keep a token layer in `$vars` and rely on
   `sass math` for contrast/lightness adjustments.

**Caveat:** most "SCSS needs" in items 2–4 are actually satisfiable with **plain CSS** (nesting,
`@custom-variant`, CSS custom properties) now that native CSS nesting is mainstream. Use a
preprocessor only where you need **values computed at compile time from function/mixin arguments**
(items 1, 5, 6) — otherwise prefer utilities + a thin plain-CSS layer.

## 8. Recommended target for this fork

- **Where possible** → Tailwind utilities (layout, spacing, states, colours).
- **Third-party DOM hooks + token arithmetic + data-URIs** → a small plain-CSS layer (in
  `src/styles/tailwind.css` or a co-located `.css`), never SCSS.
- **Runtime data-driven values** → inline `style` / CSS variables.
- **Migration order** → smallest, self-contained SCSS `function.scss` first (utilities + a couple of
  plain-CSS hooks), then the intertwined builder module trio (which shares `_builder-base.scss`),
  then the large `dg.scss`/`ce.scss`/`dt.scss` batch, deleting each `.scss` as it converts.
- **End state** → no `sass` dependency, one styling paradigm, no loss of styling capability.
