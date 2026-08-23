import type { Row } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import type { VirtualItem } from '@tanstack/react-virtual';
import { Typography } from '../../primitives';
import { useDraggable, useDroppable, useDndContext } from '@dnd-kit/core';
import clsx from 'clsx';
import React, { useEffect, useRef } from 'react';
import { P, match } from 'ts-pattern';

import { composeRefs } from '../../../helpers/compose-refs';
import { getDropDirection } from '../../../helpers/dnd';
import type { DiffMetadata } from '../../decision-graph';
import { useDecisionTableActions, useDecisionTableState } from '../context/dt-store.context';

export const TableRow: React.FC<{
  ref?: React.Ref<HTMLTableRowElement>;
  row: Row<Record<string, string>>;
  disabled?: boolean;
  virtualItem: VirtualItem;
  onResize?: (node: HTMLElement) => void;
}> = ({ ref, row, disabled, virtualItem, onResize }) => {
  const trRef = useRef<HTMLTableRowElement>(null);
  const tableActions = useDecisionTableActions();
  const { cursor, isActive } = useDecisionTableState(({ cursor, debug, debugIndex }) => ({
    cursor,
    isActive: match(debug?.trace.traceData)
      .with(P.array(), (t) => t?.[debugIndex]?.rule?._id === row.id)
      .otherwise((t) => t?.rule?._id === row.id),
  }));

  const {
    attributes,
    listeners,
    setNodeRef: setDragNodeRef,
    setActivatorNodeRef,
    isDragging,
  } = useDraggable({
    id: `dtrow-${row.id}`,
    data: { index: row.index },
    disabled: !!disabled,
  });

  const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
    id: `dtrow-drop-${row.id}`,
    data: { index: row.index },
  });

  const dndContext = useDndContext();
  const direction = isOver
    ? getDropDirection(dndContext.active?.rect.current.translated, trRef.current?.getBoundingClientRect())
    : 'up';

  useEffect(() => {
    if (!trRef.current) {
      return;
    }

    onResize?.(trRef.current);
    const resizeObserver = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.target.hasAttribute('data-virtual-index')) {
          return;
        }
        // Skip 0-height measurements from display:none (tab hidden) to avoid
        // the virtualizer caching incorrect sizes and causing a layout jump on return.
        if (entry.contentRect.height === 0) {
          return;
        }

        onResize?.(entry.target as HTMLElement);
      });
    });

    resizeObserver.observe(trRef.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const diff = useDecisionTableState(({ decisionTable }) => {
    if (!decisionTable._diff) {
      return undefined;
    }

    return decisionTable.rules.find((r) => r._id === row.original._id)?._diff as DiffMetadata | undefined;
  });

  const diffStatus = diff?.status;

  return (
    <tr
      ref={composeRefs(
        trRef,
        ref,
        setDropNodeRef as React.Ref<HTMLTableRowElement>,
        setDragNodeRef as React.Ref<HTMLTableRowElement>,
      )}
      className={clsx(
        'table-row',
        isOver && direction === 'down' && 'dropping-down',
        isOver && direction === 'up' && 'dropping-up',
        !diffStatus && isActive && 'active',
        !diffStatus && disabled && 'disabled',
        !diffStatus && cursor?.y === virtualItem.index && !disabled && 'selected',
        diffStatus && `diff-${diffStatus}`,
      )}
      style={{
        opacity: isDragging ? 0.5 : 1,
      }}
      data-virtual-index={virtualItem.index}
    >
      <td
        className={clsx('sort-handler', !disabled && 'draggable', diffStatus && 'diff')}
        ref={disabled ? undefined : setActivatorNodeRef}
        {...(disabled ? {} : listeners)}
        {...attributes}
        onContextMenuCapture={() => tableActions.setCursor({ x: 'id', y: virtualItem.index })}
      >
        <div className={'text'}>
          <Typography>{virtualItem.index + 1}</Typography>
        </div>
      </td>
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className={clsx(
            !disabled && cursor?.x === cell.column.id && cursor?.y === virtualItem.index && 'selected',
            diff?.fields?.[cell?.column?.id]?.status && `diff-${diff?.fields?.[cell?.column?.id]?.status}`,
          )}
          style={{ width: cell.column.getSize() }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
};
