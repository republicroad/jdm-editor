import { PlusCircleOutlined } from '#icons';
import { DataGrid, dataGridFeatures } from '#reui/data-grid/data-grid';
import { DataGridTableDndRowHandle, DataGridTableDndRows } from '#reui/data-grid/data-grid-table-dnd-rows';
import type { DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import type { ColumnDef } from '@tanstack/react-table';
import { useTable } from '@tanstack/react-table';
import clsx from 'clsx';
import equal from 'fast-deep-equal/es6/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { P, match } from 'ts-pattern';
import { z } from 'zod';

import { setRefValue } from '../../../helpers/compose-refs';
import { useThemeMode } from '../../../theme';
import { Button, Typography } from '../../primitives';
import { useDecisionTableActions, useDecisionTableListeners, useDecisionTableState } from '../context/dt-store.context';
import { TableContextMenu } from './table-context-menu';
import { TableDefaultCell } from './table-default-cell';
import {
  TableHeadCellInput,
  TableHeadCellInputField,
  TableHeadCellOutput,
  TableHeadCellOutputField,
} from './table-head-cell';
import { TableRowHoverActions } from './table-row-hover-actions';

export type TableScrollApi = {
  getTopRowIndex: () => number;
  scrollToRowIndex: (index: number) => void;
};

export type TableProps = {
  id?: string;
  maxHeight: string | number;
  scrollContainerRef?: React.MutableRefObject<HTMLDivElement | null>;
  scrollApiRef?: React.MutableRefObject<TableScrollApi | null>;
};

type ColumnSizing = Record<string, number>;

const columnSizeKey = (id: string) => `jdm-editor:decisionTable:columns:${id}`;

const loadColumnSizing = (id?: string) => {
  if (!id) {
    return {};
  }

  try {
    const sizeData = localStorage.getItem(columnSizeKey(id));
    const jsonData = JSON.parse(sizeData ?? '{}');
    return z.record(z.string(), z.number()).parse(jsonData);
  } catch {
    return {};
  }
};

// TanStack v9 feature bundle: the grid's render path needs the full
// dataGridFeatures set (visibility gates getVisibleCells, pinning provides
// getStartVisibleLeafColumns used by the viewport, sizing owns the persisted
// width map, resizing the drag interaction). Core row models are built in.
const dtTableFeatures = dataGridFeatures;

/**
 * WS2 · 决策表核心编辑器 data-grid 换装（Phase 0 spike）。
 *
 * 列定义、受控 columnSizing（localStorage 键不动）、cellRenderer/CellViewPool
 * 契约全部保持；渲染层从手搓 StyledTable/thead/tbody/虚拟化换为 vendored
 * data-grid：行级 diff 三态走 getRowStatus，cursor/simulator-active 行高亮走
 * getRowClassName 扩展，行拖拽换 grid 原生 DndRows（落点仍是 swapRows）。
 */
const IndexCell: React.FC<{ row: { index: number; id: string } }> = ({ row }) => {
  const tableActions = useDecisionTableActions();
  const { disabled } = useDecisionTableState(({ disabled }) => ({ disabled }));
  const [hover, setHover] = useState(false);

  return (
    <div
      className='relative flex h-full min-h-[36px] select-none items-center justify-end pr-[8px]'
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onContextMenuCapture={() => tableActions.setCursor({ x: 'id', y: row.index })}
    >
      <TableRowHoverActions rowIndex={row.index} visible={hover && !disabled} disabled={disabled} />
      <DataGridTableDndRowHandle disabled={disabled} />
      <Typography>{row.index + 1}</Typography>
    </div>
  );
};

export const Table: React.FC<TableProps> = ({ id, maxHeight, scrollContainerRef, scrollApiRef }) => {
  const mode = useThemeMode();
  const tableActions = useDecisionTableActions();

  const { cellRenderer } = useDecisionTableListeners(({ cellRenderer }) => ({ cellRenderer }));
  const [columnSizing, setColumnSizing] = useState<ColumnSizing>(() => loadColumnSizing(id));

  const { permission, disabled, inputs, outputs, colWidth, minColWidth } = useDecisionTableState(
    ({ permission, disabled, minColWidth, colWidth, decisionTable }) => ({
      permission,
      disabled,
      minColWidth,
      colWidth,
      inputs: decisionTable.inputs,
      outputs: decisionTable.outputs,
    }),
  );

  // 行级高亮数据源：cursor 行 + simulator 命中行（grid 回调在渲染期读闭包，
  // 这里订阅使变更传播到整表重渲染）
  const { cursor, debug, debugIndex } = useDecisionTableState(({ cursor, debug, debugIndex }) => ({
    cursor,
    debug,
    debugIndex,
  }));
  const { rules } = useDecisionTableState(
    ({ decisionTable }) => ({
      rules: decisionTable.rules,
    }),
    (prev, curr) =>
      equal(
        prev.rules.map((i: any) => i?._id),
        curr.rules.map((i: any) => i?._id),
      ),
  );

  const activeRuleId = match(debug?.trace.traceData)
    .with(P.array(), (t) => t?.[debugIndex]?.rule?._id)
    .otherwise((t) => (t as any)?.rule?._id);

  const columns = React.useMemo<ColumnDef<any, any, any>[]>(
    () => [
      {
        id: '__index',
        header: () => null,
        cell: ({ row }) => <IndexCell row={row} />,
        size: 44,
        enableResizing: false,
        enableSorting: false,
      },
      {
        id: 'inputs',
        minSize: minColWidth,
        size: colWidth,
        enableResizing: true,
        header: () => <TableHeadCellInput permission={permission} disabled={disabled} />,
        columns: [
          ...(inputs || []).map((input: any) => {
            return {
              accessorKey: input.id,
              id: input.id,
              minSize: minColWidth,
              size: colWidth,
              header: () => <TableHeadCellInputField schema={input} permission={permission} disabled={disabled} />,
            };
          }),
        ],
      },
      {
        id: 'outputs',
        minSize: minColWidth,
        size: minColWidth,
        header: () => <TableHeadCellOutput disabled={disabled} permission={permission} />,
        columns: [
          ...(outputs || []).map((output: any) => {
            return {
              accessorKey: output.id,
              minSize: minColWidth,
              size: colWidth,
              header: () => <TableHeadCellOutputField schema={output} permission={permission} disabled={disabled} />,
            };
          }),
        ],
      },
      {
        id: '_description',
        accessorKey: '_description',
        header: () => (
          <div className='flex items-center h-full w-full min-h-0 box-border py-1 px-2'>
            <Typography.Text className='truncate seal-dt-text-primary'>Description</Typography.Text>
          </div>
        ),
        minSize: minColWidth,
        size: colWidth,
      },
    ],
    [permission, disabled, inputs, outputs, minColWidth, colWidth],
  );

  const table = useTable({
    data: rules,
    features: dtTableFeatures,
    columnResizeMode: 'onChange',
    getRowId: (row) => row._id,
    columns,
    defaultColumn: {
      cell: (context) => <TableDefaultCell context={context} />,
    },
    meta: {
      getCell: cellRenderer,
    },
    ...(!id
      ? {}
      : {
          state: { columnSizing },
          onColumnSizingChange: setColumnSizing,
        }),
  });

  // 行拖拽：grid 原生 DndRows，落点保持 swapRows 契约
  const dataIds = useMemo<UniqueIdentifier[]>(() => rules.map((r: any) => r._id), [rules]);
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (active && over && active.id !== over.id) {
        const from = dataIds.indexOf(String(active.id));
        const to = dataIds.indexOf(String(over.id));
        if (from >= 0 && to >= 0) {
          tableActions.swapRows(from, to);
        }
      }
    },
    [dataIds, tableActions],
  );

  // 行级语义（渲染期闭包读取，见上方订阅说明）
  const getRowStatus = useCallback(
    (rowOriginal: any): 'new' | 'dirty' | 'deleted' | undefined =>
      rowOriginal?._diff?.status === 'added'
        ? 'new'
        : rowOriginal?._diff?.status === 'removed'
          ? 'deleted'
          : rowOriginal?._diff?.status === 'modified'
            ? 'dirty'
            : undefined,
    [],
  );
  const getRowClassName = useCallback(
    (rowOriginal: any, dataIndex: number | undefined) =>
      clsx(
        !disabled && cursor?.y === dataIndex && 'bg-[var(--seal-color-primary-bg-fade)]!',
        !rowOriginal?._diff?.status &&
          activeRuleId &&
          rowOriginal?._id === activeRuleId &&
          'bg-[var(--seal-color-success-bg)]!',
        !rowOriginal?._diff?.status && disabled && 'bg-black/[0.02]',
      ),
    [cursor?.y, activeRuleId, disabled],
  );

  const tableContainerRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    setColumnSizing(loadColumnSizing(id));
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    localStorage.setItem(columnSizeKey(id), JSON.stringify(columnSizing));
  }, [columnSizing]);

  // scrollApiRef 近似实现：行高均值 38px（动态行高的精确换算留 Phase 1，
  // grid 虚拟器实例的透传口待评估）
  useEffect(() => {
    if (!scrollApiRef) return;
    setRefValue(scrollApiRef, {
      getTopRowIndex: () => Math.floor((tableContainerRef.current?.scrollTop ?? 0) / 38),
      scrollToRowIndex: (index) => tableContainerRef.current?.scrollTo({ top: index * 38, behavior: 'smooth' }),
    });
    return () => {
      setRefValue(scrollApiRef, null);
    };
  }, [scrollApiRef]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) {
        return;
      }

      if (e.code === 'ArrowUp' && (e.metaKey || e.altKey)) {
        const y = cursor?.y;
        if (y != null) tableActions.addRowAbove(y);
      }
      if (e.code === 'ArrowDown' && (e.metaKey || e.altKey)) {
        const y = cursor?.y;
        if (y != null) tableActions.addRowBelow(y);
      }
      if (e.code === 'Backspace' && (e.metaKey || e.altKey)) {
        const y = cursor?.y;
        if (y != null) tableActions.removeRow(y);
      }
    },
    [disabled, cursor?.y, tableActions],
  );

  return (
    <div
      ref={(el) => {
        tableContainerRef.current = el;
        setRefValue(scrollContainerRef, el);
      }}
      data-theme={mode}
      className='relative flex-1 overflow-auto'
      style={{ maxHeight, overflowY: 'auto' }}
      onKeyDown={onKeyDown}
    >
      <DataGrid
        table={table}
        recordCount={rules.length}
        getRowStatus={getRowStatus}
        getRowClassName={getRowClassName}
        tableLayout={{
          columnsResizable: true,
          rowBorder: false,
          cellBorder: true,
          stripped: false,
          rowsDraggable: true,
        }}
      >
        <TableContextMenu>
          {/* SPIKE 取舍：DndRows（行拖拽）与 Virtual（虚拟化）在 vendored 套件中不共存。
              决策表以中小规则表为主，spike 先取行拖拽；大表虚拟化留 Phase 1 定案
              （选项：a 非 Virtual 全量渲染 / b 去 Dnd 保留 Virtual / c vendored 增强）。 */}
          <DataGridTableDndRows handleDragEnd={handleDragEnd} dataIds={dataIds} />
        </TableContextMenu>
        <div className='sticky bottom-0 bg-[var(--card)] p-2'>
          <Button
            type='link'
            disabled={disabled}
            icon={<PlusCircleOutlined />}
            onClick={() => tableActions.addRowBelow()}
          >
            Add row
          </Button>
        </div>
      </DataGrid>
    </div>
  );
};
