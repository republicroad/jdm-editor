# Migration 01 — ReactFlow 11 → @xyflow/react 12

> Status: **executed on this fork**. Chinese version: [`01-reactflow-v12.zh-CN.md`](./01-reactflow-v12.zh-CN.md).
> Scope: `packages/jdm-editor` only. No behavioral changes to graph semantics.

## Why

`reactflow@11` is in maintenance mode; v12 (`@xyflow/react`) is the actively developed TypeScript rewrite.
Since this fork must be self-sufficient long-term, staying on a legacy view library is unjustifiable risk.

## Impact surface (verified by code search)

13 files import from `reactflow`; 3 call sites use `instance.project()`; 2 files import the CSS.

| File | Usage | Required change |
|---|---|---|
| `graph/graph.tsx` | ReactFlow, Background, Controls, ControlButton, SelectionMode, useNodesState/useEdgesState, getOutgoers, types; CSS import; `project()` ×2 | imports + CSS + `screenToFlowPosition()` |
| `hooks/use-graph-clipboard.ts` | Node/ReactFlowInstance/XYPosition types; `project()` ×1 | imports + `screenToFlowPosition()` |
| `context/dg-store.context.tsx` | type-only: EdgeChange, NodeChange, ReactFlowInstance, useEdgesState/useNodesState | imports |
| `custom-edge.tsx` | BaseEdge, EdgeLabelRenderer, getBezierPath, EdgeProps | imports |
| `dg-wrapper.tsx` | ProOptions; CSS import | imports + CSS |
| `dg-util.ts` | Edge/Node types, MarkerType | imports |
| `dg.tsx` | ReactFlowProvider | imports |
| `helpers/traversal.ts` | Edge/Node types, getIncomers/getOutgoers | imports (+ generic signature) |
| `nodes/graph-node.tsx` | Handle, Position, HandleProps | imports |
| `nodes/custom-node/index.tsx` | XYPosition | imports |
| `graph/graph-components.tsx` | XYPosition | imports |
| `nodes/specifications/specification-types.ts` | NodeProps (via `MinimalNodeProps`) | imports |
| `nodes/specifications/switch.specification.tsx` | Handle, Position | imports |

## Steps

1. **Dependency swap**: remove `reactflow@11.11.4`, add `@xyflow/react@^12` to
   `packages/jdm-editor/package.json`; reinstall.
2. **Mechanical replacement**: `'reactflow'` → `'@xyflow/react'`;
   `'reactflow/dist/style.css'` → `'@xyflow/react/dist/style.css'`.
3. **API adaptations**:
   - `ReactFlowInstance.project({x,y})` → `ReactFlowInstance.screenToFlowPosition({x,y})`
     (v12 renamed; same coordinate conversion screen→flow).
   - `NodeProps` gained generics (`NodeProps<NodeType extends Node = Node>`); bare usage stays valid,
     so `MinimalNodeProps = Pick<NodeProps, 'id'|'data'|'selected'>` compiles unchanged.
   - `getOutgoers`/`getIncomers` are now generic over node data; existing calls with `Node<any>` compile.
4. **Already-compliant patterns** (no action): module-level memoized `nodeTypes`/`edgeTypes`
   (v12 requires referential stability), controlled nodes/edges via `onNodesChange/onEdgesChange`,
   React ≥18 peer range, `deleteKeyCode={null}`, `snapToGrid/snapGrid`, `connectionRadius`,
   `selectionMode={SelectionMode.Partial}`, `elevateNodesOnSelect`, Controls/ControlButton/Background —
   all present with same names in v12.
5. **Gates**: root `pnpm build` + `pnpm typecheck` green; Storybook smoke pass:
   connect edges (cycle/duplicate rejection), drag-drop node creation, marquee select + delete confirm,
   copy/paste/duplicate shortcuts, simulator run with trace highlight, serialize → restore viewport/tabs.

## Rollback

Single-commit change touching one package's `package.json` + 13 source files; revert commit restores v11.
