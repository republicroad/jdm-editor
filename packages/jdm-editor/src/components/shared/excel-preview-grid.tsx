import { DataGrid, type DataGridFeatures, dataGridFeatures } from '#reui/data-grid/data-grid';
import { DataGridScrollArea } from '#reui/data-grid/data-grid-scroll-area';
import { DataGridTableVirtual } from '#reui/data-grid/data-grid-table-virtual';
import type { ColumnDef, SortingState } from '@tanstack/react-table';
import { useTable } from '@tanstack/react-table';
import React, { useMemo, useState } from 'react';

import type { ParsedExcelData } from '../../helpers/excel';

/**
 * WS2-B3：导入数据只读预览。
 *
 * 此前两个 Excel 对话框都在用户看不到实际数据行的情况下映射列名；
 * 该预览用 vendored data-grid 的行虚拟化直接铺出 sheet 数据（万行级不卡顿），
 * 表头排序可用。行数据从 RuleData[]（headerId→value 对）预转对象数组，
 * 列即 sheet 表头。
 */
export const ExcelPreviewGrid: React.FC<{ sheet: ParsedExcelData; height?: number }> = ({ sheet, height = 240 }) => {
  const [sorting, setSorting] = useState<SortingState>([]);

  const rows = useMemo<Record<string, string | undefined>[]>(
    () => sheet.rules.map((rule) => Object.fromEntries(rule.map((r) => [r.headerId, r.value]))),
    [sheet.rules],
  );

  const columns = useMemo<ColumnDef<DataGridFeatures, Record<string, string | undefined>>[]>(
    () =>
      sheet.headers.map((header) => ({
        accessorKey: header.id,
        id: header.id,
        header: header.name || header.value || header.id,
        size: 130,
      })),
    [sheet.headers],
  );

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    state: { sorting },
    onSortingChange: setSorting,
  });

  return (
    <div style={{ height }}>
      <DataGrid table={table} recordCount={rows.length}>
        <DataGridScrollArea className='h-full rounded-lg border border-[var(--border)]'>
          <DataGridTableVirtual estimateSize={36} />
        </DataGridScrollArea>
      </DataGrid>
    </div>
  );
};
