import { DeleteOutlined } from '#icons';
import type { VariableType } from '@gorules/zen-engine-wasm';
import { Handle, Position } from '@xyflow/react';
import clsx from 'clsx';
import React, { useLayoutEffect, useState } from 'react';

import { useT } from '../../../../../theming/i18n';
import { Button } from '../../../../primitives';
import { DiffCodeEditor } from '../../../../shared/diff-ce';
import type { DiffMetadata } from '../../../dg-types';

const useSyncedValue = (value: string | undefined): [string | undefined, (val: string) => void] => {
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
  name?: string;
  isDefault?: boolean;
  diff?: DiffMetadata;
  onChange?: (value: string) => void;
  onNameChange?: (name: string) => void;
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
  name,
  diff,
  onChange,
  onNameChange,
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
  const t = useT();
  const [inner, setInner] = useSyncedValue(value);
  const [nameInner, setNameInner] = useSyncedValue(name);
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
        'group/con',
        isActive && 'bg-[var(--seal-color-success-bg)]',
        diff?.status === 'added' && 'bg-[var(--seal-color-success-bg)]',
        diff?.status === 'modified' && 'bg-[var(--seal-color-warning-bg)]',
        diff?.status === 'removed' && 'bg-[var(--seal-color-error-bg)]',
      )}
    >
      <div className={clsx('relative flex flex-row px-(--node-horizontal-padding) py-1')}>
        {(index === 0 || hitPolicy === 'collect') && (
          <Button disabled={disabled} className={clsx('text-xs font-medium')} size={'small'} type={'text'}>
            If
          </Button>
        )}
        {hitPolicy !== 'collect' && index > 0 && (
          <Button
            className={clsx('text-xs font-medium', isElse && 'text-[var(--seal-color-text-disabled)]')}
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
            className={clsx('text-xs font-medium', !isElse && 'text-[var(--seal-color-text-disabled)]')}
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
        {/* WS1-R4 增强：case 名输入——联动出边 edge.name（分支路径标签芯片） */}
        {!disabled && (
          <input
            aria-label={t('dg.condition.namePlaceholder')}
            data-slot='switch-statement-name'
            className='mr-1 h-5 w-24 rounded-sm border border-transparent bg-transparent px-1 text-right text-xs outline-none placeholder:text-[var(--seal-color-text-disabled)] focus:border-[var(--border)]'
            placeholder={t('dg.condition.namePlaceholder')}
            value={nameInner ?? ''}
            disabled={disabled}
            onChange={(e) => {
              setNameInner(e.target.value);
              onNameChange?.(e.target.value);
            }}
          />
        )}
        {!disabled && configurable && (
          <Button
            className='text-[var(--seal-color-text-disabled)] opacity-0 transition-opacity group-hover/con:opacity-100'
            size='small'
            type='text'
            icon={<DeleteOutlined />}
            onClick={() => onDelete?.()}
          />
        )}
        <Handle
          id={id}
          type='source'
          position={Position.Right}
          className={clsx(isActive && 'border-[var(--seal-color-success)]! bg-[var(--seal-color-success-bg)]!')}
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
  name?: string;
  isDefault?: boolean;
  diff?: DiffMetadata;
  onChange?: (value: string) => void;
  onNameChange?: (name: string) => void;
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
  name,
  diff,
  onChange,
  onNameChange,
  disabled,
  configurable = true,
  onDelete,
  isActive,
  variableType,
}) => {
  const t = useT();
  const [inner, setInner] = useSyncedValue(value);
  const [nameInner, setNameInner] = useSyncedValue(name);
  const handleChange = (val: string) => {
    setInner(val);
    onChange?.(val);
  };

  return (
    <div
      className={clsx(
        'group/con',
        isActive && 'bg-[var(--seal-color-success-bg)]',
        diff?.status === 'added' && 'bg-[var(--seal-color-success-bg)]',
        diff?.status === 'modified' && 'bg-[var(--seal-color-warning-bg)]',
        diff?.status === 'removed' && 'bg-[var(--seal-color-error-bg)]',
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
      {/* WS1-R4 增强：case 名输入——联动出边 edge.name（分支路径标签芯片） */}
      {!disabled && (
        <input
          aria-label={t('dg.condition.namePlaceholder')}
          data-slot='switch-statement-name'
          className='mx-[10px] mb-1 h-5 w-24 rounded-sm border border-transparent bg-transparent px-1 text-xs outline-none placeholder:text-[var(--seal-color-text-disabled)] focus:border-[var(--border)]'
          placeholder={t('dg.condition.namePlaceholder')}
          value={nameInner ?? ''}
          disabled={disabled}
          onChange={(e) => {
            setNameInner(e.target.value);
            onNameChange?.(e.target.value);
          }}
        />
      )}
      {!disabled && configurable && (
        <div className='absolute right-3.5 top-2.5'>
          <Button
            className='text-[var(--seal-color-text-disabled)] opacity-0 transition-opacity group-hover/con:opacity-100'
            size='small'
            type='text'
            icon={<DeleteOutlined />}
            onClick={() => onDelete?.()}
          />
        </div>
      )}
      <Handle
        id={id}
        type='source'
        position={Position.Right}
        className={clsx(isActive && 'border-[var(--seal-color-success)]! bg-[var(--seal-color-success-bg)]!')}
      />
    </div>
  );
};
