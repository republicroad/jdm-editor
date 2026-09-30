import type { CellSelectionState } from '@tanstack/react-table';
import { useTable } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { cleanup, fireEvent, render } from '@testing-library/react';
import React, { useEffect, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { DataGrid, dataGridFeatures } from './data-grid';
import { DataGridCellSelection } from './data-grid-cell-selection';
import { DataGridTableDndRows } from './data-grid-table-dnd-rows';

afterEach(cleanup);

interface Row {
  id: string;
  a: string;
  b: string;
}

const makeRows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({ id: `r${i}`, a: `a${i}`, b: `b${i}` }));

// v9 泛型三元：首参 features（同 dt table.tsx 惯例）
const columns: ColumnDef<any, any, any>[] = [
  { id: 'idx', size: 44, enableResizing: false },
  { accessorKey: 'a', id: 'a', size: 120 },
  { accessorKey: 'b', id: 'b', size: 120 },
];

// 本 fork 的 tanstack：传 onCellSelectionChange 即外部接管态，须与 state 成对
// （与 dt table.tsx 的受控模式一致），否则焦点不生效。
const Host: React.FC<{ rows: Row[]; onCellSelectionChange?: (state: CellSelectionState) => void }> = ({
  rows,
  onCellSelectionChange,
}) => {
  const [cellSelection, setCellSelection] = useState<CellSelectionState>([]);
  useEffect(() => {
    onCellSelectionChange?.(cellSelection);
  }, [cellSelection]);
  const table = useTable({
    data: rows,
    columns,
    features: dataGridFeatures,
    manualPagination: true,
    getRowId: (row) => row.id,
    state: { cellSelection },
    onCellSelectionChange: setCellSelection,
  });
  return (
    <div data-testid='dt-virtual-scroll' style={{ maxHeight: 600, overflowY: 'auto' }}>
      <DataGrid
        table={table}
        recordCount={rows.length}
        tableLayout={{ rowsDraggable: true, cellSelection: true, cellSelectionMode: 'single' }}
      >
        <DataGridTableDndRows handleDragEnd={() => {}} dataIds={rows.map((r) => r.id)} />
        <DataGridCellSelection clipboard={false} />
      </DataGrid>
    </div>
  );
};

const focusedCell = (container: HTMLElement): HTMLTableCellElement | null =>
  container.querySelector('td[data-cell-focused]');

const keyOn = (container: HTMLElement, key: string, options: Record<string, boolean> = {}) => {
  const target = container.querySelector('td[data-cell-focused]') ?? container.querySelector('table');
  fireEvent.keyDown(target!, { key, bubbles: true, ...options });
};

describe("DataGridCellSelection single mode (A')", () => {
  it('moves the focused cell with plain arrows and reports each move through onCellSelectionChange', () => {
    const seen: CellSelectionState[] = [];
    const { container } = render(<Host rows={makeRows(20)} onCellSelectionChange={(state) => seen.push(state)} />);

    // 初始无焦点；程序化聚焦第一行 a 列
    const td = container.querySelector('tbody tr[data-row-id="r0"] td[data-col-id="a"]')!;
    fireEvent.mouseDown(td);
    expect(focusedCell(container)?.closest('tr')).toHaveAttribute('data-row-id', 'r0');

    keyOn(container, 'ArrowDown');
    expect(focusedCell(container)?.closest('tr')).toHaveAttribute('data-row-id', 'r1');

    keyOn(container, 'ArrowRight');
    expect(focusedCell(container)).toHaveAttribute('data-col-id', 'b');

    expect(seen.length).toBeGreaterThanOrEqual(2);
    const last = seen[seen.length - 1]!;
    expect(last[last.length - 1]!.focusRowId).toBe('r1');
  });

  it('reserves Alt+Arrow for the host (no focus move) — the row-management chord', () => {
    const { container } = render(<Host rows={makeRows(20)} />);

    fireEvent.mouseDown(container.querySelector('tbody tr[data-row-id="r0"] td[data-col-id="a"]')!);
    expect(focusedCell(container)?.closest('tr')).toHaveAttribute('data-row-id', 'r0');

    keyOn(container, 'ArrowDown', { altKey: true });
    expect(focusedCell(container)?.closest('tr')).toHaveAttribute('data-row-id', 'r0');
  });

  it('Ctrl+Arrow jumps to the grid edge (last row for ArrowDown)', () => {
    const { container } = render(<Host rows={makeRows(20)} />);

    fireEvent.mouseDown(container.querySelector('tbody tr[data-row-id="r0"] td[data-col-id="a"]')!);
    keyOn(container, 'ArrowDown', { ctrlKey: true });

    expect(focusedCell(container)?.closest('tr')).toHaveAttribute('data-row-id', 'r19');
  });

  it('never grows a range in single mode: Shift+Arrow still collapses to one focused cell', () => {
    const { container } = render(<Host rows={makeRows(20)} />);

    fireEvent.mouseDown(container.querySelector('tbody tr[data-row-id="r0"] td[data-col-id="a"]')!);
    keyOn(container, 'ArrowDown', { shiftKey: true });
    keyOn(container, 'ArrowDown', { shiftKey: true });

    const focused = focusedCell(container);
    expect(focused?.closest('tr')).toHaveAttribute('data-row-id', 'r2');
    // 单格：仅一个选中格（aria-selected），无矩形区域
    expect(container.querySelectorAll('td[aria-selected="true"]').length).toBe(1);
  });
});
