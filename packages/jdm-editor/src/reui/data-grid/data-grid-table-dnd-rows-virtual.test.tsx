import { useTable } from '@tanstack/react-table';
import type { ColumnDef } from '@tanstack/react-table';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import React, { useRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { DataGrid, dataGridFeatures } from './data-grid';
import { keepDataGridDndIndexInRange } from './data-grid-table-dnd-rows';
import { DataGridTableDndRows } from './data-grid-table-dnd-rows';

// jsdom has no layout: every element reports 0. The virtualizer reads the
// scroll container's offsetHeight once on connect (getRect) and each mounted
// row's offsetHeight on measure, so both are stubbed to plausible values.
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLElement) {
    if (this.tagName === 'TR') return 38;
    if (this.getAttribute('data-testid') === 'dt-virtual-scroll') return 600;
    return 0;
  },
});

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

const Host: React.FC<{ rows: Row[]; minRows?: number }> = ({ rows, minRows }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const table = useTable({
    data: rows,
    columns,
    features: dataGridFeatures,
    manualPagination: true,
    getRowId: (row) => row.id,
  });
  const dataIds = rows.map((r) => r.id);
  return (
    <div ref={scrollRef} data-testid='dt-virtual-scroll' style={{ maxHeight: 600, overflowY: 'auto' }}>
      <DataGrid table={table} recordCount={rows.length} tableLayout={{ rowsDraggable: true, columnsResizable: true }}>
        <DataGridTableDndRows
          handleDragEnd={() => {}}
          dataIds={dataIds}
          virtual={{ estimateSize: 38, overscan: 8, minRows: minRows ?? 100, scrollElementRef: scrollRef }}
        />
      </DataGrid>
    </div>
  );
};

const mountedRowIndexes = (container: HTMLElement): number[] =>
  Array.from(container.querySelectorAll<HTMLTableRowElement>('tbody tr[data-index]')).map((row) =>
    Number(row.getAttribute('data-index')),
  );

describe('DataGridTableDndRows row virtualization', () => {
  it('windows a large row set: only the viewport window mounts, with spacer rows carrying the scroll height', async () => {
    const { container } = render(<Host rows={makeRows(500)} />);

    await waitFor(() => {
      expect(container.querySelectorAll('tbody tr[data-row-id]').length).toBeGreaterThan(0);
    });

    const mounted = mountedRowIndexes(container);
    // ~600/38 + 2x8 overscan -> low thirties; certainly not 500.
    expect(mounted.length).toBeLessThan(60);
    expect(mounted[0]).toBe(0);
    // Contiguous window.
    for (let i = 1; i < mounted.length; i++) {
      expect(mounted[i]).toBe(mounted[i - 1] + 1);
    }
    expect(container.querySelectorAll('tr[data-slot="data-grid-table-dnd-virtual-spacer"]').length).toBeGreaterThan(0);
  });

  it('keeps the full render below minRows (small tables are byte-identical to the non-virtual path)', () => {
    const { container } = render(<Host rows={makeRows(50)} minRows={100} />);

    expect(container.querySelectorAll('tbody tr[data-row-id]').length).toBe(50);
    expect(container.querySelectorAll('tr[data-slot="data-grid-table-dnd-virtual-spacer"]').length).toBe(0);
  });

  it('moves the window when the scroll element reports a new offset', async () => {
    const { container } = render(<Host rows={makeRows(500)} />);

    await waitFor(() => {
      expect(mountedRowIndexes(container).length).toBeGreaterThan(0);
    });

    // Offset 4000 over 38px rows lands near index 105. jsdom has no layout,
    // so the scroll event is fired manually after setting scrollTop - the
    // virtualizer's handler reads scrollTop directly.
    const scrollEl = container.querySelector<HTMLElement>('[data-testid="dt-virtual-scroll"]')!;
    scrollEl.scrollTop = 4000;
    fireEvent.scroll(scrollEl);

    await waitFor(() => {
      const mounted = mountedRowIndexes(container);
      expect(mounted).toContain(105);
      expect(mounted[0]).toBeGreaterThan(80);
    });
  });

  it('restores data-index on plain rows (scroll API locator, lost in the data-grid retrofit)', () => {
    const { container } = render(<Host rows={makeRows(50)} minRows={100} />);

    const first = container.querySelector('tbody tr[data-row-id]');
    expect(first?.getAttribute('data-index')).toBe('0');
  });
});

describe('keepDataGridDndIndexInRange', () => {
  const range = { startIndex: 10, endIndex: 20, overscan: 8, count: 500 };
  const extract = ({
    startIndex,
    endIndex,
  }: {
    startIndex: number;
    endIndex: number;
    overscan: number;
    count: number;
  }) => Array.from({ length: endIndex - startIndex + 1 }, (_, i) => startIndex + i);

  it('keeps a carried row mounted even when the window has scrolled past it', () => {
    const next = keepDataGridDndIndexInRange(range, extract, 200);
    expect(next).toContain(200);
    expect([...next].sort((a, b) => a - b)).toEqual(next);
  });

  it('is a no-op when the carried row is already inside the window', () => {
    expect(keepDataGridDndIndexInRange(range, extract, 15)).toEqual(extract(range));
  });

  it('is a no-op when nothing is carried', () => {
    expect(keepDataGridDndIndexInRange(range, extract, null)).toEqual(extract(range));
  });
});
