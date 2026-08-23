# Migration 02 — UI stack: antd 5 → Tailwind CSS + shadcn/ui + ReUI

> Status: **completed** — antd fully removed (see git history for the staged commits). Chinese version: [`02-ui-stack-shadcn-reui.zh-CN.md`](./02-ui-stack-shadcn-reui.zh-CN.md).
> Post-completion regressions and their fixes are recorded in [`03-post-migration-fixes.md`](./03-post-migration-fixes.md).
> This is a staged rewrite of the presentation layer. Logic (stores, WASM layer, grammars) is untouched.

## Decisions (confirmed)

| Topic | Decision |
|---|---|
| Motivation | Internal long-term fork; permanent divergence from upstream accepted |
| Toast / Dialog | ReUI patterns — `sonner` toaster + shadcn/ReUI dialog & alert-dialog |
| Icons | ReUI Icons first (`REUI_LICENSE_KEY`, Ultimate) behind a unified export layer `src/components/ui/icons.tsx`; lucide-react as fallback; business code never imports an icon lib directly |
| Styling | Tailwind CSS v4 compiled into `dist/style.css` with **prefix** and **preflight disabled** (library-safe) |
| Theming | Rewrite `JdmConfigProvider` to emit shadcn-style tokens; keep `--grl-*` aliases as a bridge during transition |
| Distribution | Keep compiled-npm-package model (not a source registry); ship precompiled Tailwind output in `dist/style.css` |

## Current-state metrics (measured at baseline `283bb11`)

- antd imports in **58 files**, ~30 distinct components. Top usage: Typography ×31, Button ×28,
  Tooltip ×13, theme tokens ×13, Select ×10, Dropdown ×7, message ×7, Input/Checkbox/Space/Spin ×6,
  Form/Modal/Tabs/App ×4, Popconfirm ×3, plus DatePicker/Card/Switch/Radio/Popover/Steps/Tag/Avatar/
  InputNumber/TimePicker/notification/ConfigProvider.
- `@ant-design/icons` in **27 files** (lucide-react already co-exists in 11 files).
- 10 SCSS files consume only `--grl-*` variables (theming already token-decoupled).

## Stage plan

### Stage A — Foundation

1. Install Tailwind v4 (`@tailwindcss/vite`) with build config:
   - `prefix: 'grl-'` on all utilities, `preflight: false`;
   - content scan limited to `src/**`; output merged into `dist/style.css`.
2. Token bridge: extend `theme.tsx` to map a single internal palette into both
   - shadcn variables (`--background`, `--foreground`, `--primary`, `--border`, `--radius`, …), and
   - legacy `--grl-*` aliases (existing SCSS keeps working unchanged);
   dark mode via `.dark` class or `[data-mode='dark']` instead of antd algorithms.
3. Acceptance: visual parity snapshot of all Storybook stories; zero antd removal yet.

### Stage B — Component layer (`src/components/ui/`)

1. Scaffold via shadcn CLI + ReUI registry (`components.json` → `@reui`):
   button, input, select, dialog, alert-dialog, dropdown-menu, tooltip, popover, tabs, checkbox,
   radio-group, switch, form (react-hook-form + zod), sonner (toaster), table primitives.
2. `icons.tsx`: named icon exports resolved internally to ReUI Icons (license-gated) with lucide fallback;
   codemod `@ant-design/icons` imports (27 files) to this module.
3. Replace imperative antd APIs:
   - `message.*` → sonner `toast`;
   - `notification.*` → sonner rich toasts;
   - `App.useApp().modal.confirm` → `ConfirmDialog` component built on alert-dialog.
4. Acceptance: `shared/` fully off antd; graph/table still render via antd where untouched.

### Stage C — Module migration (order fixed)

1. `shared/` → done in Stage B.
2. `decision-graph`: aside menu, node cards, settings tabs, dialogs, simulator panels.
3. `expression` / `code-editor/business`: expression builder forms (react-hook-form + zod),
   date/time pickers → shadcn calendar/popover pattern (or ReUI date-selector).
4. `decision-table`: restyle chrome (command bar, context menu, dialogs, headers) with Tailwind+shadcn.
   **Core spreadsheet grid stays TanStack-based custom code** — ReUI data-grid does not model
   hit-policy matrices/expression cells; it may be evaluated only for auxiliary panels (e.g., schema list).
5. Acceptance per module: typecheck/build gates + Storybook visual review + manual smoke
   (features doc §1–§4 lists).

### Stage D — Cleanup

1. Remove `antd`, `@ant-design/icons`, `dayjs`(antd-specific use) from dependencies; delete dead SCSS.
2. Decide fate of remaining SCSS (progressive Tailwind conversion allowed to stop at hybrid).
3. CI: add test job (currently missing) before declaring migration complete.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| Utility classes leak into host apps | prefix + no-preflight; e2e check on a consumer sandbox app |
| Bundle growth from duplicated styling systems | Stage D removes antd entirely; monitor dist size each stage |
| antd static-API semantics (message queueing, modal promise) lost | wrap sonner/alert-dialog behind small helpers reproducing promise-based confirm API |
| Icon semantic drift after @ant-design/icons replacement | icons.tsx mapping table reviewed per PR; screenshot diff of nodes sidebar |
| ReUI license lapse breaks builds | icons.tsx isolates licensed imports; fallback path compiles without key |

## Out of scope

Grammar/engine packages (npm-owned), release pipeline redesign, new features beyond parity.
