# Migration 04 — React 18 → 19 (+ zustand 5)

> Status: **completed** (2026-08). Runtime upgraded on the `reui` branch; library peer
> dependencies intentionally unchanged. Chinese version: [`04-react-19.zh-CN.md`](./04-react-19.zh-CN.md).
> Follows [`03-post-migration-fixes.md`](./03-post-migration-fixes.md).

## Decisions

| Topic | Decision |
|---|---|
| Target | React `19.2.8` + `@types/react` `^19.2.18` (latest stable at time of upgrade) |
| Library peers | **Keep `"react": ">= 18"`** — dist is compiled, no 19-only APIs used; verified on both runtimes |
| Component style | Keep `forwardRef` / React-18-compatible patterns everywhere (required while peers include 18) |
| zustand | `^4.5.5` → `^5.0.15`; deprecated `store(selector, equalityFn)` calls migrated to `useStoreWithEqualityFn` (`zustand/traditional`) |
| react-dnd | Kept at `16.0.1`. Project dormant (last release 2022-06, peer `^18`) but runtime-compatible with 19; peer warnings accepted. Replacement with `@dnd-kit/core` deferred to a future migration |

## Version changes

| Package | Before | After |
|---|---|---|
| react / react-dom (dev) | 18.3.1 | 19.2.8 |
| @types/react | 18.3.11 (pinned) | ^19.2.18 |
| zustand | ^4.5.5 | ^5.0.15 |
| react-dnd | 16.0.1 | unchanged (peer warning tolerated) |

Note: `@types/react-dom` was already `^19.x` before this migration (pre-existing mix).

## Code adaptations

1. **zustand v5 removed the `(selector, equals)` call overload** — six hook call sites
   (`dg-store.context`, `dt-store.context`, `expression-store.context`) migrated to
   `useStoreWithEqualityFn(store, selector, equals)`.
2. **Strict getSnapshot caching**: `expression-command-bar.tsx` subscribed via an object-literal
   selector directly on the raw store → "Maximum update depth exceeded" under React 19. Split into
   two primitive-value selectors.
3. **Global `JSX` namespace removed** in React 19 types — `dt-empty.tsx` now uses
   `import type { JSX } from 'react'`.
4. **`React.VFC` removed** — `spaced-text.tsx` switched to `React.FC`.
5. **`React.FC` return type now includes `Promise`** — `dg-store.context` panel type changed from
   `renderPanel?: React.FC` to `renderPanel?: () => React.ReactNode`; call site drops its argument.
6. **Ref callbacks must not return values** (@types/react 19): react-dnd's `ConnectDragSource`
   no longer directly assignable to `ref` — wrapped in brace-bodied callbacks
   (`table-row.tsx`, `expression-item.tsx`).

## Verification gates (all green)

- `tsc --noEmit`, vitest 37/37, storybook production build, test-storybook **55/55**
- Node ⋮ menu anchoring probe: content renders below trigger, visible in viewport
- Drag regression via native DataTransfer event sequences: decision-table row drag shows direction
  indicator; expression item drag shows dropping indicator; zero page errors
- Console: zero runtime errors across graph/table/expression stories (the pre-existing zustand
  `create` deprecation warning is gone with v5)
- **Dual-host smoke**: minimal Vite hosts consuming the built package via `pnpm add file:` on
  **react 18.3.1** and **react 19.2.8** — both mount DecisionGraph and render identically, zero
  console errors; `tsc --noEmit` against `@types/react@18.3.11` (skipLibCheck, standard consumer
  setup) passes

## Known leftovers

- Peer warnings during install (benign, non-blocking):
  `use-sync-external-store` / `transition-hook` declare old react ranges; a `zod` range mismatch in
  `@hookform/resolvers` **predates this migration**.
- Storybook docgen logs `UnknownArgTypesError` for `ExpressionStore['debug']` (dev-time argTypes
  inference only, no runtime impact).
- react-dnd remains a maintenance-mode dependency — replacement tracked as a future migration.

## Lessons

1. **Restart the Storybook dev server after swapping React versions**: Vite's dependency optimizer
   re-bundles on first request; running test-runner suites inside that window yields blanket
   `page.goto` timeouts that look like test failures.
2. zustand v5's removal of the equality-fn store-call overload is exactly what the v4 console
   DEPRECATED message pointed to — migrating to `zustand/traditional` resolves both.
3. React 19 types turn several previously-silent patterns into hard errors (async-capable FC
   returns, ref-callback returns, global JSX namespace); expect a small, mechanical TS tail rather
   than runtime surprises when the codebase already avoids `findDOMNode`/string refs/defaultProps.
