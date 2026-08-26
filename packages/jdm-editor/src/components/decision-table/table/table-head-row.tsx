import type { HeaderGroup } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import clsx from 'clsx';
import React from 'react';
import { match } from 'ts-pattern';

export const TableHeadRow: React.FC<{ headerGroup: HeaderGroup<any> }> = ({ headerGroup }) => (
  <tr key={headerGroup.id}>
    <th
      colSpan={1}
      style={{ width: 72 }}
      className='h-10 box-border text-left relative font-normal shadow-[inset_0_0_0_0.3px_var(--grl-color-border)] [&_button]:text-[var(--grl-color-text-secondary)]'
    />
    {headerGroup.headers.map((header) => {
      const context = header.getContext();
      const parent = context.header.column.parent?.id;

      const parentKind = match(parent)
        .with('inputs', () => 'input')
        .with('outputs', () => 'output')
        .otherwise(() => undefined);

      const selfKind = match(context.column.id)
        .with('inputs', () => 'input')
        .with('outputs', () => 'output')
        .with('_description', () => 'description')
        .otherwise(() => undefined);

      return (
        <th
          key={header.id}
          colSpan={header.colSpan}
          data-self={selfKind}
          data-parent={parentKind}
          className={clsx(
            'h-10 box-border text-left relative font-normal bg-[var(--table-color)] shadow-[inset_0_0_0_0.3px_var(--grl-color-border)] [&_button]:text-[var(--grl-color-text-secondary)]',
            (selfKind === 'input' || selfKind === 'output') && 'text-black',
          )}
          style={
            selfKind !== 'description'
              ? {
                  width: header.getSize(),
                }
              : {
                  minWidth: header.getSize(),
                  width: '100%',
                }
          }
        >
          {!header.isPlaceholder && flexRender(header.column.columnDef.header, context)}
          {header.column.getCanResize() && (
            <div
              className={clsx(
                "absolute -right-[5px] top-0 z-[1] h-full w-[10px] cursor-col-resize select-none touch-none",
                "after:content-[''] after:mx-auto after:block after:w-[3px] after:h-full after:rounded-[3px] after:transition-all after:duration-100 hover:after:bg-[var(--grl-color-primary-hover)]",
                selfKind === 'description' && 'right-0! w-4!',
                header.column.getIsResizing() && 'isResizing',
              )}
              onMouseDown={header.getResizeHandler()}
              onTouchStart={header.getResizeHandler()}
            />
          )}
        </th>
      );
    })}
  </tr>
);
