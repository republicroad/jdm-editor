# pnpm Workspace Linking: symlink vs peer-variant clone

> How pnpm links the workspace packages inside this monorepo, why the same
> kernel resolves to **two different physical locations**, and the
> source-passthrough policy that keeps in-repo consumers correct.
> Origin: the dual-dist forensics in
> [`troubleshooting.md`](./troubleshooting.md) case 8 (2026-09-09).
> 中文对照:[`pnpm-workspace-linking.zh-CN.md`](./pnpm-workspace-linking.zh-CN.md)。

## 1. The two linking modes observed in this repo

```
packages/playground/node_modules/@republicroad/jdm-editor
    │ symlink → packages/jdm-editor                  (DIRECT, live source)

packages/appshell/node_modules/@republicroad/jdm-editor
    │ symlink → node_modules/.pnpm/@republicroad+jdm-editor@0._<peer-hash>/
    │           node_modules/@republicroad/jdm-editor
    ▼           (PHYSICAL CLONE, publish-shaped, frozen at install time)
    package.json + dist/ + node_modules/   — NO src/
```

| | direct symlink (playground) | peer-variant clone (appshell) |
|---|---|---|
| content | live workspace source, edits visible instantly | frozen snapshot from the last `pnpm install` |
| shape | source (`src/` included) | publish-shaped (`dist/` + metadata + nested deps, **no `src/`**) |
| breaks when | — (always current) | every `vite build` rewrites dist (see §3) |

## 2. Why pnpm materializes a clone for appshell

The kernel declares **peerDependencies** (react, react-dom, monaco-editor).
Peers must resolve **in the consumer's context** — so when one workspace
package depends on another workspace package that has peers, pnpm creates a
**peer-variant instance** under `.pnpm/<pkg>@<version>_<peer-hash>/` whose
directory name encodes the peer combination. Inside that instance the
package is materialized in **publish shape** (`publishConfig` applied, no
`src/`) so the consumer experiences the dependency exactly as the published
npm artifact would behave, with deterministic peer resolution.

Confirmed on disk (2026-09-09): the instance contains `package.json`,
`dist/`, and a nested `node_modules/` (its own dependency resolution
environment) — and **no `src/`**.

## 3. The hardlink freeze cycle

1. On materialization the clone's files are **hardlinks** to the workspace
   files — same inode, zero copy, content identical. Everything works.
2. `vite build` **empties outDir and writes brand-new files** → new inodes
   at the workspace path. The clone's directory entries still point at the
   old inodes → **the clone is permanently frozen at the install-time
   build**.
3. `pnpm install` re-materializes (re-links) — but the **next build
   freezes it again**. It is a cycle, not a one-off.

Measured on 2026-09-09: workspace `dist/index.js` inode
`6755399441228114` (links=1, Sep 8, contains all fixes) vs instance
`dist/index.js` inode `844424931592024` (links=4, into the pnpm store,
**Sep 4**, missing `编辑表达式` and every later fix; different md5, size
731 kB vs 655 kB).

## 4. Why it matters: test-green / browser-red

Consumers resolve the kernel differently:

- **vitest** (appshell config) and **storybook `viteFinal`** alias
  `@republicroad/jdm-editor` to **source** → always current.
- Anything resolving through appshell's node_modules link executes the
  **frozen clone** → days-old code (missing restored buttons, shaken i18n
  catalogs, …).

This produced the case-8 divergence: 431 source-resolved tests green while
the storybook canvas ran week-old code. See case 8 for the fiber-based
probe used to prove which code was actually executing.

## 5. Policy

- **Every in-repo consumer of a workspace package must source-alias it.**
  Current alias sites: `.storybook/main.ts` `viteFinal`
  (`@republicroad/jdm-editor` → kernel `src/index.ts`),
  `packages/appshell/vitest.config.ts` (+ monaco stub), and the playground
  vite config (both packages).
- The `.pnpm` clone is irrelevant to development once aliased; it only
  matters for **publish semantics** (what npm consumers get).
- After `pnpm install`, expect the appshell link to be re-materialized as
  a clone again — harmless as long as the aliases stay in place.
- `pnpm install` is still needed after builds if a consumer really must
  read the fresh dist through the link (temporary; re-freezes on the next
  build).

## 6. Forensic one-liners

```bash
readlink -f packages/appshell/node_modules/@republicroad/jdm-editor
stat -c 'inode=%i mtime=%y' \
  packages/jdm-editor/dist/index.js \
  node_modules/.pnpm/*/node_modules/@republicroad/jdm-editor/dist/index.js
# content probes (i18n catalog canary + fix markers):
grep -c "Upload JSON\|编辑表达式\|default-render-node-marker" \
  packages/jdm-editor/dist/index.js
```
