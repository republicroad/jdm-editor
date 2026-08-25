import type { SimpleOperator } from '@gorules/zen-engine-wasm';
import React, { useCallback, useImperativeHandle, useRef, useState } from 'react';
import { P, match } from 'ts-pattern';

import type { ColumnFieldType } from '../../../../helpers/schema';
import { useDictionaries } from '../../../../theme';
import { CodeEditorBase } from '../../ce-base';
import { focusBuilderRoot } from '../focus-helper';
import {
  BUILDER_BG_VARS,
  BUILDER_TOKENS,
  NO_VALUE_OPS,
  OPS_BY_KIND,
  defaultValue,
  getEnumOptions,
  getOp,
  getValueKind,
  type OperatorType,
  type ValueKind,
} from './constants';
import { OpDropdown } from './op-dropdown';
import { EnumValInput, ValInput } from './value-inputs';
import { inferKindFromExpr, isExprCompatibleWithKind, useExpressionState } from './use-expression-state';

export type ExpressionBuilderProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  fieldType?: ColumnFieldType;
  maxRows?: number;
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
