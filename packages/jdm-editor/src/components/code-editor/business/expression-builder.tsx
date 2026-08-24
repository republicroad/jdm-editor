import type { ExpressionBuilderData, SimpleOperator, SimpleValue } from '@gorules/zen-engine-wasm';
import { ExpressionBuilder as ExpressionBuilderWasm } from '@gorules/zen-engine-wasm';
import { DatePicker, InputNumber, Popover, Select, TimePicker } from '../../primitives';
import { useThemeMode } from '../../../theme';
import clsx from 'clsx';
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
  SquareFunctionIcon,
  TextCursorInputIcon,
} from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { P, match } from 'ts-pattern';

import type { ColumnFieldType } from '../../../helpers/schema';
import { type DictionaryMap, useDictionaries } from '../../../theme';
import { AutosizeTextArea } from '../../autosize-text-area';
import { CodeEditorBase } from '../ce-base';
import { focusBuilderRoot } from './focus-helper';

const BUILDER_TOKENS: React.CSSProperties = {
  '--b-font-size': '13px',
  '--b-line-height': '1.5',
  '--b-v-padding': '2px',
  '--b-h-padding': '4px',
  '--b-height': 'calc(var(--b-font-size) * var(--b-line-height) + var(--b-v-padding) * 2)',
  '--b-max-height': 'calc(var(--b-height) * var(--b-max-rows))',
} as React.CSSProperties;

const BUILDER_BG_VARS: React.CSSProperties = {
  '--bg-light': 'var(--grl-color-bg-container-disabled)',
  '--bg-active': 'var(--grl-color-primary-bg)',
  '--color-active-text': 'var(--grl-color-primary)',
} as React.CSSProperties;

export type ExpressionBuilderProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  fieldType?: ColumnFieldType;
  maxRows?: number;
};

type OperatorType = SimpleOperator['type'];
type ValueKind = 'string' | 'number' | 'boolean' | 'date' | 'any';

const VALUE_KINDS: { kind: ValueKind; label: string }[] = [
  { kind: 'string', label: 'Text' },
  { kind: 'number', label: 'Number' },
  { kind: 'boolean', label: 'Boolean' },
  { kind: 'date', label: 'Date' },
];

type Op = { type: OperatorType; icon?: LucideIcon; symbol?: string; rotate?: boolean; label: string };

const OPS: Op[] = [
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

const getOp = (type: OperatorType): Op => OPS.find((o) => o.type === type) ?? OPS[0];

const OPS_BY_KIND: Record<ValueKind, OperatorType[]> = {
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

const GRID_OPS: Record<ValueKind, OperatorType[]> = {
  string: ['eq', 'neq', 'in', 'startsWith', 'endsWith', 'contains'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
  boolean: ['eq', 'null', 'notNull', 'any'],
  date: ['dateAfter', 'dateBefore', 'dateSame', 'dateIsToday', 'dayOfWeekIn', 'quarterIn'],
  any: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte'],
};

const NO_VALUE_OPS: OperatorType[] = ['null', 'notNull', 'any', 'dateIsToday'];

const GRANULARITIES = [
  { value: '', label: 'Exact' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

const getValueKind = (ft?: ColumnFieldType): ValueKind =>
  match(ft?.type)
    .with('string', () => 'string' as const)
    .with('number', () => 'number' as const)
    .with('boolean', () => 'boolean' as const)
    .with('date', () => 'date' as const)
    .otherwise(() => 'any' as const);

const enumFilterOption = (input: string, option?: { label?: unknown; value?: unknown }) => {
  const search = input.toLowerCase();
  const hay = [String(option?.label ?? ''), String(option?.value ?? '')].join(' ').toLowerCase();
  return hay.includes(search);
};

const getEnumOptions = (
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

const defaultValue = (op: OperatorType, kind: ValueKind): SimpleValue | null =>
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

const OpIcon: React.FC<{ op: Op; size: number; className?: string }> = ({ op, size, className }) =>
  op.icon ? (
    <op.icon size={size} className={className} style={op.rotate ? { transform: 'rotate(180deg)' } : undefined} />
  ) : (
    <span className={className} style={{ fontSize: size }}>
      {op.symbol}
    </span>
  );

const inferKindFromExpr = (data: ExpressionBuilderData): ValueKind | null => {
  if (data.kind !== 'simple') return null;
  const op = data.operator.type;
  if (op.startsWith('date') || op.startsWith('time') || op === 'dayOfWeekIn' || op === 'quarterIn') return 'date';
  if (['startsWith', 'endsWith', 'contains'].includes(op)) return 'string';
  const val = data.value;
  if (!val) return null;
  return match(val.type)
    .with('string', 'stringArray', () => 'string' as const)
    .with('number', 'numberArray', 'interval', () => 'number' as const)
    .with('boolean', () => 'boolean' as const)
    .with('date', 'time', () => 'date' as const)
    .otherwise(() => null);
};

const isExprCompatibleWithKind = (data: ExpressionBuilderData, kind: ValueKind): boolean => {
  if (data.kind !== 'simple') return true;
  const op = data.operator.type;
  if (!OPS_BY_KIND[kind].includes(op)) return false;
  if (NO_VALUE_OPS.includes(op)) return true;
  const val = data.value;
  if (!val) return true;
  return match(kind)
    .with('boolean', () => val.type === 'boolean')
    .with('number', () => ['number', 'numberArray', 'interval'].includes(val.type))
    .with('string', () => ['string', 'stringArray'].includes(val.type))
    .with('date', () => ['date', 'time', 'intArray'].includes(val.type))
    .with('any', () => true)
    .exhaustive();
};

const useExpressionState = (value: string, onChange: (v: string) => void) => {
  const expr = useMemo(() => {
    const e = ExpressionBuilderWasm.parseUnary(value);
    const d = e.toJson() as ExpressionBuilderData;
    e.free();
    return d;
  }, [value]);

  const update = useCallback(
    (d: ExpressionBuilderData) => {
      const e = ExpressionBuilderWasm.fromJson(d);
      onChange(e.serialize());
      e.free();
    },
    [onChange],
  );

  const setVal = useCallback(
    (v: SimpleValue | null) => {
      if (expr.kind === 'simple') update({ kind: 'simple', operator: expr.operator, value: v });
    },
    [expr, update],
  );

  const [isCustom, setIsCustom] = useState(expr.kind === 'complex');
  useEffect(() => {
    if (expr.kind === 'complex') setIsCustom(true);
  }, [expr.kind]);

  const toggleCustom = useCallback(() => setIsCustom((v) => !v), []);

  return { expr, update, setVal, isCustom, setIsCustom, toggleCustom };
};

export type ExpressionBuilderRef = {
  focus: () => void;
};

export const ExpressionBuilder = React.forwardRef<ExpressionBuilderRef, ExpressionBuilderProps>(
  ({ value, onChange, disabled = false, fieldType, maxRows = 3 }, ref) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const dictionaries = useDictionaries();
    const styleVars = { ...BUILDER_TOKENS, ...BUILDER_BG_VARS, '--b-max-rows': maxRows } as React.CSSProperties;

    useImperativeHandle(ref, () => ({
      focus: () => focusBuilderRoot(rootRef.current),
    }));

    const enumResult = getEnumOptions(fieldType, dictionaries);
    const enumOpts = enumResult?.values ?? null;
    const isLoose = enumResult?.loose ?? false;
    const externalKind = getValueKind(fieldType);
    const isEnum = !!enumOpts?.length;
    const isAutoType = !isEnum && externalKind === 'any';
    const { expr, update, setVal, isCustom, setIsCustom, toggleCustom } = useExpressionState(value, onChange);
    const [localKind, setLocalKind] = useState<ValueKind | null>(null);
    const kind = isEnum ? 'string' : isAutoType ? (localKind ?? inferKindFromExpr(expr) ?? 'string') : externalKind;
    const forceCustom = !isAutoType && expr.kind === 'simple' && !isExprCompatibleWithKind(expr, kind);

    const setKind = useCallback(
      (newKind: ValueKind) => {
        setLocalKind(newKind);
        const defaultOp = OPS_BY_KIND[newKind][0];
        update({
          kind: 'simple',
          operator: { type: defaultOp } as SimpleOperator,
          value: defaultValue(defaultOp, newKind),
        });
      },
      [update],
    );

    const setOp = useCallback(
      (op: OperatorType) => {
        const cur = expr.kind === 'simple' ? expr.value : null;
        const canReuse = (t: string) => cur?.type === t;
        const val = match(op)
          .with(
            P.when((o) => NO_VALUE_OPS.includes(o)),
            () => null,
          )
          .with('between', () => (canReuse('interval') ? cur : defaultValue(op, kind)))
          .with('in', 'notIn', () =>
            canReuse('stringArray') || canReuse('numberArray') ? cur : defaultValue(op, kind),
          )
          .with('dateAfter', 'dateBefore', 'dateSame', 'dateSameOrAfter', 'dateSameOrBefore', () =>
            canReuse('date') ? cur : defaultValue(op, kind),
          )
          .with('timeGt', 'timeGte', 'timeLt', 'timeLte', () => (canReuse('time') ? cur : defaultValue(op, kind)))
          .with('dayOfWeekIn', 'quarterIn', () => (canReuse('intArray') ? cur : defaultValue(op, kind)))
          .with('startsWith', 'endsWith', 'contains', () => (canReuse('string') ? cur : defaultValue(op, kind)))
          .otherwise(() => {
            const expected = kind === 'number' ? 'number' : kind === 'boolean' ? 'boolean' : 'string';
            return canReuse(expected) ? cur : defaultValue(op, kind);
          });
        update({ kind: 'simple', operator: { type: op } as SimpleOperator, value: val });
      },
      [expr, kind, update],
    );

    const handleSelectOp = useCallback(
      (op: OperatorType) => {
        setIsCustom(false);
        setOp(op);
      },
      [setOp, setIsCustom],
    );

    const dropdownProps = {
      kind,
      operator: expr.kind === 'simple' ? expr.operator.type : ('eq' as OperatorType),
      onSelect: handleSelectOp,
      onKindChange: isAutoType ? setKind : undefined,
      onCustomToggle: toggleCustom,
      disabled,
    };

    if (isCustom || forceCustom || expr.kind === 'complex') {
      return (
        <div ref={rootRef} className='flex items-start gap-1 min-h-[var(--b-height)] text-[var(--b-font-size)] leading-[var(--b-line-height)]' style={styleVars}>
          <OpDropdown {...dropdownProps} isCustom />
          <CodeEditorBase
            className='min-w-[40px] flex-1 max-h-[var(--b-max-height)] overflow-y-auto'
            style={{ '--ce-lineHeight': 'var(--b-line-height)', '--ce-verticalPadding': 'var(--b-v-padding)', '--ce-horizontalPadding': 'var(--b-h-padding)' } as React.CSSProperties}
            value={value}
            onChange={onChange}
            type='unary'
            disabled={disabled}
            noStyle
            maxRows={maxRows}
            placeholder='Expression...'
          />
        </div>
      );
    }

    const op = expr.operator.type;
    return (
      <div ref={rootRef} className='flex items-start gap-1 min-h-[var(--b-height)] text-[var(--b-font-size)] leading-[var(--b-line-height)]' style={styleVars}>
        <OpDropdown {...dropdownProps} operator={op} />
        {NO_VALUE_OPS.includes(op) ? (
          op !== 'any' && <span className='text-xs leading-[var(--b-height)] text-[var(--grl-color-text-secondary)]'>{getOp(op).label}</span>
        ) : isEnum ? (
          <EnumValInput
            value={expr.value}
            onChange={setVal}
            operator={op}
            options={enumOpts}
            loose={isLoose}
            disabled={disabled}
          />
        ) : (
          <ValInput value={expr.value} onChange={setVal} operator={op} kind={kind} disabled={disabled} />
        )}
      </div>
    );
  },
);

type OpDropdownProps = {
  kind: ValueKind;
  operator: OperatorType;
  isCustom?: boolean;
  onSelect: (op: OperatorType) => void;
  onKindChange?: (kind: ValueKind) => void;
  onCustomToggle?: () => void;
  disabled?: boolean;
};

const OpDropdown: React.FC<OpDropdownProps> = ({
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
      className='w-full bg-popover'
      style={{ '--bg-light': 'var(--grl-color-bg-container-disabled)', '--bg-active': 'var(--grl-color-primary-bg)', '--color-active-text': 'var(--grl-color-primary)' } as React.CSSProperties}
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

type ValInputProps = {
  value: SimpleValue | null;
  onChange: (v: SimpleValue | null) => void;
  operator: OperatorType;
  kind: ValueKind;
  disabled?: boolean;
};

const ValInput: React.FC<ValInputProps> = ({ value, onChange, operator, kind, disabled }) =>
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

type SimpleInputProps = { value: SimpleValue | null; onChange: (v: SimpleValue) => void; disabled?: boolean };

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
      className='flex-1 min-w-[40px] p-0! [font-family:inherit] border-0! bg-transparent! text-[var(--b-font-size)]! leading-[var(--b-line-height)]! px-[var(--b-h-padding)]! py-[var(--b-v-padding)]! h-auto! min-h-[var(--b-height)] focus:shadow-none!'
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
    className='flex-1 min-w-[40px] p-0!'
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
    className='min-w-[50px] h-[var(--b-height)]!'
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
        className='min-w-[100px] p-0! h-[var(--b-height)]! min-h-0!'
        value={dayjs(dateVal)}
        onChange={(d) => d && onChange({ type: 'date', value: d.format('YYYY-MM-DD'), granularity })}
        disabled={disabled}
        variant='borderless'
        size='small'
        allowClear={false}
      />
      <Select
        className='min-w-[60px] h-[var(--b-height)]!'
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
    className='min-w-[60px] p-0! h-[var(--b-height)]! min-h-0!'
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
            sel.includes(o.v) && 'border-[var(--grl-color-primary-border)] bg-[var(--bg-active)] text-[var(--color-active-text)]',
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
      className='flex-1 min-w-0 min-h-[var(--b-height)]! h-auto! overflow-hidden'
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
      <span className='cursor-pointer select-none px-0.5 text-sm leading-[var(--b-height)] hover:opacity-70' onClick={() => !disabled && upd({ leftInclusive: !iv.leftInclusive })}>
        {iv.leftInclusive ? '[' : '('}
      </span>
      <InputNumber
        className='w-[45px] p-0!'
        value={iv.left}
        onChange={(v) => v !== null && upd({ left: v })}
        disabled={disabled}
        variant='borderless'
        size='small'
        controls={false}
      />
      <span className='text-muted-foreground'>..</span>
      <InputNumber
        className='w-[45px] p-0!'
        value={iv.right}
        onChange={(v) => v !== null && upd({ right: v })}
        disabled={disabled}
        variant='borderless'
        size='small'
        controls={false}
      />
      <span className='cursor-pointer select-none px-0.5 text-sm leading-[var(--b-height)] hover:opacity-70' onClick={() => !disabled && upd({ rightInclusive: !iv.rightInclusive })}>
        {iv.rightInclusive ? ']' : ')'}
      </span>
    </div>
  );
};

const EnumValInput: React.FC<{
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
        className='min-w-0 min-h-[var(--b-height)]! h-auto! overflow-hidden'
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
          className='min-w-0 min-h-[var(--b-height)]! h-auto! overflow-hidden'
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
          className='min-w-0 min-h-[var(--b-height)]! h-auto! overflow-hidden'
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
