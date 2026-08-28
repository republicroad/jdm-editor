import type { SimpleValue } from '@gorules/zen-engine-wasm';
import clsx from 'clsx';
import dayjs from 'dayjs';
import React, { useEffect, useMemo, useState } from 'react';
import { match } from 'ts-pattern';

import { useThemeMode } from '../../../../theme';
import { AutosizeTextArea } from '../../../autosize-text-area';
import { DatePicker, InputNumber, Select, TimePicker } from '../../../primitives';
import {
  FIELD_AUTO,
  FIELD_COMPACT,
  GRANULARITIES,
  type OperatorType,
  type ValueKind,
  enumFilterOption,
} from './constants';

export type ValInputProps = {
  value: SimpleValue | null;
  onChange: (v: SimpleValue | null) => void;
  operator: OperatorType;
  kind: ValueKind;
  disabled?: boolean;
};

export const ValInput: React.FC<ValInputProps> = ({ value, onChange, operator, kind, disabled }) =>
  match(operator)
    .with('between', () => <IntervalInput value={value} onChange={onChange} disabled={disabled} />)
    .with('in', 'notIn', () => <ArrayInput value={value} onChange={onChange} kind={kind} disabled={disabled} />)
    .with('dateAfter', 'dateBefore', 'dateSame', 'dateSameOrAfter', 'dateSameOrBefore', () => (
      <DateInput value={value} onChange={onChange} disabled={disabled} />
    ))
    .with('timeGt', 'timeGte', 'timeLt', 'timeLte', () => (
      <TimeInput value={value} onChange={onChange} disabled={disabled} />
    ))
    .with('dayOfWeekIn', () => (
      <ChipInput value={value} onChange={onChange} disabled={disabled} options={DAYS} defaultValues={[1, 2, 3, 4, 5]} />
    ))
    .with('quarterIn', () => (
      <ChipInput value={value} onChange={onChange} disabled={disabled} options={QUARTERS} defaultValues={[1]} />
    ))
    .otherwise(() =>
      match(kind)
        .with('boolean', () => <BoolInput value={value} onChange={onChange} disabled={disabled} />)
        .with('number', () => <NumInput value={value} onChange={onChange} disabled={disabled} />)
        .otherwise(() => <StrInput value={value} onChange={onChange} disabled={disabled} />),
    );

export type SimpleInputProps = { value: SimpleValue | null; onChange: (v: SimpleValue) => void; disabled?: boolean };

const StrInput: React.FC<SimpleInputProps> = ({ value, onChange, disabled }) => {
  const externalText = value?.type === 'string' ? value.value : '';
  const [text, setText] = useState(externalText);
  useEffect(() => {
    if (text !== externalText) {
      setText(externalText);
    }
  }, [externalText]);
  const commit = () => onChange({ type: 'string', value: text });
  return (
    <AutosizeTextArea
      className='flex-1 min-w-[40px] [font-family:inherit] text-[13px]! leading-[var(--b-line-height)]! px-[var(--b-h-padding)]! py-[var(--b-v-padding)]! h-auto! min-h-[var(--b-height)] focus:shadow-none!'
      value={text}
      maxRows={3}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && commit()}
      disabled={disabled}
    />
  );
};

const NumInput: React.FC<SimpleInputProps> = ({ value, onChange, disabled }) => (
  <InputNumber
    className={`flex-1 min-w-[40px] ${FIELD_COMPACT}`}
    value={value?.type === 'number' ? value.value : 0}
    onChange={(v) => v !== null && onChange({ type: 'number', value: v })}
    disabled={disabled}
    variant='borderless'
    size='small'
    controls={false}
  />
);

const BoolInput: React.FC<SimpleInputProps> = ({ value, onChange, disabled }) => (
  <Select
    className={`min-w-[50px] flex-1 ${FIELD_COMPACT}`}
    value={value?.type === 'boolean' ? value.value : true}
    onChange={(v) => onChange({ type: 'boolean', value: v })}
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
);

const DateInput: React.FC<SimpleInputProps> = ({ value, onChange, disabled }) => {
  const dateVal = value?.type === 'date' ? value.value : dayjs().format('YYYY-MM-DD');
  const granularity = value?.type === 'date' ? value.granularity : undefined;
  return (
    <>
      <DatePicker
        className={`min-w-[100px] min-h-0! ${FIELD_COMPACT}`}
        value={dayjs(dateVal)}
        onChange={(d) => d && onChange({ type: 'date', value: d.format('YYYY-MM-DD'), granularity })}
        disabled={disabled}
        variant='borderless'
        size='small'
        allowClear={false}
      />
      <Select
        className={`min-w-[60px] ${FIELD_COMPACT}`}
        value={granularity ?? ''}
        onChange={(g) => onChange({ type: 'date', value: dateVal, granularity: g || undefined })}
        options={GRANULARITIES}
        disabled={disabled}
        variant='borderless'
        size='small'
        popupMatchSelectWidth={false}
        suffixIcon={null}
      />
    </>
  );
};

const TimeInput: React.FC<SimpleInputProps> = ({ value, onChange, disabled }) => (
  <TimePicker
    className={`min-w-[60px] min-h-0! ${FIELD_COMPACT}`}
    value={value?.type === 'time' ? dayjs().hour(value.hour).minute(value.minute) : dayjs().hour(9).minute(0)}
    onChange={(t) => t && onChange({ type: 'time', hour: t.hour(), minute: t.minute() })}
    disabled={disabled}
    variant='borderless'
    size='small'
    format='HH:mm'
    allowClear={false}
  />
);

const DAYS = [
  { v: 1, l: 'Mon' },
  { v: 2, l: 'Tue' },
  { v: 3, l: 'Wed' },
  { v: 4, l: 'Thu' },
  { v: 5, l: 'Fri' },
  { v: 6, l: 'Sat' },
  { v: 7, l: 'Sun' },
];
const QUARTERS = [
  { v: 1, l: 'Q1' },
  { v: 2, l: 'Q2' },
  { v: 3, l: 'Q3' },
  { v: 4, l: 'Q4' },
];

const ChipInput: React.FC<SimpleInputProps & { options: { v: number; l: string }[]; defaultValues: number[] }> = ({
  value,
  onChange,
  disabled,
  options,
  defaultValues,
}) => {
  const valid = new Set(options.map((o) => o.v));
  const raw = value?.type === 'intArray' ? value.values : defaultValues;
  const sel = raw.filter((v) => valid.has(v));

  useEffect(() => {
    if (sel.length !== raw.length && sel.length > 0) onChange({ type: 'intArray', values: sel });
  }, [sel.length, raw.length]);

  const toggle = (v: number) => {
    if (disabled) return;
    const next = sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v].sort((a, b) => a - b);
    if (next.length) onChange({ type: 'intArray', values: next });
  };
  return (
    <div className='flex flex-wrap items-center gap-1 min-h-[var(--b-height)]'>
      {options.map((o) => (
        <span
          key={o.v}
          className={clsx(
            'cursor-pointer select-none rounded-full border border-border bg-transparent px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors [font-family:var(--grl-font-family),sans-serif] [&:hover:not(.active):not(.disabled)]:border-[var(--grl-color-primary-border)] [&:hover:not(.active):not(.disabled)]:bg-[var(--bg-active)] [&:hover:not(.active):not(.disabled)]:text-[var(--color-active-text)]',
            sel.includes(o.v) &&
              'border-[var(--grl-color-primary-border)] bg-[var(--bg-active)] text-[var(--color-active-text)]',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          onClick={() => toggle(o.v)}
        >
          {o.l}
        </span>
      ))}
    </div>
  );
};

const ArrayInput: React.FC<SimpleInputProps & { kind: ValueKind }> = ({ value, onChange, kind, disabled }) => {
  const vals = useMemo(
    () =>
      value?.type === 'stringArray' ? value.values : value?.type === 'numberArray' ? value.values.map(String) : [],
    [value],
  );
  return (
    <Select
      className={`flex-1 min-w-0 ${FIELD_AUTO}`}
      mode='tags'
      value={vals}
      onChange={(v: string[]) =>
        kind === 'number'
          ? onChange({ type: 'numberArray', values: v.map((x) => parseFloat(x)).filter((n) => !isNaN(n)) })
          : onChange({ type: 'stringArray', values: v })
      }
      disabled={disabled}
      variant='borderless'
      size='small'
      tokenSeparators={[',']}
      suffixIcon={null}
    />
  );
};

const IntervalInput: React.FC<SimpleInputProps> = ({ value, onChange, disabled }) => {
  useThemeMode();
  const iv = value?.type === 'interval' ? value : { left: 0, right: 100, leftInclusive: true, rightInclusive: true };
  const upd = (p: Partial<typeof iv>) => onChange({ type: 'interval', ...iv, ...p });
  return (
    <div className='flex flex-1 items-center gap-0.5 min-h-[var(--b-height)]'>
      <span
        className='cursor-pointer select-none px-0.5 text-sm leading-[var(--b-height)] hover:opacity-70'
        onClick={() => !disabled && upd({ leftInclusive: !iv.leftInclusive })}
      >
        {iv.leftInclusive ? '[' : '('}
      </span>
      <InputNumber
        className={`w-[45px] ${FIELD_COMPACT}`}
        value={iv.left}
        onChange={(v) => v !== null && upd({ left: v })}
        disabled={disabled}
        variant='borderless'
        size='small'
        controls={false}
      />
      <span className='text-muted-foreground'>..</span>
      <InputNumber
        className={`w-[45px] ${FIELD_COMPACT}`}
        value={iv.right}
        onChange={(v) => v !== null && upd({ right: v })}
        disabled={disabled}
        variant='borderless'
        size='small'
        controls={false}
      />
      <span
        className='cursor-pointer select-none px-0.5 text-sm leading-[var(--b-height)] hover:opacity-70'
        onClick={() => !disabled && upd({ rightInclusive: !iv.rightInclusive })}
      >
        {iv.rightInclusive ? ']' : ')'}
      </span>
    </div>
  );
};

export const EnumValInput: React.FC<{
  value: SimpleValue | null;
  onChange: (v: SimpleValue) => void;
  operator: OperatorType;
  options: { label: string; value: string }[];
  loose?: boolean;
  disabled?: boolean;
}> = ({ value, onChange, operator, options, loose, disabled }) =>
  match(operator)
    .with('in', 'notIn', () => (
      <Select
        className={`min-w-0 ${FIELD_AUTO}`}
        mode={loose ? 'tags' : 'multiple'}
        value={value?.type === 'stringArray' ? value.values : []}
        onChange={(v) => onChange({ type: 'stringArray', values: v })}
        options={options}
        disabled={disabled}
        variant='borderless'
        size='small'
        style={{ flex: 1, minWidth: 80 }}
        suffixIcon={null}
        showSearch
        filterOption={enumFilterOption}
        {...(loose ? { tokenSeparators: [','] } : {})}
      />
    ))
    .with('eq', 'neq', () =>
      loose ? (
        <Select
          className={`min-w-0 ${FIELD_AUTO}`}
          mode='tags'
          maxCount={1}
          value={value?.type === 'string' && value.value ? [value.value] : []}
          onChange={(v) => onChange({ type: 'string', value: v[0] ?? '' })}
          options={options}
          disabled={disabled}
          variant='borderless'
          size='small'
          style={{ flex: 1, minWidth: 80 }}
          suffixIcon={null}
          showSearch
          filterOption={enumFilterOption}
        />
      ) : (
        <Select
          className={`min-w-0 ${FIELD_COMPACT}`}
          value={value?.type === 'string' ? value.value : undefined}
          onChange={(v) => onChange({ type: 'string', value: v })}
          options={options}
          disabled={disabled}
          variant='borderless'
          size='small'
          style={{ flex: 1, minWidth: 80 }}
          suffixIcon={null}
          showSearch
          filterOption={enumFilterOption}
        />
      ),
    )
    .otherwise(() => <StrInput value={value} onChange={onChange} disabled={disabled} />);
