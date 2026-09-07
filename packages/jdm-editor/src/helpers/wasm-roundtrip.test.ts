import {
  ExpressionBuilder,
  initSync,
  parseStandardExpression,
  validateExpression,
  validateUnaryExpression,
} from '@gorules/zen-engine-wasm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// Loaded straight from node_modules so the suite always exercises the exact
// installed artifact, not a vendored copy. A caret bump that changes behavior
// fails here before it can drift the business-view projections. Vitest (both
// direct and via lerna) runs with the package root as cwd; jsdom's
// import.meta.url is an http URL and cannot be converted to a path.
const wasmBinary = () =>
  readFileSync(resolve(process.cwd(), 'node_modules/@gorules/zen-engine-wasm/dist/zen_engine_wasm_bg.wasm'));

beforeAll(() => {
  initSync({ module: wasmBinary() });
});

/**
 * Decision-table condition cells (unary grammar) across the operator families
 * the business view can produce: bare literals, comparisons, intervals with
 * mixed brackets, comma OR lists, boolean/null ops, string predicates, dates
 * with d() wrappers, and weekday/quarter chip arrays.
 */
const UNARY_CORPUS = [
  '"GOLD"',
  '99',
  'true',
  '>= 1000',
  '< 200000',
  '[200000..1000000]',
  '(1..5]',
  '[1..10)',
  '"INC","LTD","LLC"',
  '"a","b"',
  '["a", "b"]',
  'not in [1, 2]',
  '!= null',
  '== null',
  'contains($, "ship")',
  'startsWith($, "ORD-")',
  'endsWith($, "-EU")',
  "> d('2024-01-15')",
  "d($).isAfter('2024-01-15')",
  'd($).weekday() in [1, 5]',
  'd($).quarter() in [1, 4]',
  '[1,2,3,4,5]',
  '"a" or "b"',
];

/** Output-cell (standard grammar) forms the business view emits. */
const STANDARD_CORPUS = ['0.85', '"VIP_DISCOUNT"', 'customer.tier', 'amount * 0.9', '[1,2,3]', 'true', 'null'];

const parseUnaryJson = (expression: string) => {
  const builder = ExpressionBuilder.parseUnary(expression);
  const json = builder.toJson();
  builder.free();
  return json;
};

const serializeUnaryJson = (json: unknown) => {
  const builder = ExpressionBuilder.fromJson(json);
  const serialized = builder.serialize();
  builder.free();
  return serialized;
};

describe('unary round-trip against the real wasm runtime', () => {
  it.each(UNARY_CORPUS)('converges %s to a stable structured projection', (expression) => {
    const first = parseUnaryJson(expression);
    const serialized = serializeUnaryJson(first);
    const second = parseUnaryJson(serialized);

    // Re-parsing the serialized form reproduces the same structured data —
    // the business view and the expression string cannot drift apart.
    expect(second).toEqual(first);
    expect(serializeUnaryJson(second)).toBe(serialized);

    // Validators return null for valid input and an error descriptor otherwise.
    expect(validateUnaryExpression(serialized)).toBeNull();
  });

  it('serializes canonical corpus entries back to themselves', () => {
    // Entries already in canonical form must round-trip as the identical
    // string; a wasm upgrade that rewrites any of these breaks stored tables.
    // These are exactly the strings ExpressionBuilder.fromJson(ops).serialize()
    // emits for the matching operator catalog (verified via probe).
    const canonical = [
      '"GOLD"',
      '99',
      'true',
      '>= 1000',
      '< 200000',
      '[200000..1000000]',
      '(1..5]',
      '[1..10)',
      '["a", "b"]',
      'not in [1, 2]',
      'contains($, "ship")',
      'startsWith($, "ORD-")',
      'endsWith($, "-EU")',
      'd($).isAfter("2024-01-15")',
      'd($).weekday() in [1, 5]',
      'd($).quarter() in [1, 4]',
    ];
    for (const expression of canonical) {
      expect(serializeUnaryJson(parseUnaryJson(expression))).toBe(expression);
    }
  });

  it('keeps operator-structured data as a fixed point through serialize', () => {
    // The exact data shapes use-expression-state writes back for each typed
    // value control (interval brackets, chip arrays, date/time payloads).
    const structured = [
      {
        data: {
          kind: 'simple',
          operator: { type: 'between' },
          value: { type: 'interval', left: 1, right: 5, leftInclusive: true, rightInclusive: false },
        },
        serialized: '[1..5)',
      },
      {
        data: { kind: 'simple', operator: { type: 'dayOfWeekIn' }, value: { type: 'intArray', values: [1, 5] } },
        serialized: 'd($).weekday() in [1, 5]',
      },
      {
        data: { kind: 'simple', operator: { type: 'dateAfter' }, value: { type: 'date', value: '2024-01-15' } },
        serialized: 'd($).isAfter("2024-01-15")',
      },
      {
        data: { kind: 'simple', operator: { type: 'timeGt' }, value: { type: 'time', hour: 9, minute: 30 } },
        serialized: 'd($).hour() * 60 + d($).minute() > 9 * 60 + 30',
      },
      {
        data: { kind: 'simple', operator: { type: 'contains' }, value: { type: 'string', value: 'ship' } },
        serialized: 'contains($, "ship")',
      },
    ];

    for (const { data, serialized } of structured) {
      expect(serializeUnaryJson(data)).toBe(serialized);
      expect(parseUnaryJson(serialized)).toEqual(data);
    }
  });

  it('reports complex expressions as custom-mode projections', () => {
    const complex = parseUnaryJson('customer.tier == "GOLD" && amount > 100');
    expect(complex).toEqual(expect.objectContaining({ kind: 'complex' }));

    const simple = parseUnaryJson('>= 1000');
    expect(simple).toEqual(expect.objectContaining({ kind: 'simple' }));
  });

  it('flags invalid unary input through the validator', () => {
    expect(validateUnaryExpression('>>> 1')).toEqual(expect.objectContaining({ type: 'parserError' }));
    expect(validateExpression('amount >')).toEqual(expect.objectContaining({ type: 'parserError' }));
  });
});

describe('standard grammar parsing against the real wasm runtime', () => {
  it.each(STANDARD_CORPUS)('parses %s without errors', (expression) => {
    const parsed = parseStandardExpression(expression);
    expect(parsed).toBeDefined();
    expect(validateExpression(expression)).toBeNull();
  });

  it('locks the structured shape of output-cell expressions', () => {
    // Snapshot pins the JSON the standard builder renders value controls from.
    expect(parseStandardExpression('amount * 0.9')).toMatchSnapshot();
    expect(parseStandardExpression('"VIP_DISCOUNT"')).toMatchSnapshot();
  });
});
