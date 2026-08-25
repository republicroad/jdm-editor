import { describe, expect, it } from 'vitest';

import type { ColumnFieldType } from '../../../../helpers/schema';
import {
  GRID_OPS,
  NO_VALUE_OPS,
  OPS,
  OPS_BY_KIND,
  defaultValue,
  enumFilterOption,
  getEnumOptions,
  getOp,
  getValueKind,
  type ValueKind,
} from './constants';
import { inferKindFromExpr, isExprCompatibleWithKind } from './use-expression-state';

const expr = (operatorType: string, value?: { type: string } & Record<string, unknown>) =>
  ({
    kind: 'simple',
    operator: { type: operatorType },
    ...(value ? { value } : {}),
  }) as never;

describe('defaultValue matrix', () => {
  it.each(NO_VALUE_OPS)('returns null for no-value operator %s', (op) => {
    expect(defaultValue(op, 'string')).toBeNull();
  });

  it('creates an inclusive interval for between', () => {
    expect(defaultValue('between', 'number')).toMatchObject({
      type: 'interval',
      left: 0,
      right: 100,
      leftInclusive: true,
      rightInclusive: true,
    });
  });

  it('dispatches in/notIn array kind by field kind', () => {
    expect(defaultValue('in', 'number')).toMatchObject({ type: 'numberArray', values: [] });
    expect(defaultValue('notIn', 'string')).toMatchObject({ type: 'stringArray', values: [] });
  });

  it.each(['dateAfter', 'dateBefore', 'dateSame', 'dateSameOrAfter', 'dateSameOrBefore'] as const)(
    'creates a date value for %s',
    (op) => {
      const value = defaultValue(op, 'any');
      expect(value).toMatchObject({ type: 'date' });
      expect((value as { value: string }).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    },
  );

  it.each(['timeGt', 'timeGte', 'timeLt', 'timeLte'] as const)('defaults to 9:00 for %s', (op) => {
    expect(defaultValue(op, 'any')).toEqual({ type: 'time', hour: 9, minute: 0 });
  });

  it('seeds weekday and quarter chip arrays', () => {
    expect(defaultValue('dayOfWeekIn', 'number')).toEqual({ type: 'intArray', values: [1, 2, 3, 4, 5] });
    expect(defaultValue('quarterIn', 'number')).toEqual({ type: 'intArray', values: [1] });
  });

  it.each(['startsWith', 'endsWith', 'contains'] as const)('starts empty for %s', (op) => {
    expect(defaultValue(op, 'string')).toEqual({ type: 'string', value: '' });
  });

  it('falls back by field kind for comparison operators', () => {
    expect(defaultValue('gt', 'number')).toEqual({ type: 'number', value: 0 });
    expect(defaultValue('eq', 'boolean')).toEqual({ type: 'boolean', value: true });
    expect(defaultValue('eq', 'date')).toEqual({ type: 'string', value: '' });
  });
});

describe('getValueKind / enumFilterOption / getEnumOptions', () => {
  it.each([
    [{ type: 'string' }, 'string'],
    [{ type: 'number' }, 'number'],
    [{ type: 'boolean' }, 'boolean'],
    [{ type: 'date' }, 'date'],
    [{ type: 'any' }, 'any'],
    [undefined, 'any'],
  ] as const)('maps %j to %s', (ft, expected) => {
    expect(getValueKind(ft)).toBe(expected);
  });

  it('filters options by case-insensitive label or value substring', () => {
    const option = { label: 'Pending Review', value: 'PR-01' };
    expect(enumFilterOption('pending', option)).toBe(true);
    expect(enumFilterOption('pr-0', option)).toBe(true);
    expect(enumFilterOption('shipped', option)).toBe(false);
  });

  it('resolves inline enum values with the loose flag', () => {
    const ft = {
      type: 'string',
      enum: { type: 'inline', values: [{ label: 'A', value: 'a' }], loose: true },
    } as ColumnFieldType;
    expect(getEnumOptions(ft)).toEqual({ values: [{ label: 'A', value: 'a' }], loose: true });
  });

  it('resolves ref enums through the dictionary map and rejects unknown refs', () => {
    const ft = { type: 'string', enum: { type: 'ref', ref: 'statuses' } } as ColumnFieldType;
    const dictionaries = { statuses: [{ label: 'Open', value: 'open' }] };

    expect(getEnumOptions(ft, dictionaries)).toEqual({
      values: [{ label: 'Open', value: 'open' }],
      loose: false,
    });
    expect(getEnumOptions(ft, {})).toBeNull();
  });

  it('returns null without an enum, with empty inline values, or on non-string fields', () => {
    expect(getEnumOptions({ type: 'string' })).toBeNull();
    expect(
      getEnumOptions({ type: 'string', enum: { type: 'inline', values: [] } } as ColumnFieldType),
    ).toBeNull();
    expect(getEnumOptions({ type: 'number' })).toBeNull();
  });
});

describe('inferKindFromExpr / isExprCompatibleWithKind', () => {
  it('defers to custom rendering for complex expressions', () => {
    expect(inferKindFromExpr({ kind: 'complex' } as never)).toBeNull();
    expect(isExprCompatibleWithKind({ kind: 'complex' } as never, 'string')).toBe(true);
  });

  it('infers date kinds from date/time operators and weekday/quarter chips', () => {
    expect(inferKindFromExpr(expr('dateAfter'))).toBe('date');
    expect(inferKindFromExpr(expr('timeGt'))).toBe('date');
    expect(inferKindFromExpr(expr('dayOfWeekIn'))).toBe('date');
    expect(inferKindFromExpr(expr('quarterIn'))).toBe('date');
  });

  it('infers string kinds from text operators and value payloads', () => {
    expect(inferKindFromExpr(expr('startsWith'))).toBe('string');
    expect(inferKindFromExpr(expr('eq', { type: 'stringArray', values: [] }))).toBe('string');
    expect(inferKindFromExpr(expr('between', { type: 'interval' }))).toBe('number');
    expect(inferKindFromExpr(expr('eq', { type: 'boolean', value: true }))).toBe('boolean');
  });

  it('returns null when there is no value and no operator hint', () => {
    expect(inferKindFromExpr(expr('eq'))).toBeNull();
  });

  it('rejects operators outside the kind catalog before inspecting values', () => {
    expect(isExprCompatibleWithKind(expr('between'), 'string')).toBe(false);
  });

  it('accepts no-value operators regardless of kind', () => {
    expect(isExprCompatibleWithKind(expr('notNull'), 'number')).toBe(true);
  });

  it('validates value payload types per kind', () => {
    expect(isExprCompatibleWithKind(expr('eq', { type: 'boolean', value: true }), 'boolean')).toBe(true);
    expect(isExprCompatibleWithKind(expr('eq', { type: 'string', value: '' }), 'boolean')).toBe(false);
    expect(isExprCompatibleWithKind(expr('dayOfWeekIn', { type: 'intArray', values: [1] }), 'date')).toBe(true);
    expect(isExprCompatibleWithKind(expr('timeGt', { type: 'string', value: 'x' }), 'date')).toBe(false);
    expect(isExprCompatibleWithKind(expr('in', { type: 'numberArray', values: [] }), 'number')).toBe(true);
    expect(isExprCompatibleWithKind(expr('eq', { type: 'anything' }), 'any')).toBe(true);
  });
});

describe('operator catalog invariants', () => {
  const kinds = Object.keys(OPS_BY_KIND) as ValueKind[];

  it('keeps grid operators a subset of the per-kind list', () => {
    for (const kind of kinds) {
      for (const op of GRID_OPS[kind]) {
        expect(OPS_BY_KIND[kind]).toContain(op);
      }
    }
  });

  it('gives every per-kind default operator a usable default value', () => {
    for (const kind of kinds) {
      for (const op of OPS_BY_KIND[kind]) {
        if (NO_VALUE_OPS.includes(op)) continue;
        // Any operator reachable from a kind must produce a non-null seed so
        // switching kinds never lands on an uneditable empty state.
        if (['in', 'notIn'].includes(op) && kind === 'date') continue;
        expect(defaultValue(op, kind === 'any' ? 'string' : kind), `${op}/${kind}`).not.toBeNull();
      }
    }
  });

  it('falls back to the first operator for unknown lookups', () => {
    expect(getOp('nonexistent' as never)).toEqual(OPS[0]);
  });
});
