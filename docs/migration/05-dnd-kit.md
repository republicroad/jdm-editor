# Migration 05 — react-dnd → @dnd-kit/core

> Status: **completed** (2026-08). Chinese version: [`05-dnd-kit.zh-CN.md`](./05-dnd-kit.zh-CN.md).
> Follows [`04-react-19.md`](./04-react-19.md).

## Why

`react-dnd` is dormant (last release 2022-06; peer `react: ^18`). After the React 19 upgrade it
was the only remaining dependency whose peer range rejected our runtime, tolerable only via
warning fatigue. `@dnd-kit/core` is actively maintained and supports React 16–19 natively.

## Scope — four drag scenarios rewritten

| Scenario | Files | Old API | New API |
|---|---|---|---|
| Decision-table row swap | `dt.tsx`, `table-row.tsx` | `DndProvider`+`useDrag/useDrop` (type `'row'`) | `DndContext` in `DecisionTableDnd` + `useDraggable/useDroppable`, swap in `onDragEnd` |
| Expression item reorder | `expression.tsx`, `expression-item.tsx` | same, type `'row'` | `ExpressionDnd` context, swap in `onDragEnd` |
| Fields reorder dialog | `fields-reorder-dialog.tsx` | hover-time midpoint insertion | `onDragOver` **id-based** live reorder (`columnsRef` guards staleness) |
| Excel import column mapping | `components/dt-excel-dialog.tsx` | per-row hover midpoint | local `ExcelDnd` context, id-based move within same section |

## Design decisions

- **`manager` prop removed from public API** (breaking): `ExpressionProps.manager`,
  `DecisionTableProps.manager`, `renderTab({ id, manager })` → `renderTab({ id })`, plus the
  `createDragDropManager(HTML5Backend)` plumbing in `dg-wrapper` and stories. dnd-kit needs no
  shared manager — each component owns a scoped `DndContext`; nested contexts isolate naturally.
- **Direction indicators preserved**: `dropping-up` / `dropping-down` classes still drive the
  existing SCSS insertion bars. Direction is computed from the *active dragged rect center* vs the
  hovered target rect center (`helpers/dnd.ts#getDropDirection`) instead of react-dnd's pointer
  delta — visually equivalent.
- **Sensors**: single `PointerSensor` with `{ activationConstraint: { distance: 4 } }` so clicks on
  inputs inside rows never start a drag.
- **Swap-on-drop semantics kept** for table/expression (one position change per gesture); live
  reorder kept for fields dialog and excel mapping, matching previous UX exactly.
- Item follows the cursor during drag (dnd-kit default transform). The old HTML5 ghost-image
  preview is gone; source node dims via existing opacity rules. If a floating preview is wanted
  later, add dnd-kit's `DragOverlay`.

## Bonus fix surfaced by real-pointer testing

`.expression-list__item__th--order` (decorative header cell) computed to **63px tall**
(`height: 100%` against an auto-height grid parent) and silently covered the first row's drag
handle — real-mouse drags on expression items were dead even before this migration; earlier probes
missed it because they dispatched synthetic events that bypass hit-testing. Fixed with
`pointer-events: none` on header cells.

## Verification

typecheck · vitest 37/37 · test-storybook 55/55 · Playwright **real-mouse** drags: expression item
reorder (order changed, `dropping-down` shown) and table row swap (row moved 1→3) both pass with
zero console errors. Fields-reorder/excel share the proven id-based pattern and are exercised by
story smoke tests.

## Lessons

1. Synthetic-event probes bypass hit-testing — always verify drag UX with real pointer pipelines;
   they surface overlay/z-index dead zones synthetic tests never see.
2. When porting hover-time reorder logic, key moves by stable **ids**, not indexes: index payloads
   captured at drag start go stale after the first reorder under dnd-kit's continuous `onDragOver`.
