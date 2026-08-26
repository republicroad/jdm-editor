import { Button, Popover } from '../../primitives';
import clsx from 'clsx';
import { ChevronDownIcon } from 'lucide-react';
import React from 'react';

import { ConfirmAction } from '../../confirm-action';

type FieldEditPopoverProps = {
  value?: string;
  onSubmit: () => void;
  onRemove?: () => void;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName?: string;
  children: React.ReactNode;
  mode?: 'edit' | 'create';
  trigger?: React.ReactNode;
};

export const FieldEditPopover: React.FC<FieldEditPopoverProps> = ({
  value,
  onSubmit,
  onRemove,
  disabled,
  open,
  onOpenChange,
  triggerClassName,
  children,
  mode = 'edit',
  trigger,
}) => (
  <Popover
      placement='bottomLeft'
      trigger={['click']}
      destroyTooltipOnHide
      arrow={false}
      open={open}
      onOpenChange={onOpenChange}
      content={
        <div
          className='w-[340px] space-y-3 p-3'
          data-simulation='propagateWithTimeout'
          onKeyDownCapture={(e) => {
            const isSubmit = (e.ctrlKey || e.metaKey) && e.key === 'Enter';
            const isCancel = e.key === 'Escape';
            if (!isSubmit && !isCancel) return;

            e.preventDefault();
            e.stopPropagation();
            onOpenChange(false);
            if (!disabled && isSubmit) onSubmit();
          }}
        >
          {children}
          <div
            className={clsx(
              'flex w-full items-center gap-2 pt-1',
              mode === 'create' ? 'justify-end' : 'justify-between',
            )}
          >
            {mode === 'edit' && <ConfirmAction iconOnly onConfirm={onRemove} disabled={disabled} />}
            <div className='ml-auto flex items-center gap-2'>
              <Button size='small' type='text' onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button size='small' type='primary' disabled={disabled} onClick={onSubmit}>
                {mode === 'create' ? 'Create' : 'Update'}
              </Button>
            </div>
          </div>
        </div>
      }
    >
      {trigger ?? (
        <span
          className={clsx(
            'mt-0.5 inline-flex max-w-full cursor-pointer select-none items-center gap-1.5 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary transition-colors hover:border-primary/40 aria-disabled:cursor-not-allowed aria-disabled:opacity-50',
            triggerClassName,
          )}
          onClick={() => onOpenChange(!open)}
        >
          <span className='size-1.5 shrink-0 rounded-full bg-current' />
          <span className='truncate'>{value || '-'}</span>
          <ChevronDownIcon size={12} className='shrink-0 opacity-60' />
        </span>
      )}
    </Popover>
  );
