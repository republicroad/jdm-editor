# `@republicroad/jdm-editor`

React components for authoring [JDM](https://gorules.io/docs) (JSON Decision
Model) documents: a decision graph canvas, decision tables, expression and
function editors, a simulator, and a custom-function spreadsheet — themed
end-to-end with shadcn/ReUI + Tailwind.

> Fork of [`@gorules/jdm-editor`](https://github.com/gorules/jdm-editor) with
> significant divergence (ReactFlow 12, shadcn/ReUI stack, seed-derived
> theming, i18n, pooled editors). Will not track upstream merges.

## Installation

```bash
npm i @republicroad/jdm-editor
```

**Heads-up (0.3.0+):** `monaco-editor` is a peer dependency — install it
explicitly: `npm i monaco-editor`.

## Quick start

```tsx
import { DecisionGraph, JdmConfigProvider } from '@republicroad/jdm-editor';
import '@republicroad/jdm-editor/dist/style.css';

<JdmConfigProvider
  seeds={{ primary: '#6366f1' }} // one seed → full light + dark palettes
  locale='zh-CN' // or supply messages={...} for any locale
  darkMode={{ enabled: true }}
>
  <DecisionGraph value={graph} onChange={setGraph} />
</JdmConfigProvider>;
```

Wrap any subtree in `.grl-root` to scope the theme island; multiple islands
can coexist with independent themes.

## What's inside

| Surface                   | Highlights                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| **Decision Graph**        | xyflow canvas, tabs, diff support, simulator panel                                        |
| **Request node**          | Definitions / Data / Schema tab with example sources, inlay hints, JSON→Schema conversion |
| **Decision Table**        | virtualized rows, hit-policy, Excel import/export, simulation row highlights              |
| **Simulator**             | request binding to example sources, bidirectional auto-sync, per-node trace               |
| **Custom function table** | spreadsheet-style expressions: function/code modes, drag reorder, `;;` legacy migration   |
| **SafeBoundary**          | error-isolation boundary for editor subtrees                                              |

## Theming

All chrome resolves through shadcn semantic tokens injected onto the theme
island — no global CSS leaks. Derive full palettes from a single seed, flip
dark mode per island, or drive everything with explicit tokens. See
[`docs/shadcn-theming-roadmap.md`](../../docs/shadcn-theming-roadmap.md).

## i18n

Locale-neutral components with bundled `en` + `zh-CN` catalogs and a typed
fallback chain (host overrides → locale → en → key). See
[`docs/i18n.md`](../../docs/i18n.md).

## Simulator

Wire your engine via `onRun`; the request panel binds to the input node's
example sources and keeps the editor, definitions and schema examples in sync
(`useSimulatorAutoSync`).

## Custom nodes

```tsx
createJdmNode({
  kind: 'myKind',
  displayName: 'My Node',
  renderTab: ({ id, user, customFunctions }) => <MyTab id={id} />,
  renderNode: (props) => <GraphCard {...props} />,
});
```

The bundled `CustomFunctionTable` gives custom nodes a full expression
spreadsheet out of the box. `DecisionGraph` accepts `userResolver` and
`customFunctions` props.

## Self-hosting Monaco Editor

Monaco is a peer dependency — hosts install it explicitly and register its
workers once at startup (Vite example):

```ts
import type { Monaco } from '@monaco-editor/react';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

self.monaco = monaco;

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

loader.config({ monaco });
```

For webpack and other setups you may need
[monaco-editor-webpack-plugin](https://www.npmjs.com/package/monaco-editor-webpack-plugin).

## Documentation

The full documentation map lives in [`docs/README.md`](../../docs/README.md):
architecture, theming roadmap, CodeMirror migration, i18n, storybook guide,
host migration guide, 0.3.0 roadmap, and a troubleshooting case log.

## License

MIT — see [LICENSE](./LICENSE) (fork lineage: [GoRules](https://github.com/gorules/jdm-editor)).
