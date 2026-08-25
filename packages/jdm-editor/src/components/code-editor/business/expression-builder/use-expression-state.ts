import type { ExpressionBuilderData, SimpleValue } from '@gorules/zen-engine-wasm';
import { ExpressionBuilder as ExpressionBuilderWasm } from '@gorules/zen-engine-wasm';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { match } from 'ts-pattern';

import { NO_VALUE_OPS, OPS_BY_KIND, type ValueKind } from './constants';

export const inferKindFromExpr = (data: ExpressionBuilderData): ValueKind | null => {
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

export const isExprCompatibleWithKind = (data: ExpressionBuilderData, kind: ValueKind): boolean => {
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

export const useExpressionState = (value: string, onChange: (v: string) => void) => {
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
