import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '#components/ui/dropdown-menu';
import type { Table } from '@tanstack/react-table';
import type { ReactElement } from 'react';

import { getColumnHeaderLabel, useDataGrid } from './data-grid';

function DataGridColumnVisibility({
  table,
  trigger,
  onColumnVisibilityChange,
}: {
  table: Table<any, any>;
  trigger: ReactElement<Record<string, unknown>>;
  /** WS1 填缝：列显隐变化回调（全量 map），供宿主持久化 */
  onColumnVisibilityChange?: (visibility: Record<string, boolean>) => void;
}) {
  const { i18n } = useDataGrid();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger} />
      <DropdownMenuContent align='end' className='min-w-[150px]'>
        <DropdownMenuGroup>
          <DropdownMenuLabel className='font-medium'>{i18n.labels.toggleColumns}</DropdownMenuLabel>
          {table
            .getAllColumns()
            .filter((column) => column.getCanHide())
            .map((column) => {
              return (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  className='capitalize'
                  checked={column.getIsVisible()}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={(value) => {
                    const next: Record<string, boolean> = {};
                    table.getAllLeafColumns().forEach((col) => {
                      next[col.id] = col.id === column.id ? !!value : col.getIsVisible();
                    });
                    column.toggleVisibility(!!value);
                    onColumnVisibilityChange?.(next);
                  }}
                >
                  {getColumnHeaderLabel(column as unknown as Parameters<typeof getColumnHeaderLabel>[0])}
                </DropdownMenuCheckboxItem>
              );
            })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { DataGridColumnVisibility };
