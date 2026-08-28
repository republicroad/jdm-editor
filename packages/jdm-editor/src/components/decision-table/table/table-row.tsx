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
        'relative w-fit min-h-[36px]',
        "after:content-[''] after:absolute after:left-0 after:right-0 after:bg-[var(--primary)]",
        isOver && direction === 'down' && 'after:bottom-0 after:h-[2px]',
        isOver && direction === 'up' && 'after:top-0 after:h-[2px]',
        !diffStatus && isActive && 'bg-[var(--grl-color-success-bg)]',
        !diffStatus &&
          disabled &&
          'bg-black/[0.02] [&_[contenteditable]]:bg-transparent [&_[contenteditable]]:text-[var(--muted-foreground)]',
        !diffStatus && cursor?.y === virtualItem.index && !disabled && 'selected bg-[var(--grl-color-primary-bg-fade)] [&>td:first-of-type]:bg-[var(--grl-color-primary-bg-fade)]',
        diffStatus === 'added' && 'bg-[var(--grl-color-success-bg)]',
        diffStatus === 'removed' && 'bg-[var(--grl-color-error-bg)]',
      )}
      style={{
        opacity: isDragging ? 0.5 : 1,
      }}
      data-virtual-index={virtualItem.index}
    >
      <td
        className={clsx(
          'py-[2px] px-[14px] shadow-[inset_0_0_0_0.3px_var(--border)] outline-[1.5px] outline-transparent -outline-offset-[1.5px]',
          diffStatus ? 'bg-transparent!' : 'bg-[var(--table-color)]!',
          !disabled && 'cursor-grab',
        )}
        ref={disabled ? undefined : setActivatorNodeRef}
        {...(disabled ? {} : listeners)}
        {...attributes}
        onContextMenuCapture={() => tableActions.setCursor({ x: 'id', y: virtualItem.index })}
      >
        <div className='w-full h-full flex items-start justify-end pt-[6px]'>
          <Typography>{virtualItem.index + 1}</Typography>
        </div>
      </td>
      {row.getVisibleCells().map((cell) => (
        <td
          key={cell.id}
          className={clsx(
            'min-h-[36px] p-0 outline-[1.5px] outline-transparent -outline-offset-[1.5px] shadow-[inset_0_0_0_0.3px_var(--border)]',
            !disabled && cursor?.x === cell.column.id && cursor?.y === virtualItem.index && 'outline-[var(--border)]',
            diff?.fields?.[cell?.column?.id]?.status === 'modified' && 'bg-[var(--grl-color-warning-bg)]',
            diff?.fields?.[cell?.column?.id]?.status === 'added' && 'bg-[var(--grl-color-success-bg)]',
            diff?.fields?.[cell?.column?.id]?.status === 'removed' && 'bg-[var(--grl-color-error-bg)]',
          )}
          style={{ width: cell.column.getSize() }}
        >
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </td>
      ))}
    </tr>
  );
};
