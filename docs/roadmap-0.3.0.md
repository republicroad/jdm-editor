# Roadmap — 0.3.0 (draft)

> Status: **draft** — scope is proposed, not committed. Trigger conditions are
> listed per item; items ship in whatever order their triggers fire.

## 1. Items ready to ship (code staged, awaiting the release)

> **Landed note (post-0.3.1):** the scheme D kernel/shell split is now
> realized — the custom node ecosystem (six nodes, registry, protocols,
> skins, persistence contract, version history) ships as the separate
> @republicroad/jdm-appshell workspace package (fifth batch + host wiring
> in the editor repo).

### 1.1 `monaco-editor` → `peerDependencies`

**Status:** landed on `reui` (`29366e78`) — activates with the 0.3.0 release.

- Hosts install `monaco-editor` explicitly (`npm i monaco-editor`); installs
  slim by ~5 MB.
- Library build externalizes `dependencies` **and** `peerDependencies`
  (`vite.config.ts` — the peer move alone silently inlined monaco; see
  `troubleshooting.md` case #7 for the detection discipline).
- Regression list for release notes: hosts relying on transitive monaco must
  add the install line; `consumer-smoke`/`npm-smoke` already assert the new
  contract.

## 2. Trigger-gated items (carried from 0.2.x planning)

### 2.1 Pooled-editor grayscale flag removal (A2)

- **Trigger:** next **major** (behavioral default flip with no opt-out).
- Remove the `localStorage.gru-hl-view` escape hatch; the pooled display path
  becomes unconditional. `cell-view-pool` stays.

### 2.2 L2 consumers sweep

- **Trigger:** next **major**.
- Migrate remaining internal `--grl-color-*` consumers (non-bridged keys:
  `bg-container`, `primary-hover/bg`, field tokens, chrome statics) to shadcn
  semantic names. After this, `--grl-*` is a pure theming contract.

### 2.3 `--grl-*` emission deprecation

- **Trigger:** after 2.2 + one minor of deprecation notices.
- Stop injecting legacy-only keys; keep the contract-stable set documented in
  `host-migration-guide.md` §`--grl-*`.

## 3. New candidates introduced by the 0.2.x ports

### 3.1 Code splitting evaluation

- index.js is 713kB raw / 169kB gzip (budgeted 735k/182k). Composition is
  dominated by the decision-graph + decision-table surfaces and the
  expression pipeline; monaco is external.
- **Candidate:** split `DecisionTable` / `DecisionGraph` entries so hosts
  using one surface don't pay for the other. Requires an exports-map review
  (`./dist/table`, `./dist/graph`?) and consumer guidance. Estimate after a
  `rollup-plugin-visualizer` run.

### 3.2 Keyboard support for row drag (custom function table)

- **Status: partially done.** KeyboardSensor is wired (pickup via Space/
  Enter, cancel via Esc, drop completes without errors) and guarded by the
  `cf-drag-keyboard` probe (6 checks). `MeasuringStrategy.Always` +
  `closestCorners` were added for droppable accuracy.
- **Open:** arrow-move collision tuning — a keyboard drop does not yet
  reliably land on the intended row (probe asserts the lifecycle, not the
  landing order). Likely needs a sortable-style layout (dnd-kit
  `@dnd-kit/sortable` with `sortableKeyboardCoordinates`) rather than raw
  core droppables; defer until the list is a first-party surface.

### 3.3 Simulator story determinism

- Done in `f5b7c69d`: the story falls back to a locally built demo trace when
  the remote engine is unreachable. If the flake resurfaces, promote the mock
  to a storybook route handler and drop the network attempt entirely.

## 4. Explicitly out of scope for 0.3.0

- Upgrading `@gorules/zen-engine-wasm` to a full graph-execution engine — the
  published wasm exposes expression-layer APIs only (see the T8 investigation;
  remote `/api/simulate` remains the engine).
- Shadow-DOM scoped injection (Batch S3 archive — monaco blocker).

## 5. Dependency audit note (2026-09)

`pnpm audit --prod` reports 1 high: minimatch ReDoS. `pnpm why minimatch`
traces every chain to **dev/engine tooling only** (lerna, @lerna/*, npm
cli libs, eslint-plugin-storybook → typescript-estree) — none of these ship
in the published tarball (files: `dist/` only) or execute in host apps.
Disposition: **accepted dev-chain risk**; an override would fight lerna's
pinned range for zero runtime gain. Revisit when lerna bumps minimatch.

## Appendix A — A2 flag removal inventory (trigger 2.1)

`localStorage.gru-hl-view` touch points when the trigger fires:

| Where | Change |
| --- | --- |
| `src/components/code-editor/ce.tsx:15` | Drop the `localStorage.getItem` read — the pooled path becomes unconditional |
| `src/components/code-editor/ce-highlight-view.tsx:10` | Update the header comment (flag → default-on) |
| `host-migration-guide.md` + zh | Remove the opt-out row from the breaking-changes table |
| `codemirror-theme-migration.md` + zh (§release strategy) | Mark the grayscale period closed |
| `shadcn-theming-roadmap.md` + zh (Batch A2 note) | Status → flag removed |

No other code reads the flag. Release note: "pooled CodeMirror cell editors
are now the only path; the `gru-hl-view` escape hatch is gone."

## Appendix B — L2 consumers sweep inventory (trigger 2.2)

Measured across `src/**/*.{ts,tsx,css}`: **36 distinct `--grl-color-*` keys,
184 references**. Status colors (success/success-bg/success-border/warning/
warning-bg/warning-border — 55 refs) are already bridged to shadcn semantics
via `tokens.css`; the migration target is the remaining **129 refs across 30
non-bridged keys**:

| Key | Refs | shadcn target |
| --- | ---: | --- |
| `bg-container` | 19 | `--card` (context-dependent) |
| `error-bg` | 10 | `--destructive` + opacity |
| `primary-hover` | 9 | `--primary` + opacity |
| `primary-bg-fade` | 9 | `--primary` + alpha |
| `primary-border` | 8 | `--primary` + alpha |
| `border-fade` | 8 | `--border` + alpha |
| `primary-bg` | 7 | `--primary` + alpha |
| `text-base` | 7 | `--foreground` |
| `text-tertiary` | 5 | `--muted-foreground` |
| `text-disabled` | 5 | `--muted-foreground` + opacity |
| `info` / `info-bg` | 5 | `--grl-info` (keep, contract-stable) or `--primary` |
| `error` | 4 | `--destructive` |
| `primary` | 3 | `--primary` |
| `text-placeholder` | 3 | `--muted-foreground` |
| `border` | 3 | `--border` |
| `bg-layout` | 3 | `--muted` |
| `field-input` / `field-output` (+hover ×2) | 8 | keep — field-scoped contract keys |
| `text-secondary` | 2 | `--muted-foreground` |
| `error-border` / `warning-border` / `success-border` | 6 | `--destructive`/`--warning` + alpha |
| `border-hover` | 2 | `--border` + opacity |
| `primary-active` | 2 | `--primary` + opacity |
| `primary-bg-hover` / `primary-border-hover` | 2 | `--primary` + alpha |
| `text-light-solid` | 1 | `--primary-foreground` |
| `warning-text` | 1 | `--warning-foreground` |

Effort estimate: one focused pass (~1 day) touching the decision-table and
simulator chrome above; `tokens.css` bridge keys and `field-*` contract keys
stay. After the sweep, `--grl-color-*` usage shrinks to the documented
contract surface only.
