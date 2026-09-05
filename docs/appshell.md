# `@republicroad/jdm-appshell` — the reference consumer shell

> Package: `@republicroad/jdm-appshell` (0.1.0) · Peer deps:
> `@republicroad/jdm-editor >= 0.3.0`, `react >= 18`, `react-dom >= 18` ·
> Exports: `.` and `./dist/style.css`

## Positioning

This package is the **scheme D reference consumer** — the realization of the
kernel/shell split. The kernel (`@republicroad/jdm-editor`) stays
host-agnostic: it ships the editor surfaces, theming and the import contract
(architecture §8.1) but holds no opinions about which custom nodes exist, how
users authenticate, or where graphs are persisted. All of that "opinionated"
machinery lives here, in the shell.

Dependency direction is strictly one-way: **shell → kernel** (peer). The
kernel never imports the shell, and the shell keeps its own UI kit copies
(`components/ui/*`, `reui/*`) so it does not reach back into the kernel's UI
layer.

## Responsibility domains

| Domain | Location | Contents |
| --- | --- | --- |
| **Custom node hosting** | `components/custom-node/`, `hooks/useCustomNodes.ts` | Six nodes — HTTP request, query list, crypto, JSON path, template, current date — each with a tab renderer (`*Node` spec + `*Tab` component), plus `KeyValueEditor` and `LockedCornerBadge` |
| **Registry & protocols** | `lib/` | `custom-node-registry` (schema→nodes conversion with bundled fallback), `custom-node-plans`, protocol libs (http-request / json-path / crypto), `user-resolver` (better-auth + anonymous adapters), `storage-key` |
| **Node composition hook** | `hooks/useCustomNodes.ts` | Composes base nodes + schema-fetched nodes (graceful fallback) + skin overrides into the `customNodes` array consumed by `DecisionGraph` |
| **Skin system** | `skin/`, `context/theme.provider` | `applyNodeOverrides` — per-`kind` renderTab/renderNode overrides; theme seeds flow through `ThemeProvider` into node UI slots |
| **Shell persistence contract** | `shell/persistence.ts`, `shell/graphs-http-adapter.ts` | `GraphPersistenceAdapter` — host-implemented: `list`/`load`/`save` (optimistic lock via `baseRevision` → CONFLICT) / `delete` / `listVersions`; 404 semantics (null/false, never throws); `graphs-http-adapter` is the HTTP implementation; `default-simulate` wires the remote engine |
| **UI kit copies** | `components/ui/`, `reui/` | shadcn primitives + ReUI components (incl. the cascader suite) duplicated so the shell stays independent of the kernel's UI layer |
| **Version history** | `components/version-history/` | `VersionHistoryPanel` — lists/loads past revisions via `listVersions` |

## Kernel / shell boundary rules

1. The kernel never imports the shell (enforced direction: shell peer-depends
   on kernel `>= 0.3.0`).
2. Kernel-internal imports use node subpath imports (`#…`); hosts cannot
   resolve them — anything a host needs must come from the kernel `exports`.
3. Shell-owned concerns (custom nodes, auth/user, persistence, skins) live
   here, not in the kernel.
4. UI strings for shell surfaces (`cf.*` catalog keys) currently ship in the
   kernel catalogs — a known trade-off (the shell depends on the kernel
   anyway); revisit if the shell ever ships standalone.

## Host wiring

```tsx
import { DecisionGraph } from '@republicroad/jdm-editor';
import {
  HttpRequestTab, httpRequestNode,
  QueryListTab, queryListNode,
  CryptoTab, cryptoNode,
  JsonPathTab, jsonPathNode,
  TemplateTab, templateNode,
  CurrentDateTab, currentDateNode,
} from '@republicroad/jdm-appshell';

// Option A — explicit node list:
<DecisionGraph customNodes={[httpRequestNode, queryListNode, cryptoNode, jsonPathNode, templateNode, currentDateNode]} />

// Option B — the composition hook (schema-aware, skin-aware):
import { useCustomNodes } from '@republicroad/jdm-appshell';
const { customNodes, ready } = useCustomNodes({ schemaSource: '/api/custom-nodes/schema' });
// ready ? <DecisionGraph customNodes={customNodes} … /> : <spinner/>
```

With user resolution and persistence (full shell):

```tsx
import { createUserResolver, createBetterAuthAdapter } from '@republicroad/jdm-appshell';

<DecisionGraph
  customNodes={customNodes}
  userResolver={createUserResolver(createBetterAuthAdapter())}
/>
```

The persistence contract (`GraphPersistenceAdapter`) is implemented by the
host (REST, database, filesystem — see `shell/graphs-http-adapter.ts` for the
HTTP reference).

## Integration story

`src/integration/decision-graph-appshell.stories.tsx` mounts the kernel
`DecisionGraph` with `useCustomNodes` and an in-memory persistence adapter —
published to the live storybook under **Integration/Kernel + Appshell**.

## Development

```bash
pnpm --filter @republicroad/jdm-appshell typecheck   # tsc --noEmit
pnpm --filter @republicroad/jdm-appshell test        # vitest (node env, 8 suites / 67 tests)
pnpm --filter @republicroad/jdm-appshell build       # dist + style.css
pnpm --filter @republicroad/jdm-appshell test:npm-smoke
```
