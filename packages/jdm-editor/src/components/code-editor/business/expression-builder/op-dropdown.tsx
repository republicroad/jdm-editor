import { SquareFunctionIcon } from 'lucide-react';
import React, { useState } from 'react';
import clsx from 'clsx';

import { Popover } from '../../../primitives';
import {
  GRID_OPS,
  OPS_BY_KIND,
  VALUE_KINDS,
  getOp,
  type OperatorType,
  type ValueKind,
} from './constants';
import { OpIcon } from './op-icon';

export type OpDropdownProps = {
  kind: ValueKind;
  operator: OperatorType;
  isCustom?: boolean;
  onSelect: (op: OperatorType) => void;
  onKindChange?: (kind: ValueKind) => void;
  onCustomToggle?: () => void;
  disabled?: boolean;
};

export const OpDropdown: React.FC<OpDropdownProps> = ({
  kind,
  operator,
  isCustom,
  onSelect,
  onKindChange,
  onCustomToggle,
  disabled,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const grid = GRID_OPS[kind].map(getOp);
  const list = OPS_BY_KIND[kind].filter((t) => !GRID_OPS[kind].includes(t)).map(getOp);
  const filtered = list.filter((o) => !search || o.label.toLowerCase().includes(search.toLowerCase()));

  const pick = (t: OperatorType) => {
    onSelect(t);
    setOpen(false);
    setSearch('');
  };

  const content = (
    <div
      className='bg-popover'
      style={{ '--bg-light': 'var(--muted)', '--bg-active': 'var(--grl-color-primary-bg)', '--color-active-text': 'var(--primary)' } as React.CSSProperties}
    >
      {onKindChange && (
        <div className='flex gap-1.5 border-b border-border p-2'>
          {VALUE_KINDS.map((t) => (
            <button
              key={t.kind}
              className={clsx(
                'cursor-pointer rounded-md border-0 bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                t.kind === kind && 'bg-[var(--bg-active)] text-[var(--color-active-text)] hover:bg-[var(--bg-active)] hover:text-[var(--color-active-text)]',
              )}
              onClick={() => onKindChange(t.kind)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div className='flex'>
        <div className='grid shrink-0 grid-cols-2 gap-1.5 p-2.5'>
          {grid.map((o) => {
            const isSel = o.type === operator && !isCustom;
            return (
              <button
                key={o.type}
                className={clsx(
                  'flex h-[72px] w-[92px] cursor-pointer flex-col items-center justify-center rounded-xl border border-border bg-card transition-all hover:border-[var(--grl-color-primary-border)] hover:bg-[var(--bg-active)]',
                  isSel && 'border-[var(--grl-color-primary-border)] bg-[var(--bg-active)]',
                )}
                onClick={() => pick(o.type)}
              >
                <OpIcon op={o} size={20} className={clsx('mb-1 text-foreground', isSel && 'text-[var(--color-active-text)]')} />
                <span className={clsx('text-[11px] text-muted-foreground', isSel && 'font-medium text-[var(--color-active-text)]')}>{o.label}</span>
              </button>
            );
          })}
          {onCustomToggle && (
            <button
              className={clsx(
                'col-span-2 flex h-12 w-auto cursor-pointer flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card transition-all hover:border-[var(--grl-color-primary-border)] hover:bg-[var(--bg-active)]',
                isCustom && 'border-[var(--grl-color-primary-border)] bg-[var(--bg-active)]',
              )}
              onClick={() => {
                onCustomToggle();
                setOpen(false);
              }}
            >
              <SquareFunctionIcon size={20} className='mb-0 text-foreground' />
              <span className='text-[11px] text-muted-foreground'>custom</span>
            </button>
          )}
        </div>
        {list.length > 0 && (
          <div className='flex min-w-[170px] flex-1 flex-col border-l border-border bg-muted/40 p-2.5'>
            <input
              className='mb-1.5 w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring/30'
              placeholder='Search...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className='flex max-h-[208px] flex-col gap-0.5 overflow-y-auto'>
              {filtered.map((o) => {
                const isSel = o.type === operator && !isCustom;
                return (
                  <button
                    key={o.type}
                    className={clsx(
                      'flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2 py-1.5 text-left transition-colors hover:bg-accent',
                      isSel && 'bg-[var(--bg-active)]',
                    )}
                    onClick={() => pick(o.type)}
                  >
                    <OpIcon
                      op={o}
                      size={16}
                      className={clsx('w-5 shrink-0 text-muted-foreground', isSel && 'text-[var(--color-active-text)]')}
                    />
                    <span className={clsx('text-xs text-foreground', isSel && 'font-medium text-[var(--color-active-text)]')}>{o.label}</span>
                  </button>
                );
              })}
              {!filtered.length && <div className='p-3 text-center text-xs text-muted-foreground'>No matches</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger='click'
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSearch('');
      }}
      placement='bottomLeft'
      arrow={false}
    >
      <button
        className='inline-flex cursor-pointer items-center justify-center rounded-md border-0 bg-muted px-2 text-[13px] text-muted-foreground transition-colors min-h-[var(--b-height)] min-w-[26px] enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50'
        disabled={disabled}
      >
        {isCustom ? <SquareFunctionIcon size={14} /> : <OpIcon op={getOp(operator)} size={14} />}
      </button>
    </Popover>
  );
};
