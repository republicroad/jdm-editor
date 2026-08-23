# Migration 03 — Post-migration regression fixes

> Status: **completed**. Follow-up fixes discovered during manual Storybook review after the
> antd → shadcn/ui migration (`02-ui-stack-shadcn-reui.md`) was declared complete.
> Chinese version: [`03-post-migration-fixes.zh-CN.md`](./03-post-migration-fixes.zh-CN.md).
> Note: this `docs/` tree is gitignored; the code changes below are committed on branch `reui`.

## Fix summary

| # | Symptom | Root cause | Fix | Commit |
|---|---|---|---|---|
| 1 | Graph-node icons and components-panel icons invisible | Theme rewrite dropped `--node-color-*` CSS variables; icons are white glyphs on a colored chip that turned transparent | Re-declared the four variables in `theme.tsx` `exposedTokens` | `7dc1add` |
| 2 | Decision graph looked blank in short viewports | No `fitView`; nodes laid out below the fold of a short canvas | `<ReactFlow fitView={!initialViewport.current} fitViewOptions={{ padding: 0.15 }}>`; persisted-viewport behavior preserved | `6a9c4f0` |
| 3 | Node ⋮ menu dots horizontal instead of vertical | antd `MoreOutlined` is vertical; lucide `Ellipsis` is horizontal | `icons.tsx`: `EllipsisVertical as MoreOutlined` | `f7d1ecd` |
| 4 | Left-click on node menu did nothing (menu mounted offscreen at `(0, -148)`); two persistent ref warnings | `ui/button.tsx` was a plain function component destructuring `ref` from props — **React 18 strips `ref` from function-component props**, so Radix `asChild` triggers never received their DOM anchor and every popup fell back to origin positioning | Standard `React.forwardRef` on `ui/button.tsx` Button (plus compat-layer forwardRef in `c12408a`) | `c12408a`, `0c81356` |

## Details

### 1. Node color variables lost in theme rewrite (`7dc1add`)

`.grl-dn__header__icon` renders white glyphs over `background: var(--node-color)`. The spec layer
(`nodes/specifications/colors.ts`) maps node kinds to `var(--node-color-blue|purple|orange|green)`.
Under antd these were injected by the old theme provider; the static-palette rewrite dropped them,
so chips rendered transparent → white-on-white invisibility. Restored values:

```ts
'--node-color-blue': 'var(--grl-color-primary)',
'--node-color-purple': '#7c4dff',
'--node-color-orange': '#f76d40',
'--node-color-green': '#10ac84',
```

Lesson: when rewriting a theme provider, inventory **every CSS custom property** consumed by SCSS
(`rg '\-\-[a-z-]+' src/**/*.scss` vs what the provider emits) before deleting the old emitter.

### 2. Auto-fit graph viewport (`6a9c4f0`)

Nodes render at absolute coordinates. In a short host container (e.g. DevTools docked, window
≈340 px tall) most nodes sat outside the visible canvas — indistinguishable from "nothing
rendered". `fitView` now scales the whole graph into view on init whenever the JDM document does
not carry a persisted viewport (`defaultViewport` path unchanged).

### 3. Vertical ellipsis icon (`f7d1ecd`)

Pure semantic-drift fix in the icon mapping layer (`icons.tsx`). antd's `MoreOutlined` (⋮) mapped
to lucide `Ellipsis` (⋯); now `EllipsisVertical`. This is exactly the "icon semantic drift" risk
listed in migration 02 — caught by manual visual review.

### 4. Broken Radix popup anchoring via non-forwardRef Button (`c12408a`, `0c81356`)

Chain: `DropdownMenuTrigger asChild` → Slot clones the child with `ref` → child must be a
`forwardRef` component. Two defects stacked:

1. Compat `Button` (`primitives.tsx`) wasn't forwarding refs (`c12408a`);
2. The underlying shadcn `ui/button.tsx` accepted `ref` by destructuring it from props — valid in
   React 19, silently broken in React 18 (ref stripped, warning emitted). Result: anchor missing →
   floating-ui positioned content against a virtual origin → menus/popovers/tooltips mounted at
   `(0,-148)` etc., i.e. invisible despite working open/close logic.

Fix converts `ui/button.tsx` to standard `React.forwardRef<HTMLButtonElement, Props>` with
`displayName`. This repairs anchoring for **every** popup-style interaction built on Button and
eliminates both lingering console warnings.

## Debugging lessons (methodology)

1. **Presence ≠ visible.** Verify popups with `getBoundingClientRect()` intersected with the
   viewport, never just `querySelector` existence. The menu "worked" in DOM checks while being
   permanently offscreen.
2. **Radix opens menus on `pointerdown`.** Probes that dispatch only synthetic `click` events give
   false negatives — drive real input through Playwright's input pipeline.
3. **Storybook manager nests the story in an iframe.** Console snippets run against whichever frame
   is selected; test both the manager page and the direct `/iframe.html?id=...&viewMode=story`
   URL to remove variables.
4. **React Flow warnings #002/#004** can be transient mount noise or genuine zero-size containers —
   confirm `.react-flow` dimensions before chasing them.
5. **React 18 rule:** function components cannot receive `ref` via props. Any shadcn-style
   component used as a Radix `asChild` child **must** be wrapped in `forwardRef`.
