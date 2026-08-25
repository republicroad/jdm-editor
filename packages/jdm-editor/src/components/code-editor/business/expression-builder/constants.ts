import type { SimpleOperator, SimpleValue } from '@gorules/zen-engine-wasm';
import dayjs from 'dayjs';
import {
  ArrowLeftRightIcon,
  AsteriskIcon,
  CalendarCheckIcon,
  CalendarIcon,
  CalendarMinusIcon,
  CalendarPlusIcon,
  CircleDotIcon,
  CircleSlashIcon,
  ClockArrowDownIcon,
  ClockArrowUpIcon,
  EqualIcon,
  EqualNotIcon,
  ListIcon,
  ListXIcon,
  type LucideIcon,
  SearchIcon,
  TextCursorInputIcon,
} from 'lucide-react';
import { P, match } from 'ts-pattern';

import type { ColumnFieldType } from '../../../../helpers/schema';
import type { DictionaryMap } from '../../../../theme';
import type { CSSProperties } from 'react';

export const BUILDER_TOKENS: CSSProperties = {
  '--b-font-size': '13px',
  '--b-line-height': '1.5',
  '--b-v-padding': '2px',
  '--b-h-padding': '4px',
  '--b-height': 'calc(var(--b-font-size) * var(--b-line-height) + var(--b-v-padding) * 2)',
  '--b-max-height': 'calc(var(--b-height) * var(--b-max-rows))',
} as CSSProperties;

export const BUILDER_BG_VARS: CSSProperties = {
  '--bg-light': 'var(--grl-color-bg-container-disabled)',
  '--bg-active': 'var(--grl-color-primary-bg)',
  '--color-active-text': 'var(--grl-color-primary)',
} as CSSProperties;

// Single-line fields (native input / Radix trigger): fixed compact height,
// builder side padding and font so every field's box and first-character
// inset match the autosize textarea.
export const FIELD_COMPACT = 'h-[var(--b-height)]! border-0! px-[var(--b-h-padding)]! py-0! text-[13px]!';
// Multi/tags native input: auto height, min builder height, side padding.
export const FIELD_AUTO = 'min-h-[var(--b-height)]! h-auto! border-0! px-[var(--b-h-padding)]! text-[13px]! overflow-hidden';

export type OperatorType = SimpleOperator['type'];
export type ValueKind = 'string' | 'number' | 'boolean' | 'date' | 'any';

export const VALUE_KINDS: { kind: ValueKind; label: string }[] = [
  { kind: 'string', label: 'Text' },
  { kind: 'number', label: 'Number' },
  { kind: 'boolean', label: 'Boolean' },
  { kind: 'date', label: 'Date' },
];

export type Op = { type: OperatorType; icon?: LucideIcon; symbol?: string; rotate?: boolean; label: string };

export const OPS: Op[] = [
  { type: 'eq', icon: EqualIcon, label: 'equals' },
  { type: 'neq', icon: EqualNotIcon, label: 'not equals' },
  { type: 'gt', symbol: '>', label: 'greater than' },
  { type: 'gte', symbol: '≥', label: 'greater or equal' },
  { type: 'lt', symbol: '<', label: 'less than' },
  { type: 'lte', symbol: '≤', label: 'less or equal' },
  { type: 'in', icon: ListIcon, label: 'is one of' },
  { type: 'notIn', icon: ListXIcon, label: 'is not one of' },
  { type: 'between', icon: ArrowLeftRightIcon, label: 'between' },
  { type: 'null', icon: CircleSlashIcon, label: 'is empty' },
  { type: 'notNull', icon: CircleDotIcon, label: 'is not empty' },
  { type: 'any', icon: AsteriskIcon, label: 'any' },
  { type: 'startsWith', icon: TextCursorInputIcon, label: 'starts with' },
  { type: 'endsWith', icon: TextCursorInputIcon, rotate: true, label: 'ends with' },
  { type: 'contains', icon: SearchIcon, label: 'contains' },
  { type: 'dateAfter', icon: CalendarPlusIcon, label: 'after' },
  { type: 'dateBefore', icon: CalendarMinusIcon, label: 'before' },
  { type: 'dateSame', icon: CalendarCheckIcon, label: 'same day' },
  { type: 'dateSameOrAfter', symbol: '≥', label: 'same or after' },
  { type: 'dateSameOrBefore', symbol: '≤', label: 'same or before' },
  { type: 'dateIsToday', icon: CalendarIcon, label: 'is today' },
  { type: 'timeGt', icon: ClockArrowUpIcon, label: 'time after' },
  { type: 'timeGte', icon: ClockArrowUpIcon, label: 'time at or after' },
  { type: 'timeLt', icon: ClockArrowDownIcon, label: 'time before' },
  { type: 'timeLte', icon: ClockArrowDownIcon, label: 'time at or before' },
  { type: 'dayOfWeekIn', icon: CalendarIcon, label: 'day is one of' },
  { type: 'quarterIn', icon: CalendarIcon, label: 'quarter is one of' },
];

export const getOp = (type: OperatorType): Op => OPS.find((o) => o.type === type) ?? OPS[0];

export const OPS_BY_KIND: Record<ValueKind, OperatorType[]> = {
  string: ['eq', 'neq', 'in', 'notIn', 'startsWith', 'endsWith', 'contains', 'null', 'notNull', 'any'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'notIn', 'between', 'null', 'notNull', 'any'],
  boolean: ['eq', 'null', 'notNull', 'any'],
  date: [
    'dateAfter',
    'dateBefore',
    'dateSame',
    'dateSameOrAfter',
    'dateSameOrBefore',
    'dateIsToday',
    'timeGt',
    'timeGte',
    'timeLt',
    'timeLte',
    'dayOfWeekIn',
    'quarterIn',
    'null',
    'notNull',
    'any',
  ],
  any: OPS.map((o) => o.type),
};

export const GRID_OPS: Record<ValueKind, OperatorType[]> = {
  string: ['eq', 'neq', 'in', 'startsWith', 'endsWith', 'contains'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  boolean: ['eq', 'null', 'notNull', 'any'],
  date: ['dateAfter', 'dateBefore', 'dateSame', 'dateIsToday', 'dayOfWeekIn', 'quarterIn'],
  any: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
};

export const NO_VALUE_OPS: OperatorType[] = ['null', 'notNull', 'any', 'dateIsToday'];

export const GRANULARITIES = [
  { value: '', label: 'Exact' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

export const getValueKind = (ft?: ColumnFieldType): ValueKind =>
  match(ft?.type)
    .with('string', () => 'string' as const)
    .with('number', () => 'number' as const)
    .with('boolean', () => 'boolean' as const)
    .with('date', () => 'date' as const)
    .otherwise(() => 'any' as const);

export const enumFilterOption = (input: string, option?: { label?: unknown; value?: unknown }) => {
  const search = input.toLowerCase();
  const hay = [String(option?.label ?? ''), String(option?.value ?? '')].join(' ').toLowerCase();
  return hay.includes(search);
};

export const getEnumOptions = (
  ft?: ColumnFieldType,
  dictionaries?: DictionaryMap,
): { values: { label: string; value: string }[]; loose: boolean } | null => {
  if (ft?.type !== 'string' || !ft.enum) return null;
  const e = ft.enum;
  if (e.type === 'inline') {
    return e.values.length ? { values: e.values, loose: e.loose ?? false } : null;
  }
  const resolved = dictionaries?.[e.ref];
  return resolved?.length ? { values: resolved, loose: e.loose ?? false } : null;
};

export const defaultValue = (op: OperatorType, kind: ValueKind): SimpleValue | null =>
  match(op)
    .with(
      P.when((o) => NO_VALUE_OPS.includes(o)),
      () => null,
    )
    .with(
      'between',
      () => ({ type: 'interval', left: 0, right: 100, leftInclusive: true, rightInclusive: true }) as SimpleValue,
    )
    .with(
      'in',
      'notIn',
      () =>
        (kind === 'number' ? { type: 'numberArray', values: [] } : { type: 'stringArray', values: [] }) as SimpleValue,
    )
    .with(
      'dateAfter',
      'dateBefore',
      'dateSame',
      'dateSameOrAfter',
      'dateSameOrBefore',
      () => ({ type: 'date', value: dayjs().format('YYYY-MM-DD') }) as SimpleValue,
    )
    .with('timeGt', 'timeGte', 'timeLt', 'timeLte', () => ({ type: 'time', hour: 9, minute: 0 }) as SimpleValue)
    .with('dayOfWeekIn', () => ({ type: 'intArray', values: [1, 2, 3, 4, 5] }) as SimpleValue)
    .with('quarterIn', () => ({ type: 'intArray', values: [1] }) as SimpleValue)
    .with('startsWith', 'endsWith', 'contains', () => ({ type: 'string', value: '' }) as SimpleValue)
    .otherwise(() =>
      match(kind)
        .with('number', () => ({ type: 'number', value: 0 }) as SimpleValue)
        .with('boolean', () => ({ type: 'boolean', value: true }) as SimpleValue)
        .otherwise(() => ({ type: 'string', value: '' }) as SimpleValue),
    );
