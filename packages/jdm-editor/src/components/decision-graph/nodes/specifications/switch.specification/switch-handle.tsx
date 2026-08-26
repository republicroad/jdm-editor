import { DeleteOutlined } from '@/icons';
import { Handle, Position } from '@xyflow/react';
import type { VariableType } from '@gorules/zen-engine-wasm';
import { Button, Popconfirm } from '../../../../primitives';
import clsx from 'clsx';
import React, { useLayoutEffect, useState } from 'react';

import type { DiffMetadata } from '../../../dg-types';
import { DiffCodeEditor } from '../../../../shared/diff-ce';

const useSyncedValue = (
  value: string | undefined,
): [string | undefined, (val: string) => void] => {
  const [inner, setInner] = useState(value);
  useLayoutEffect(() => {
    if (inner !== value) {
      setInner(value);
    }
  }, [value]);

  return [inner, setInner];
};

export const SwitchHandle: React.FC<{
  id?: string;
  value?: string;
  isDefault?: boolean;
  diff?: DiffMetadata;
  onChange?: (value: string) => void;
  onSetIsDefault?: (isDefault: boolean) => void;
  onDelete?: () => void;
  disabled?: boolean;
  isActive?: boolean;
  configurable?: boolean;
  hitPolicy: 'first' | 'collect';
  totalStatements: number;
  index: number;
  variableType?: VariableType;
}> = ({
  id,
  value,
  diff,
  onChange,
  disabled,
  configurable = true,
  onDelete,
  isActive,
  index = 0,
  isDefault = false,
  onSetIsDefault,
  totalStatements,
  hitPolicy,
  variableType,
}) => {
  const [inner, setInner] = useSyncedValue(value);
  const handleChange = (val: string) => {
    setInner(val);
    onChange?.(val);
  };

  const isLastIndex = index === totalStatements - 1;

  const isElse =
    isDefault && hitPolicy === 'first' && isLastIndex && index > 0 && (value || '')?.trim?.()?.length === 0;

  return (
    <div
      className={clsx(
        isActive && 'bg-[var(--grl-color-success-bg)]',
        diff?.status === 'added' && 'bg-[var(--grl-color-success-bg)]',
        diff?.status === 'modified' && 'bg-[var(--grl-color-warning-bg)]',
        diff?.status === 'removed' && 'bg-[var(--grl-color-error-bg)]',
      )}
    >
      <div
        className={clsx('relative flex flex-row px-(--node-horizontal-padding) py-1')}
      >
        {(index === 0 || hitPolicy === 'collect') && (
          <Button
            disabled={disabled}
            className={clsx('text-xs font-medium')}
            size={'small'}
            type={'text'}
          >
            If
          </Button>
        )}
        {hitPolicy !== 'collect' && index > 0 && (
          <Button
            className={clsx('text-xs font-medium', isElse && 'text-[var(--grl-color-text-disabled)]')}
            size={'small'}
            type={'text'}
            disabled={disabled}
            onClick={() => {
              if (isLastIndex && hitPolicy === 'first') {
                onSetIsDefault?.(false);
              }
            }}
          >
            Else If
          </Button>
        )}
        {hitPolicy !== 'collect' && index > 0 && isLastIndex && (
          <Button
            className={clsx('text-xs font-medium', !isElse && 'text-[var(--grl-color-text-disabled)]')}
            size={'small'}
            type={'text'}
            disabled={disabled}
            onClick={() => {
              if (isLastIndex && hitPolicy === 'first') {
                onSetIsDefault?.(true);
              }
            }}
          >
            Else
          </Button>
        )}
        <div
          style={{
            flexGrow: 1,
          }}
        />
        {!disabled && configurable && (
          <Popconfirm title='Remove condition?' okText='Remove' onConfirm={() => onDelete?.()}>
            <Button className='text-[var(--grl-color-text-disabled)]' size='small' type='text' icon={<DeleteOutlined />} />
          </Popconfirm>
        )}
        <Handle
          id={id}
          type='source'
          position={Position.Right}
          className={clsx(isActive && 'border-[var(--grl-color-success)]! bg-[var(--grl-color-success-bg)]!')}
        />
      </div>
      {!isElse && (
        <div className='flex px-(--node-horizontal-padding) pb-[7px] pt-0'>
          <DiffCodeEditor
            style={{
              fontSize: 12,
              lineHeight: '20px',
              width: '100%',
            }}
            displayDiff={diff?.fields?.condition?.status === 'modified'}
            previousValue={diff?.fields?.condition?.previousValue}
            value={inner}
            maxRows={4}
            disabled={disabled}
            onChange={handleChange}
            variableType={variableType}
          />
        </div>
      )}
    </div>
  );
};

export const SwitchHandleCompact: React.FC<{
  id?: string;
  value?: string;
  isDefault?: boolean;
  diff?: DiffMetadata;
  onChange?: (value: string) => void;
  onSetIsDefault?: (isDefault: boolean) => void;
  onDelete?: () => void;
  disabled?: boolean;
  isActive?: boolean;
  configurable?: boolean;
  hitPolicy: 'first' | 'collect';
  totalStatements: number;
  index: number;
  variableType?: VariableType;
}> = ({ id, value, diff, onChange, disabled, configurable = true, onDelete, isActive, variableType }) => {
  const [inner, setInner] = useSyncedValue(value);
  const handleChange = (val: string) => {
    setInner(val);
    onChange?.(val);
  };

  return (
    <div
      className={clsx(
        isActive && 'bg-[var(--grl-color-success-bg)]',
        diff?.status === 'added' && 'bg-[var(--grl-color-success-bg)]',
        diff?.status === 'modified' && 'bg-[var(--grl-color-warning-bg)]',
        diff?.status === 'removed' && 'bg-[var(--grl-color-error-bg)]',
      )}
    >
      <div className={clsx('flex p-[8px_10px] [&_.cm-editor]:pr-3.5')}>
        <DiffCodeEditor
          style={{
            fontSize: 12,
            lineHeight: '20px',
            width: '100%',
          }}
          displayDiff={diff?.fields?.condition?.status === 'modified'}
          previousValue={diff?.fields?.condition?.previousValue}
          value={inner}
          maxRows={4}
          disabled={disabled}
          onChange={handleChange}
          variableType={variableType}
        />
      </div>
      {!disabled && configurable && (
        <div className='absolute right-3.5 top-2.5'>
          <Popconfirm title='Remove condition?' okText='Remove' onConfirm={() => onDelete?.()}>
            <Button className='text-[var(--grl-color-text-disabled)]' size='small' type='text' icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      )}
      <Handle
        id={id}
        type='source'
        position={Position.Right}
        className={clsx(isActive && 'border-[var(--grl-color-success)]! bg-[var(--grl-color-success-bg)]!')}
      />
    </div>
  );
};
