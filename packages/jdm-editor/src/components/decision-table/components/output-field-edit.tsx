import type { InputRef } from '../../primitives';
import { Checkbox, Input, Select } from '../../primitives';
import React, { useEffect, useRef, useState } from 'react';

import { type ColumnEnum, OUTPUT_FIELD_TYPE_OPTIONS, type OutputFieldType } from '../../../helpers/schema';
import { AutosizeTextArea } from '../../autosize-text-area';
import { useDecisionTableState } from '../context/dt-store.context';
import { ENUM_MODE_OPTIONS, type EnumMode, getEnumMode, parseEnumString, serializeEnumValues } from './enum-utils';
import { FieldEditPopover } from './field-edit-popover';
import { FieldTypeTags } from './field-type-tags';

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className='mb-1.5 block text-xs font-medium text-muted-foreground'>{children}</span>
);

const getEnumFromFieldType = (ft?: OutputFieldType): ColumnEnum | undefined => {
  if (!ft) return undefined;
  if (ft.type === 'string' || ft.type === 'string-array') return ft.enum;
  return undefined;
};

type OutputFieldEditProps = {
  disabled?: boolean;
  value?: string;
  onChange?: (value: string, fieldType?: OutputFieldType) => void;
  onRemove?: () => void;
  fieldType?: OutputFieldType;
  mode?: 'edit' | 'create';
  trigger?: React.ReactNode;
  onCreate?: (name: string, field: string, outputFieldType?: OutputFieldType) => void;
};

export const OutputFieldEdit: React.FC<OutputFieldEditProps> = ({
  disabled,
  value,
  onChange,
  onRemove,
  fieldType,
  mode = 'edit',
  trigger,
  onCreate,
}) => {
  const dictionaries = useDecisionTableState((s) => s.dictionaries) ?? {};
  const uiMode = useDecisionTableState((s) => s.mode);
  const showAdvanced = uiMode === 'business';
  const [open, setOpen] = useState(false);
  const [innerName, setInnerName] = useState('');
  const [innerValue, setInnerValue] = useState(value);
  const [innerFieldType, setInnerFieldType] = useState<OutputFieldType['type']>(fieldType?.type ?? 'auto');
  const ftEnum = getEnumFromFieldType(fieldType);
  const [enumMode, setEnumMode] = useState<EnumMode>(getEnumMode(ftEnum));
  const [enumText, setEnumText] = useState(ftEnum?.type === 'inline' ? serializeEnumValues(ftEnum.values) : '');
  const [enumRef, setEnumRef] = useState(ftEnum?.type === 'ref' ? ftEnum.ref : '');
  const [enumLoose, setEnumLoose] = useState(ftEnum?.loose ?? false);
  const input = useRef<InputRef>(null);
  const nameInput = useRef<InputRef>(null);

  useEffect(() => {
    if (open) {
      if (mode === 'create') {
        setInnerName('');
        setInnerValue('');
        setInnerFieldType('auto');
        setEnumMode('none');
        setEnumText('');
        setEnumRef('');
        setEnumLoose(false);
        setTimeout(() => {
          input.current?.focus();
        });
      } else {
        setInnerValue(value);
        setInnerFieldType(fieldType?.type ?? 'auto');
        const e = getEnumFromFieldType(fieldType);
        setEnumMode(getEnumMode(e));
        setEnumText(e?.type === 'inline' ? serializeEnumValues(e.values) : '');
        setEnumRef(e?.type === 'ref' ? e.ref : '');
        setEnumLoose(e?.loose ?? false);
        if (!input.current) return;

        input.current.focus();
        input.current.select();
      }
    }
  }, [open]);

  const supportsEnum = innerFieldType === 'string' || innerFieldType === 'string-array';

  const buildOutputFieldType = (): OutputFieldType | undefined => {
    if (!showAdvanced) return fieldType?.type === 'auto' ? undefined : fieldType;
    if (innerFieldType === 'auto') return undefined;
    if (innerFieldType === 'string' || innerFieldType === 'string-array') {
      let enumConfig: ColumnEnum | undefined;
      if (enumMode === 'inline') {
        const items = parseEnumString(enumText);
        if (items.length) enumConfig = { type: 'inline', values: items, ...(enumLoose ? { loose: true } : {}) };
      } else if (enumMode === 'ref' && enumRef) {
        enumConfig = { type: 'ref', ref: enumRef, ...(enumLoose ? { loose: true } : {}) };
      }
      return { type: innerFieldType, ...(enumConfig ? { enum: enumConfig } : {}) };
    }
    return { type: innerFieldType } as OutputFieldType;
  };

  const handleSubmit = () => {
    if (mode === 'create') {
      onCreate?.(innerName || 'Output', innerValue ?? 'output', buildOutputFieldType());
    } else {
      onChange?.(innerValue ?? '', buildOutputFieldType());
    }
    setOpen(false);
  };

  return (
    <FieldEditPopover
      value={value}
      onSubmit={handleSubmit}
      onRemove={onRemove}
      disabled={disabled}
      open={open}
      onOpenChange={setOpen}
      mode={mode}
      trigger={trigger}
    >
      <div className='space-y-1.5'>
        <FieldLabel>Output Field</FieldLabel>
        <Input ref={input} value={innerValue} onChange={(e) => setInnerValue(e.target.value)} readOnly={disabled} />
      </div>
      {mode === 'create' && (
        <div className='space-y-1.5'>
          <FieldLabel>Label</FieldLabel>
          <Input
            ref={nameInput}
            value={innerName}
            onChange={(e) => setInnerName(e.target.value)}
            placeholder='Field label'
            disabled={disabled}
          />
        </div>
      )}
      {showAdvanced && (
        <div className='space-y-1.5'>
          <FieldLabel>Type</FieldLabel>
          <FieldTypeTags
            options={OUTPUT_FIELD_TYPE_OPTIONS}
            value={innerFieldType}
            onChange={setInnerFieldType}
            disabled={disabled}
          />
        </div>
      )}
      {showAdvanced && supportsEnum && (
        <div className='space-y-2'>
          <FieldLabel>Enum</FieldLabel>
          <FieldTypeTags
            options={
              Object.keys(dictionaries).length ? ENUM_MODE_OPTIONS : ENUM_MODE_OPTIONS.filter((o) => o.value !== 'ref')
            }
            value={enumMode}
            onChange={setEnumMode}
            disabled={disabled}
          />
          {enumMode === 'inline' && (
            <div>
              <AutosizeTextArea
                className='text-xs'
                maxRows={6}
                placeholder={'United States;us\nCanada;ca\nMexico'}
                value={enumText}
                onChange={(e) => setEnumText(e.target.value)}
                disabled={disabled}
              />
              <span className='mt-1 block text-[11px] text-muted-foreground'>
                One per line. Use {'"Label;value"'} format.
              </span>
            </div>
          )}
          {enumMode === 'ref' && (
            <div>
              <Select
                value={enumRef || undefined}
                onChange={setEnumRef}
                placeholder='Select dictionary...'
                disabled={disabled}
                className='w-full'
                size='small'
                options={Object.keys(dictionaries).map((k) => ({ label: k, value: k }))}
              />
            </div>
          )}
          {enumMode !== 'none' && (
            <div>
              <Checkbox checked={enumLoose} onChange={(e) => setEnumLoose(e.target.checked)} disabled={disabled}>
                <span className='text-xs'>Allow custom values</span>
              </Checkbox>
            </div>
          )}
        </div>
      )}
    </FieldEditPopover>
  );
};
