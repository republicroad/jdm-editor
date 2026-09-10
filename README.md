## JDM Editor

JDM Editor is an open-source React component for crafting and designing JDM (JSON Decision model) files.
Whether you’re a developer, data analyst, or decision model expert, JDM Editor can help you harness the full potential of decision modeling, making it more accessible and manageable than ever before

[<img width="945" alt="Rules Engine Editor" src="https://gorules.io/images/jdm-editor.gif">](https://republicroad.github.io/jdm-editor/)

> A JDM Editor
> Live demo and usage at https://republicroad.github.io/jdm-editor/
> Documentation site at https://republicroad.github.io/jdm-editor/docs/

## Installation

```bash
npm i @republicroad/jdm-editor
```

## Usage

```typescript
...
import '@republicroad/jdm-editor/dist/style.css';
import { DecisionGraph, JdmConfigProvider } from '@republicroad/jdm-editor';
...

<JdmConfigProvider>
  <DecisionGraph
    value={graph}
    onChange={(val) => setGraph(val as any)}
  />
</JdmConfigProvider>
```

## Decision Graph

<img width="945" alt="Decision Graph" src="https://gorules.io/images/decision-graph.png">

```typescript
export type DecisionGraphProps = {
  id?: string;
  forwardedRef?: (instance: DecisionGraphRef) => void;
  defaultValue?: DecisionGraphType;
  value?: DecisionGraphType;
  disabled?: boolean;
  viewConfig?: ViewConfig;
  components?: CustomNodeType[];
  onChange?: (val: DecisionGraphType) => void;
  manager?: DragDropManager;
  reactFlowProOptions?: ProOptions;
  onReactFlowInit?: () => void;
};
```

## Decision Table

<img width="945" alt="Decision Table" src="https://gorules.io/images/decision-table.png">

### API

```typescript
export type DecisionTableProps = {
  id?: string;
  defaultValue?: DecisionTableType;
  value?: DecisionTableType;
  onChange?: (decisionTable: DecisionTableType) => void;
  activeRules?: string[];
  permission?: DecisionTablePermission;
  disabled?: boolean;
  disableHitPolicy?: boolean;
  minColWidth?: number;
  colWidth?: number;
  inputsSchema?: SchemaSelectProps[];
  outputsSchema?: SchemaSelectProps[];
  cellRenderer?: (props: CellProps) => JSX.Element | null | undefined;
};
```

## Self-hosting Monaco Editor

To self-host monaco editor in Vite.

```ts
import type { Monaco } from '@monaco-editor/react';
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

declare global {
  interface Window {
    monaco?: Monaco;
  }
}

self.monaco = monaco;

self.MonacoEnvironment = {
  getWorker(workerId: string, label: string): Promise<Worker> | Worker {
    if (label === 'json') {
      return new jsonWorker();
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker();
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker();
    }
    if (label === 'typescript' || label === 'javascript') {
      return new tsWorker();
    }

    return new editorWorker();
  },
};

loader.config({ monaco });
```

For webpack and other configurations, you may require some additional loaders, such as https://www.npmjs.com/package/monaco-editor-webpack-plugin.

## Self-host demo server (experimental)

This repository ships a stateless demo server (`apps/demo-server`, Bun + [Hono](https://hono.dev)) that validates and executes decision models with `@gorules/zen-engine`. It is a **self-hosting demo only** — no auth, no storage, no business logic.

One command starts the playground frontend and the demo server together:

```bash
pnpm dev        # playground :517x + demo-server :8787 (run-p)
```

The playground header gains a **Server run** button (graph page) that POSTs the current graph to `:8787/v1/execute` and shows the result — the editor UI and the execution backend, end to end. Override the target with `VITE_DEMO_SERVER_URL`.

Docker (server only):

```bash
docker compose up demo-server   # :8787

curl -s localhost:8787/v1/execute -H "content-type: application/json" \
  -d "{"model": $(cat model.json), "input": {"customer": {"tier": "GOLD"}}}"
```

See [apps/demo-server/README.md](apps/demo-server/README.md) for the API surface. A production-grade rule platform (auth, multi-tenant workspaces, audit) lives in the private `verdict` repo and is out of scope here.

## License

MIT © [GoRules](https://github.com/gorules/jdm-editor/LICENSE)
