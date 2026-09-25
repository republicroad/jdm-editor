import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined } from '#icons';
import clsx from 'clsx';
import React from 'react';

import { useT } from '../../../theming/i18n';
import { Tooltip } from '../../primitives';
import { useDecisionTableActions } from '../context/dt-store.context';

/**
 * 决策表行悬停快捷钮（业界 row hover affordances 模式）：
 * 悬停行首序号列时浮现 上插/下插/删除 三个小钮，免选中直达操作。
 * 删除走 Undo toast（免确认），见 dt-store undo。
 */
export const TableRowHoverActions: React.FC<{
  rowIndex: number;
  visible: boolean;
  disabled?: boolean;
}> = ({ rowIndex, visible, disabled }) => {
  const t = useT();
  const tableActions = useDecisionTableActions();

  if (disabled) {
    return null;
  }

  return (
    <div
      className={clsx(
        'absolute -left-0.5 top-1/2 z-10 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-[var(--border)] bg-[var(--card)] p-0.5 shadow-sm',
        'transition-opacity duration-100',
        visible ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      data-slot='dt-row-actions'
    >
      <Tooltip title={t('dt.toolbar.addRowAbove')} placement='top'>
        <button
          type='button'
          aria-label={t('dt.toolbar.addRowAbove')}
          className='flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground'
          onClick={(event) => {
            event.stopPropagation();
            tableActions.addRowAbove(rowIndex);
          }}
        >
          <ArrowUpOutlined style={{ fontSize: 11 }} />
        </button>
      </Tooltip>
      <Tooltip title={t('dt.toolbar.addRowBelow')} placement='top'>
        <button
          type='button'
          aria-label={t('dt.toolbar.addRowBelow')}
          className='flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground'
          onClick={(event) => {
            event.stopPropagation();
            tableActions.addRowBelow(rowIndex);
          }}
        >
          <ArrowDownOutlined style={{ fontSize: 11 }} />
        </button>
      </Tooltip>
      <Tooltip title={t('dt.toolbar.removeRow')} placement='top'>
        <button
          type='button'
          aria-label={t('dt.toolbar.removeRow')}
          className='flex h-5 w-5 items-center justify-center rounded-sm text-destructive hover:bg-destructive/10'
          onClick={(event) => {
            event.stopPropagation();
            tableActions.removeRowWithUndo(rowIndex);
          }}
        >
          <DeleteOutlined style={{ fontSize: 11 }} />
        </button>
      </Tooltip>
    </div>
  );
};
