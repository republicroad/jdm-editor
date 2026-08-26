import { type Variable } from '@gorules/zen-engine-wasm';
import type { InputRef } from '../../primitives';
import { Checkbox, Input, Select } from '../../primitives';
import React, { useEffect, useRef, useState } from 'react';

import { COLUMN_FIELD_TYPE_OPTIONS, type ColumnEnum, type ColumnFieldType } from '../../../helpers/schema';
import { AutosizeTextArea } from '../../autosize-text-area';
import type { CodeEditorRef } from '../../code-editor';
import { CodeEditor } from '../../code-editor';
import { CodeEditorPreview } from '../../code-editor/ce-preview';
import { useDecisionTableState } from '../context/dt-store.context';
import { ENUM_MODE_OPTIONS, type EnumMode, getEnumMode, parseEnumString, serializeEnumValues } from './enum-utils';
import { FieldEditPopover } from './field-edit-popover';
import { FieldTypeTags } from './field-type-tags';

const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className='mb-1.5 block text-xs font-medium text-muted-foreground'>{children}</span>
);

type InputFieldEditProps = {
  disabled?: boolean;
  value?: string;
  onChange?: (value: string, fieldType?: ColumnFieldType) => void;
  onRemove?: () => void;
  variableType?: unknown;
  inputData?: Variable;
  referenceData?: { field: string; value: unknown };
  fieldType?: ColumnFieldType;
  mode?: 'edit' | 'create';
  trigger?: React.ReactNode;
  onCreate?: (name: string, field: string, fieldType?: ColumnFieldType) => void;
};

export const InputFieldEdit: React.FC<InputFieldEditProps> = ({
  value,
  onChange,
  onRemove,
  disabled,
  variableType,
  inputData,
  referenceData,
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
  const [innerFieldType, setInnerFieldType] = useState<string>(fieldType?.type ?? 'any');
  const ftEnum = fieldType?.type === 'string' ? fieldType.enum : undefined;
  const [enumMode, setEnumMode] = useState<EnumMode>(getEnumMode(ftEnum));
  const [enumText, setEnumText] = useState(ftEnum?.type === 'inline' ? serializeEnumValues(ftEnum.values) : '');
  const [enumRef, setEnumRef] = useState(ftEnum?.type === 'ref' ? ftEnum.ref : '');
  const [enumLoose, setEnumLoose] = useState(ftEnum?.loose ?? false);
  const codeEditor = useRef<CodeEditorRef>(null);
  const nameInput = useRef<InputRef>(null);

  useEffect(() => {
    if (open) {
      if (mode === 'create') {
        setInnerName('');
        setInnerValue('');
        setInnerFieldType('any');
        setEnumMode('none');
        setEnumText('');
        setEnumRef('');
        setEnumLoose(false);
        setTimeout(() => {
          codeEditor.current?.codeMirror?.focus();
        });
      } else {
        setInnerValue(value);
        setInnerFieldType(fieldType?.type ?? 'any');
        const e = fieldType?.type === 'string' ? fieldType.enum : undefined;
        setEnumMode(getEnumMode(e));
        setEnumText(e?.type === 'inline' ? serializeEnumValues(e.values) : '');
        setEnumRef(e?.type === 'ref' ? e.ref : '');
        setEnumLoose(e?.loose ?? false);
        if (!codeEditor.current) return;

        setTimeout(() => {
          codeEditor.current!.codeMirror?.focus();
          const content = codeEditor.current!.querySelector('.cm-content');
          const selection = window.getSelection();
          if (content && selection) selection.selectAllChildren(content);
        });
      }
    }
  }, [open]);

  const buildFieldType = (): ColumnFieldType | undefined => {
    if (!showAdvanced) return fieldType;
    if (innerFieldType === 'any') return undefined;
    if (innerFieldType === 'string') {
      let enumConfig: ColumnEnum | undefined;
      if (enumMode === 'inline') {
        const items = parseEnumString(enumText);
        if (items.length) enumConfig = { type: 'inline', values: items, ...(enumLoose ? { loose: true } : {}) };
      } else if (enumMode === 'ref' && enumRef) {
        enumConfig = { type: 'ref', ref: enumRef, ...(enumLoose ? { loose: true } : {}) };
      }
      return { type: 'string', ...(enumConfig ? { enum: enumConfig } : {}) };
    }
    return { type: innerFieldType } as ColumnFieldType;
  };

  const handleSubmit = () => {
    if (mode === 'create') {
      onCreate?.(innerName || 'New field', innerValue ?? '', buildFieldType());
    } else {
      onChange?.(innerValue ?? '', buildFieldType());
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
        <FieldLabel>Input Field</FieldLabel>
        <CodeEditor
          ref={codeEditor}
          value={innerValue}
          onChange={setInnerValue}
          variableType={variableType}
          disabled={disabled}
          className='grl-ce-single'
          style={{ height: 32 }}
        />
      </div>
      <CodeEditorPreview
        expression={innerValue ?? ''}
        inputData={inputData}
        initial={referenceData ? { expression: referenceData.field, result: referenceData.value } : undefined}
      />
      {mode === 'create' && (
        <div className='space-y-1.5'>
          <FieldLabel>Label</FieldLabel>
          <Input
            ref={nameInput}
            value={innerName}
            onChange={(e) => setInnerName(e.target.value)}
            placeholder='Field label'
            disabled={disabled}
            className='h-8'
          />
        </div>
      )}
      {showAdvanced && innerValue?.trim() && (
        <div className='space-y-1.5'>
          <FieldLabel>Type</FieldLabel>
          <FieldTypeTags
            options={COLUMN_FIELD_TYPE_OPTIONS}
            value={innerFieldType as ColumnFieldType['type']}
            onChange={setInnerFieldType}
            disabled={disabled}
          />
        </div>
      )}
      {showAdvanced && innerValue?.trim() && innerFieldType === 'string' && (
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
                maxRows={6}
                placeholder={'United States;us\nCanada;ca\nMexico'}
                value={enumText}
                onChange={(e) => setEnumText(e.target.value)}
                disabled={disabled}
                className='text-xs'
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
