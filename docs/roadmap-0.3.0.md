# Roadmap — 0.3.0 (draft)

> Status: **draft** — scope is proposed, not committed. Trigger conditions are
> listed per item; items ship in whatever order their triggers fire.

## 1. Items ready to ship (code staged, awaiting the release)

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

- Drag reorder is pointer-only (dnd-kit `PointerSensor`). Adding
  `KeyboardSensor` needs a roving tabindex in the expression list and an
  accessible "pick up / drop" idiom; defer until the list lands in a
  first-party surface.

### 3.3 Simulator story determinism

- Done in `f5b7c69d`: the story falls back to a locally built demo trace when
  the remote engine is unreachable. If the flake resurfaces, promote the mock
  to a storybook route handler and drop the network attempt entirely.

## 4. Explicitly out of scope for 0.3.0

- Upgrading `@gorules/zen-engine-wasm` to a full graph-execution engine — the
  published wasm exposes expression-layer APIs only (see the T8 investigation;
  remote `/api/simulate` remains the engine).
- Shadow-DOM scoped injection (Batch S3 archive — monaco blocker).
