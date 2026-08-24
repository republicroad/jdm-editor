import { type StandardExpressionData, parseStandardExpression } from '@gorules/zen-engine-wasm';
import { DatePicker, InputNumber, Select } from '../../primitives';
import dayjs from 'dayjs';
import {
  CalendarIcon,
  HashIcon,
  ListIcon,
  type LucideIcon,
  SquareFunctionIcon,
  ToggleLeftIcon,
  TypeIcon,
} from 'lucide-react';
import React, { useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import type { ColumnEnum, OutputFieldType } from '../../../helpers/schema';
import { type DictionaryMap, useDictionaries } from '../../../theme';
import { AutosizeTextArea } from '../../autosize-text-area';
import { CodeEditorBase } from '../ce-base';
import { focusBuilderRoot } from './focus-helper';

export type { OutputFieldType };

const BUILDER_TOKENS: React.CSSProperties = {
  '--b-font-size': '13px',
  '--b-line-height': '1.5',
  '--b-v-padding': '2px',
  '--b-h-padding': '4px',
  '--b-height': 'calc(var(--b-font-size) * var(--b-line-height) + var(--b-v-padding) * 2)',
  '--b-max-height': 'calc(var(--b-height) * var(--b-max-rows))',
} as React.CSSProperties;

export type StandardExpressionBuilderProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  fieldType?: OutputFieldType;
  maxRows?: number;
};

const TYPE_ICONS: Record<Exclude<OutputFieldType['type'], 'auto'>, LucideIcon> = {
  'string': TypeIcon,
  'string-array': ListIcon,
  'number': HashIcon,
  'boolean': ToggleLeftIcon,
  'date': CalendarIcon,
};

const enumFilterOption = (input: string, option?: { label?: unknown; value?: unknown }) => {
  const search = input.toLowerCase();
  const hay = [String(option?.label ?? ''), String(option?.value ?? '')].join(' ').toLowerCase();
  return hay.includes(search);
};

const formatDateValue = (date: string): string => `d('${date}')`;
const formatStringValue = (value: string): string => `"${value}"`;
const formatStringArrayValue = (values: string[]): string =>
  !values.length ? '[]' : `[${values.map((v) => `"${v.replace(/"/g, '\\"')}"`).join(', ')}]`;

const parseStringArrayValue = (value: string): string[] => {
  if (!value?.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String);
  } catch {}
  return [];
};

const isStringArrayValue = (value: string): boolean => {
  if (!value?.trim() || value.trim() === '[]') return true;
  try {
    return Array.isArray(JSON.parse(value));
  } catch {}
  return false;
};

const getEnumOptions = (
  ft?: OutputFieldType,
  dictionaries?: DictionaryMap,
): { values: { label: string; value: string }[]; loose: boolean } | null => {
  if (!ft) return null;
  if (ft.type !== 'string' && ft.type !== 'string-array') return null;
  const e: ColumnEnum | undefined = ft.enum;
  if (!e) return null;
  if (e.type === 'inline') {
    return e.values.length ? { values: e.values, loose: e.loose ?? false } : null;
  }
  const resolved = dictionaries?.[e.ref];
  return resolved?.length ? { values: resolved, loose: e.loose ?? false } : null;
};

export type StandardExpressionBuilderRef = {
  focus: () => void;
};

export const StandardExpressionBuilder = React.forwardRef<StandardExpressionBuilderRef, StandardExpressionBuilderProps>(
  ({ value, onChange, disabled = false, fieldType, maxRows = 3 }, ref) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const dictionaries = useDictionaries();
    const ftType = fieldType?.type ?? 'auto';
    const styleVars = { ...BUILDER_TOKENS, '--b-max-rows': maxRows } as React.CSSProperties;

    useImperativeHandle(ref, () => ({
      focus: () => focusBuilderRoot(rootRef.current),
    }));

    const parsed = useMemo<StandardExpressionData>(() => parseStandardExpression(value), [value]);
    const computeExprMode = () => {
      if (ftType === 'string-array') return !isStringArrayValue(value);
      if (parsed.kind === 'expression') return true;
      if (ftType === 'auto') return false;
      return parsed.kind !== ftType;
    };
    const [isExprMode, setIsExprMode] = useState(computeExprMode);

    useEffect(() => {
      setIsExprMode(computeExprMode());
    }, [ftType]);

    const forceExprMode =
      ftType !== 'auto' && ftType !== 'string-array' && parsed.kind !== 'expression' && parsed.kind !== ftType;

    const TypeIcon = ftType !== 'auto' ? TYPE_ICONS[ftType] : null;
    const enumOptions = getEnumOptions(fieldType, dictionaries);

    if (ftType === 'auto' || isExprMode || forceExprMode) {
      return (
        <div ref={rootRef} className='flex items-start gap-1 min-h-[var(--b-height)] text-[var(--b-font-size)] leading-[var(--b-line-height)]' style={styleVars}>
          {ftType !== 'auto' && (
            <button
              className='flex shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-muted px-1.5 py-[var(--b-v-padding)] text-[11px] text-muted-foreground transition-colors min-h-[var(--b-height)] enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50'
              onClick={() => {
                if (parsed.kind !== ftType) {
                  const t = ftType;
                  if (t === 'string') onChange(formatStringValue(''));
                  else if (t === 'number') onChange('0');
                  else if (t === 'boolean') onChange('true');
                  else if (t === 'date') onChange(formatDateValue(dayjs().format('YYYY-MM-DD')));
                }
                setIsExprMode(false);
              }}
              disabled={disabled}
              title='Currently: Expression. Click for value mode.'
            >
              <SquareFunctionIcon size={14} />
            </button>
          )}
          <CodeEditorBase
            className='min-w-[40px] flex-1 max-h-[var(--b-max-height)] overflow-y-auto'
            style={{ '--ce-lineHeight': 'var(--b-line-height)', '--ce-verticalPadding': 'var(--b-v-padding)', '--ce-horizontalPadding': 'var(--b-h-padding)' } as React.CSSProperties}
            value={value}
            onChange={onChange}
            type='standard'
            disabled={disabled}
            noStyle
            maxRows={maxRows}
          />
        </div>
      );
    }

    return (
      <div ref={rootRef} className='flex items-start gap-1 min-h-[var(--b-height)] text-[var(--b-font-size)] leading-[var(--b-line-height)]' style={styleVars}>
        <button
          className='flex shrink-0 cursor-pointer items-center justify-center rounded-md border-0 bg-muted px-1.5 py-[var(--b-v-padding)] text-[11px] text-muted-foreground transition-colors min-h-[var(--b-height)] enabled:hover:bg-accent enabled:hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50'
          onClick={() => setIsExprMode(true)}
          disabled={disabled}
          title='Currently: Value. Click for expression mode.'
        >
          {TypeIcon && <TypeIcon size={14} />}
        </button>
        {ftType === 'string' && !enumOptions && (
          <AutosizeTextArea
            className='flex-1 min-w-[40px] p-0! [font-family:inherit] border-0! bg-transparent! text-[var(--b-font-size)]! leading-[var(--b-line-height)]! px-[var(--b-h-padding)]! py-[var(--b-v-padding)]! h-auto! min-h-[var(--b-height)] focus:shadow-none!'
            value={parsed.kind === 'string' ? parsed.value : ''}
            maxRows={maxRows}
            onChange={(e) => onChange(formatStringValue((e.target as unknown as { value: string }).value))}
            disabled={disabled}
          />
        )}
        {ftType === 'string' && enumOptions && (
          <Select
            className='min-w-[50px] h-[var(--b-height)]! flex-1'
            value={parsed.kind === 'string' ? parsed.value : undefined}
            onChange={(v) => onChange(formatStringValue(v))}
            disabled={disabled}
            variant='borderless'
            size='small'
            suffixIcon={null}
            showSearch
            filterOption={enumFilterOption}
            popupMatchSelectWidth={false}
            options={enumOptions.values.map((v) => ({ label: v.label, value: v.value }))}
          />
        )}
        {ftType === 'string-array' && (
          <Select
            className='flex-1 min-w-0 min-h-[var(--b-height)]! h-auto! overflow-hidden'
            mode={enumOptions && !enumOptions.loose ? 'multiple' : 'tags'}
            value={parseStringArrayValue(value)}
            onChange={(v: string[]) => onChange(formatStringArrayValue(v))}
            disabled={disabled}
            variant='borderless'
            size='small'
            suffixIcon={null}
            showSearch
            filterOption={enumFilterOption}
            popupMatchSelectWidth={false}
            options={enumOptions?.values.map((v) => ({ label: v.label, value: v.value }))}
          />
        )}
        {ftType === 'number' && (
          <InputNumber
            className='flex-1 min-w-[40px] p-0!'
            value={parsed.kind === 'number' ? parsed.value : 0}
            onChange={(v) => onChange(String(v ?? 0))}
            disabled={disabled}
            variant='borderless'
            controls={false}
          />
        )}
        {ftType === 'boolean' && (
          <Select
            className='min-w-[50px] h-[var(--b-height)]! flex-1'
            value={parsed.kind === 'boolean' ? parsed.value : true}
            onChange={(v) => onChange(String(v))}
            disabled={disabled}
            variant='borderless'
            size='small'
            suffixIcon={null}
            popupMatchSelectWidth={80}
            options={[
              { value: true, label: 'true' },
              { value: false, label: 'false' },
            ]}
          />
        )}
        {ftType === 'date' && (
          <DatePicker
            className='flex-1 min-w-[80px] p-0! h-[var(--b-height)]! min-h-0!'
            value={(() => {
              const dateStr = parsed.kind === 'date' ? parsed.value : null;
              return dateStr && dayjs(dateStr).isValid() ? dayjs(dateStr) : dayjs();
            })()}
            onChange={(d) => d && onChange(formatDateValue(d.format('YYYY-MM-DD')))}
            disabled={disabled}
            variant='borderless'
            size='small'
            allowClear={false}
          />
        )}
      </div>
    );
  },
);
