# Brand Sweep Codemod — `grl-` → `seal-`

- **Date**: 2026-09-26
- **Status**: executed on the `reui` line (this repo); mirrors the seal-editor repo sweep at its commit `2636adf`
- **Tool**: [`scripts/brand-sweep-codemod.mjs`](../../scripts/brand-sweep-codemod.mjs)

## Why

The fork's CSS/identifier prefix `grl-` predates the `seal` product brand. The
seal-editor repo (npm product line) already swept `grl-` → `seal-` at 1.1.0.
This repo executes the same sweep so that:

1. both repos share one styling/theming vocabulary, and innovation work here
   (reui line) cherry-picks into the product line without rename churn;
2. hosts consume one contract (`--seal-*` tokens, `.seal-root` scope) across
   both distributions.

## The codemod

`scripts/brand-sweep-codemod.mjs` is parameterized (`--from grl --to seal`
defaults to this sweep), **idempotent**, and excludes its own source file.
Ordered rules — later rules only see what earlier rules left:

| # | Rule | Catches | Example |
|---|---|---|---|
| 1 | `GRL-` → `SEAL-` | debt markers | `GRL-STYLE-HACK` → `SEAL-STYLE-HACK`, `GRL-LAYER-GUARD` → `SEAL-LAYER-GUARD` |
| 2 | `Grl` → `Seal` | PascalCase identifiers | `GrlPortalContainer` → `SealPortalContainer`, `GrlContainerProvider` → `SealContainerProvider` |
| 3 | `grl-` → `seal-` | CSS classes, scopes, custom properties | `grl-root` → `seal-root`, `grl-dg` → `seal-dg`, `grl-ce-*` → `seal-ce-*`, `--grl-color-*` → `--seal-color-*` |
| 4 | `grl` → `seal` | remaining camelCase / bare identifiers | `grlContainer` → `sealContainer` |

### Run record (this repo)

- **Scope**: `packages/**` (src, tests, stories, READMEs), `scripts/*.mjs`,
  live `docs/**` — 708 files scanned.
- **Replacements**: 1,525 across 137 files in the main pass
  (`grl-` 1,441 · `GRL-` 21 · `Grl` 37 · `grl` 26), plus 20 follow-up
  replacements in package READMEs → **≈1,545 across 141 files**.
- **Zero-residue check**: `grep -ri grl` outside the exclusions returns nothing.

### Exclusions

- `docs/archive/**` — historical records keep their original names (same
  ruling as the seal-editor sweep).
- `@gorules/*` upstream lineage — lexically safe: `grl` is not a substring of
  `gorules`.
- `localStorage.gru-hl-view` — different legacy prefix (`gru-`), and a runtime
  key: renaming would silently reset existing users' settings.

### Special handling

`docs/archive/research/grl-var-flatten.md` keeps its historical filename.
Live references were repointed at the real archived path
(previously `docs/grl-var-flatten.md`, a dead link in
`theming/compute.ts` and both `host-migration-guide` locales).

## Breaking-change note for hosts

Everything that survived this sweep renamed together and stays
self-consistent: theme tokens (`--seal-color-*`), scope classes
(`.seal-root`, `.seal-dg`, `.seal-ce-*`), and component classes
(`seal-textarea-input`, `seal-function__*`, …). Hosts that override library
styles must rename their `.grl-*` / `--grl-*` selectors mechanically — the
mapping is exactly the rules table above.

## Gates (all green after the sweep)

| Gate | Result |
| --- | --- |
| kernel vitest (CI=true) | 447/447 (+1 obsolete snapshot dropped — pre-existing vitest naming-format relic, `vitest -u`) |
| appshell vitest | 154/154 |
| storybook interaction suite | 14 suites / 70 tests |
| kernel + appshell `tsc --noEmit` | clean (appshell needed the `#*` kernel-subpath mapping added — see below) |
| build (kernel + appshell) | green |
| bundle size | recalibrated — see below |
| style-debt | `!important` 12/18 · raw-hex 0/0 |
| eslint + react-compiler + prettier | clean |
| consumer smoke (react 18 & 19, table-only measure) | all hosts PASS |

### Size budget recalibration

`seal-` is one byte longer than `grl-` per occurrence; ~1.5k renames land in
the shipped bundle. Local (Windows) post-sweep: `index.js` 679.2kB raw /
166.2kB gzip, `style.css` 116.5kB raw / 18.7kB gzip. Budgets apply the
established CI-Linux factor (local × 1.025, rounded up):

- `index.js`: raw 675,000 → **700,000**, gzip 166,000 → **172,000**
- `style.css`: raw 115,000 → **121,000**, gzip 18,500 → **19,500**
- (`index.js` gzip 172,000 matches the seal-editor calibrated value.)

### Appshell source-passthrough typecheck

Appshell compiles kernel `src/` through tsconfig `paths`; kernel resolves its
`#reui/*`, `#lib/*`, `#icons` subpath imports via its own `#* → ./src/*`
paths entry. Appshell lacked the mirror and failed on the newer `#reui/*`
imports (node-card work). Fixed by adding `"#*": ["../jdm-editor/src/*"]` to
`packages/appshell/tsconfig.json`.

## Reproduce

```bash
node scripts/brand-sweep-codemod.mjs --dry   # preview
node scripts/brand-sweep-codemod.mjs         # apply (idempotent)
# verify
grep -ri grl packages/ scripts/ docs/ --include='*' -l | grep -v archive | grep -v node_modules
pnpm format && pnpm lint:compiler && pnpm lint:debt && pnpm size
pnpm test && pnpm --filter @republicroad/jdm-appshell test
```
