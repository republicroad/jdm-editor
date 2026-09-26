import { DataGrid, DataGridContainer, type DataGridFeatures, dataGridFeatures } from '#reui/data-grid/data-grid';
import { DataGridColumnHeader } from '#reui/data-grid/data-grid-column-header';
import { DataGridPagination } from '#reui/data-grid/data-grid-pagination';
import { DataGridScrollArea } from '#reui/data-grid/data-grid-scroll-area';
import { DataGridTable } from '#reui/data-grid/data-grid-table';
import { DataGridTableDndRowHandle, DataGridTableDndRows } from '#reui/data-grid/data-grid-table-dnd-rows';
import type { DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import { useTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';
import { expect } from 'storybook/test';

/**
 * WS2 批 1 地基验证：ReUI data-grid（TanStack v9，vendored 于 src/reui/data-grid）
 * 在内核 primitives + seal 主题下渲染、排序、分页、行拖拽全部可用。
 * 批 2 将用它改造两个 Excel 导入对话框。
 */

type Person = {
  id: string;
  name: string;
  email: string;
  city: string;
  balance: number;
};

const people: Person[] = [
  { id: '1', name: 'Alex Johnson', email: 'alex@example.com', city: 'Berlin', balance: 5143.03 },
  { id: '2', name: 'Sarah Chen', email: 'sarah@example.com', city: 'Shanghai', balance: 2211.9 },
  { id: '3', name: 'Miguel Santos', email: 'miguel@example.com', city: 'Lisbon', balance: 874.5 },
  { id: '4', name: 'Yuki Tanaka', email: 'yuki@example.com', city: 'Osaka', balance: 3902.14 },
  { id: '5', name: 'Priya Sharma', email: 'priya@example.com', city: 'Pune', balance: 6410.02 },
  { id: '6', name: 'Lars Nielsen', email: 'lars@example.com', city: 'Aarhus', balance: 1122.77 },
];

const sortableColumns = (): ColumnDef<DataGridFeatures, Person>[] => [
  {
    accessorKey: 'name',
    id: 'name',
    header: ({ column }) => <DataGridColumnHeader title='Name' column={column} />,
    size: 180,
  },
  {
    accessorKey: 'email',
    id: 'email',
    header: ({ column }) => <DataGridColumnHeader title='Email' column={column} />,
    size: 220,
  },
  {
    accessorKey: 'city',
    id: 'city',
    header: ({ column }) => <DataGridColumnHeader title='City' column={column} />,
    size: 120,
  },
  {
    accessorKey: 'balance',
    id: 'balance',
    header: ({ column }) => <DataGridColumnHeader title='Balance' column={column} />,
    size: 120,
  },
];

const Meta: Meta = {
  title: 'ReUI/DataGrid',
} as never;

export const Sortable: StoryObj = {
  render: () => {
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 4 });
    const [sorting, setSorting] = useState<SortingState>([]);
    const columns = useMemo(() => sortableColumns(), []);

    const table = useTable({
      features: dataGridFeatures,
      columns,
      data: people,
      getRowId: (row: Person) => row.id,
      state: { pagination, sorting },
      onPaginationChange: setPagination,
      onSortingChange: setSorting,
    });

    return (
      <div style={{ height: '100%' }}>
        <DataGrid table={table} recordCount={people.length}>
          <div className='w-full space-y-2.5 p-4'>
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
            <DataGridPagination />
          </div>
        </DataGrid>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelector('[data-slot="data-grid"]')).not.toBeNull();
    expect(canvasElement.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  },
};

export const RowDrag: StoryObj = {
  render: () => {
    const [data, setData] = useState<Person[]>(people);
    const dataIds = useMemo<UniqueIdentifier[]>(() => data.map(({ id }) => id), [data]);
    const columns = useMemo<ColumnDef<DataGridFeatures, Person>[]>(
      () => [
        {
          id: 'drag',
          cell: () => <DataGridTableDndRowHandle />,
          size: 36,
        },
        { accessorKey: 'name', id: 'name', header: 'Name', size: 160 },
        { accessorKey: 'city', id: 'city', header: 'City', size: 120 },
        { accessorKey: 'balance', id: 'balance', header: 'Balance', size: 120 },
      ],
      [],
    );

    const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
        setData((current) => {
          const from = dataIds.indexOf(active.id);
          const to = dataIds.indexOf(over.id);
          return arrayMove(current, from, to);
        });
      }
    };

    const table = useTable({
      features: dataGridFeatures,
      columns,
      data,
      getRowId: (row: Person) => row.id,
    });

    return (
      <div style={{ height: '100%' }}>
        <DataGrid table={table} recordCount={data.length} tableLayout={{ rowsDraggable: true }}>
          <div className='w-full space-y-2.5 p-4'>
            <DataGridContainer>
              <DataGridScrollArea>
                <DataGridTableDndRows handleDragEnd={handleDragEnd} dataIds={dataIds} />
              </DataGridScrollArea>
            </DataGridContainer>
          </div>
        </DataGrid>
      </div>
    );
  },
  play: async ({ canvasElement }) => {
    expect(canvasElement.querySelectorAll('tbody tr').length).toBe(people.length);
  },
};

export default Meta;
