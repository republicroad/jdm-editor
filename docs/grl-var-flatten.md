# `--grl-*` Variable Flatten — L1 Audit & Host Migration Guide

> Phase L1 (zero-breaking) of roadmap §3 end-state. Batch: 2026-08.
> English canonical; 中文对照随 P3/L2 节点补充。

## Audit result (52 generated keys)

| Class | Count | Meaning |
| --- | --- | --- |
| BRIDGED → semantic | 10 | consumed by `tokens.css`, feeding the shadcn semantic layer (`--background`, `--primary`, …) — **stay until flatten L2**, then semantic names replace them at consumers |
| CONSUMED-IN-SRC | 37 | used directly by library components/skins via `var(--grl-…)` — the working vocabulary of this fork |
| HOST-FACING-ONLY | 5 | not referenced anywhere in the repo; kept only because hosts may read them |

## HOST-FACING-ONLY keys (deprecation targets for L2)

| Key | Note |
| --- | --- |
| `--grl-color-primary-text-hover` | no consumer; `--grl-color-primary-hover` covers hover text |
| `--grl-color-info-text` | info family mirrors primary; consumers use primary text |
| `--grl-color-bg-mask` | overlay mask; overlays now use primitive tokens |
| `--grl-primary-color` | exact legacy duplicate of `--grl-color-primary` |
| `--grl-primary-color-bg` | exact legacy duplicate of `--grl-color-primary-bg` |

## Host migration checklist (before upgrading past the flatten release)

1. Replace `var(--grl-primary-color)` → `var(--grl-color-primary)`.
2. Replace `var(--grl-primary-color-bg)` → `var(--grl-color-primary-bg)`.
3. If you read `--grl-color-primary-text-hover` / `--grl-color-info-text` /
   `--grl-color-bg-mask`, switch to `--grl-color-primary-hover` /
   `--grl-color-info` / a local rgba overlay respectively.
4. Everything else keeps working — the 47 remaining keys are contract-stable
   until the semantic-name sweep (L2 consumers batch) completes in a later
   major.

## Removal record (L2, this batch)

`--grl-primary-color` and `--grl-primary-color-bg` are removed from
`computeTheme` output in the same change set (they are unreferenced in-repo and
have exact duplicates). Ships with the next major; hosts should land the
checklist above first.
