import { PlusCircleOutlined, TableColumnsOutlined } from '#icons';
import { DataGrid, dataGridFeatures } from '#reui/data-grid/data-grid';
import { DataGridCellSelection } from '#reui/data-grid/data-grid-cell-selection';
import { DataGridColumnVisibility } from '#reui/data-grid/data-grid-column-visibility';
import { DataGridTableDndRowHandle, DataGridTableDndRows } from '#reui/data-grid/data-grid-table-dnd-rows';
import type { DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import type { CellSelectionState, ColumnDef } from '@tanstack/react-table';
import { useTable } from '@tanstack/react-table';
import type { Virtualizer } from '@tanstack/react-virtual';
import clsx from 'clsx';
import equal from 'fast-deep-equal/es6/react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { P, match } from 'ts-pattern';
import { z } from 'zod';

import { setRefValue } from '../../../helpers/compose-refs';
import { useThemeMode } from '../../../theme';
import { useT } from '../../../theming/i18n';
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

// WS1 填缝（backlog：dt 解锁候选——列显隐）：列显隐持久化，键沿用遗留 jdm-editor
// 前缀（用户数据键不改名的既定纪律）。
const columnVisibilityKey = (id: string) => `jdm-editor:decisionTable:columnVisibility:${id}`;

const loadColumnVisibility = (id?: string): Record<string, boolean> => {
  if (!id) {
    return {};
  }

  try {
    const data = localStorage.getItem(columnVisibilityKey(id));
    return z.record(z.string(), z.boolean()).parse(JSON.parse(data ?? '{}'));
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
  const t = useT();
  const tableActions = useDecisionTableActions();

  const { cellRenderer } = useDecisionTableListeners(({ cellRenderer }) => ({ cellRenderer }));
  const [columnSizing, setColumnSizing] = useState<ColumnSizing>(() => loadColumnSizing(id));
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => loadColumnVisibility(id));

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

  // A' 单格聚焦（Phase 2 备选立项）：grid 焦点经受控 cellSelection 桥接回
  // dt cursor——命令栏/快捷键的行级操作契约零改动。本 fork 的 tanstack 里
  // 传 onCellSelectionChange 即外部接管态，必须同时持有 state 才会生效，
  // 故走受控模式（state + onCellSelectionChange 直通）。single 模式无范围/
  // 剪贴板/内置编辑器（dt 列未声明 meta.cellEdit，编辑仍走自家控件），
  // CodeMirror 与格内输入由控制器的事件过滤器天然让位。
  const [cellSelection, setCellSelection] = useState<CellSelectionState>([]);

  const table = useTable({
    data: rules,
    features: dtTableFeatures,
    // 全量行渲染（grid DndRows 渲染路径不认分页）：manualPagination 跳过
    // rowPagination 的 10 行默认页，否则 10000 行表只能见第一页（Phase 3 回归）。
    manualPagination: true,
    columnResizeMode: 'onChange',
    getRowId: (row) => row._id,
    columns,
    defaultColumn: {
      cell: (context) => <TableDefaultCell context={context} />,
    },
    meta: {
      getCell: cellRenderer,
    },
    state: {
      cellSelection,
      ...(id ? { columnSizing, columnVisibility } : {}),
    },
    onCellSelectionChange: setCellSelection,
    initialState: { columnVisibility: loadColumnVisibility(id) },
    ...(id
      ? {
          onColumnSizingChange: setColumnSizing,
          onColumnVisibilityChange: setColumnVisibility,
        }
      : {}),
  });

  // 焦点→cursor 桥接：'__index' 伪列映射为 cursor 惯用的 'id'（行级操作
  // 定位语义）；无变化不写。焦点视觉复用既有 cursor 格描边，无新增样式。
  useEffect(() => {
    const range = cellSelection[cellSelection.length - 1];
    if (!range) return;
    const row = table.getRow(range.focusRowId);
    if (!row) return;
    const x = range.focusColumnId === '__index' ? ('id' as const) : range.focusColumnId;
    if (cursor?.y !== row.index || cursor?.x !== x) {
      tableActions.setCursor({ x, y: row.index });
    }
  }, [cellSelection, table, cursor?.x, cursor?.y, tableActions]);

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
  // 字段级 diff 着色 + cursor 格描边（旧 TableRow td 语义的 cell 级移植）
  const getCellClassName = useCallback(
    (rowOriginal: any, columnId: string, rowIndex: number | undefined) => {
      const fieldStatus = rowOriginal?._diff?.fields?.[columnId]?.status;
      return clsx(
        fieldStatus === 'modified' && 'bg-[var(--seal-color-warning-bg)]',
        fieldStatus === 'added' && 'bg-[var(--seal-color-success-bg)]',
        fieldStatus === 'removed' && 'bg-[var(--seal-color-error-bg)]',
        !disabled &&
          cursor?.x === columnId &&
          cursor?.y === rowIndex &&
          'outline-[var(--border)] outline-1 -outline-offset-1',
      );
    },
    [cursor?.x, cursor?.y, disabled],
  );

  const tableContainerRef = React.useRef<HTMLDivElement | null>(null);
  // 大表虚拟化（backlog：dt 换装解锁候选）：DndRows 表体窗口化。≤minRows 行保持
  // 全量渲染（绝大多数决策表 + 全部快照/交互用例路径零变化），≥minRows 才挂
  // 虚拟窗口。38px 与旧手搓虚拟表的 estimateSize 一致。
  const virtualizerRef = React.useRef<Virtualizer<HTMLElement, HTMLTableRowElement> | null>(null);
  const virtualConfig = React.useMemo(
    () => ({ estimateSize: 38, overscan: 8, minRows: 100, scrollElementRef: tableContainerRef }),
    [],
  );

  useEffect(() => {
    if (!id) {
      return;
    }

    setColumnSizing(loadColumnSizing(id));
    setColumnVisibility(loadColumnVisibility(id));
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    localStorage.setItem(columnSizeKey(id), JSON.stringify(columnSizing));
  }, [columnSizing]);

  useEffect(() => {
    if (!id) {
      return;
    }

    localStorage.setItem(columnVisibilityKey(id), JSON.stringify(columnVisibility));
  }, [columnVisibility]);

  // scrollApiRef：虚拟化时走虚拟器（窗口外无 DOM，几何查询自然失效）；小表
  // （<minRows，未虚拟化）保持 DOM 几何路径。sticky 表头占位在两处显式补偿。
  useEffect(() => {
    if (!scrollApiRef) return;
    const headerHeight = () => tableContainerRef.current?.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const topOfRow = (index: number): number | null => {
      const el = tableContainerRef.current;
      const row = el?.querySelector<HTMLElement>(`[data-index="${index}"]`);
      if (!el || !row) return null;
      return row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop;
    };
    setRefValue(scrollApiRef, {
      getTopRowIndex: () => {
        const el = tableContainerRef.current;
        if (!el) return 0;
        const virtualizer = virtualizerRef.current;
        if (virtualizer) {
          return virtualizer.getVirtualItemForOffset(Math.max(0, el.scrollTop - headerHeight()))?.index ?? 0;
        }
        let top = 0;
        for (const row of el.querySelectorAll<HTMLElement>('[data-index]')) {
          const index = Number(row.dataset.index);
          if (!Number.isFinite(index)) continue;
          if (row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop > el.scrollTop) break;
          top = index;
        }
        return top;
      },
      scrollToRowIndex: (index) => {
        const virtualizer = virtualizerRef.current;
        if (virtualizer) {
          // 第一段：虚拟器按估值落点；第二段：行挂载后按真实几何补偿
          // sticky 表头与动态行高的残余偏差（估值 ≠ 实测时的兜底）。
          virtualizer.scrollToIndex(index, { align: 'start' });
          requestAnimationFrame(() =>
            requestAnimationFrame(() => {
              const el = tableContainerRef.current;
              const top = topOfRow(index);
              if (!el || top == null) return;
              const delta = top - el.scrollTop - headerHeight();
              if (Math.abs(delta) > 1) {
                el.scrollBy({ top: delta });
              }
            }),
          );
          return;
        }
        const el = tableContainerRef.current;
        const top = topOfRow(index);
        if (el && top != null) {
          el.scrollTo({ top: top - headerHeight(), behavior: 'smooth' });
        }
      },
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
      // 编辑控件内的事件让位（Word 删除词、输入导航等原生语义优先）
      if ((e.target as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable]')) {
        return;
      }

      // A' 之后的方向键约定：plain=焦点移动（grid），Ctrl/⌘+方向=边缘跳转
      // （grid），Alt+方向/⌫=插删行（本处，grid 已让位 altKey）——原先的
      // ⌘+方向插删行与 grid 边缘跳转撞车，收敛为 Alt-only。
      if (e.code === 'ArrowUp' && e.altKey) {
        const y = cursor?.y;
        if (y != null) tableActions.addRowAbove(y);
      }
      if (e.code === 'ArrowDown' && e.altKey) {
        const y = cursor?.y;
        if (y != null) tableActions.addRowBelow(y);
      }
      if (e.code === 'Backspace' && e.altKey) {
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
        getCellClassName={getCellClassName}
        i18n={{ labels: { toggleColumns: t('dt.toolbar.toggleColumns') } }}
        tableLayout={{
          columnsResizable: true,
          rowBorder: false,
          cellBorder: true,
          stripped: false,
          rowsDraggable: true,
          headerSticky: true,
          // A'：单格聚焦——方向键格间导航 + aria 焦点跟踪；范围/填充/剪贴板/
          // 内置编辑器全不启用（cellEditMode 缺省 dblclick 且列无 cellEdit，
          // 双击编辑仍走 dt 自家控件）
          cellSelection: true,
          cellSelectionMode: 'single',
        }}
      >
        <TableContextMenu>
          {/* SPIKE 取舍已收口（backlog dt 解锁候选）：DndRows（行拖拽）与 Virtual
              （虚拟化）经 vendored 增强共存——虚拟化下沉进 DndRows 表体，≥minRows
              行窗口化渲染，拖拽/悬停钮/右键/列显隐路径不变。 */}
          <DataGridTableDndRows
            handleDragEnd={handleDragEnd}
            dataIds={dataIds}
            virtual={virtualConfig}
            virtualizerRef={virtualizerRef}
          />
        </TableContextMenu>
        {/* 单格聚焦控制器：键盘导航开启，剪贴板关闭（dt 无 onCellsChange 契约） */}
        <DataGridCellSelection clipboard={false} />
        <div className='sticky bottom-0 flex items-center gap-3 bg-[var(--card)] p-2'>
          <DataGridColumnVisibility
            table={table}
            onColumnVisibilityChange={(visibility) => {
              if (id) {
                localStorage.setItem(columnVisibilityKey(id), JSON.stringify(visibility));
              }
            }}
            trigger={
              <Button
                type='text'
                disabled={disabled}
                icon={<TableColumnsOutlined />}
                aria-label={t('dt.toolbar.toggleColumns')}
              />
            }
          />
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
