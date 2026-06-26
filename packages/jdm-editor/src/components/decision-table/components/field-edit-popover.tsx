import { Button, Popover, Typography, theme } from 'antd';
import clsx from 'clsx';
import { ChevronDownIcon } from 'lucide-react';
import React from 'react';

import { ConfirmAction } from '../../confirm-action';
import { Stack } from '../../stack';
import { useTranslation } from '../../../locales';

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
}) => {
  const { token } = theme.useToken();
  const { t } = useTranslation();

  return (
    <Popover
      placement='bottomLeft'
      trigger={['click']}
      destroyTooltipOnHide
      arrow={false}
      open={open}
      onOpenChange={onOpenChange}
      content={
        <div
          style={{
            width: 300,
            maxHeight: 'calc(100vh - 320px)',
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            paddingRight: 4,
          }}
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
            className='grl-field-edit__footer'
            style={{
              position: 'sticky',
              bottom: 0,
              marginTop: 16,
              paddingTop: 8,
              background: token.colorBgElevated,
              justifyContent: mode === 'create' ? 'flex-end' : undefined,
            }}
          >
            {mode === 'edit' && (
              <ConfirmAction
                iconOnly
                onConfirm={onRemove}
                disabled={disabled}
                text={t('delete')}
                confirmText={t('confirmDelete')}
              />
            )}
            <Stack horizontal width='auto' verticalAlign='end'>
              <Button size='small' type='text' onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button size='small' type='primary' disabled={disabled} onClick={onSubmit}>
                {mode === 'create' ? t('create') : t('update')}
              </Button>
            </Stack>
          </div>
        </div>
      }
    >
      {trigger ?? (
        <Typography.Text
          type={!value ? 'secondary' : undefined}
          className={clsx('grl-field-edit', triggerClassName)}
          onClick={() => onOpenChange(!open)}
        >
          <span className='span-overflow'>{value || '-'}</span>
          <ChevronDownIcon size={12} style={{ marginLeft: 4 }} />
        </Typography.Text>
      )}
    </Popover>
  );
};
