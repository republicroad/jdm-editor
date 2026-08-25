import { describe, expect, it } from 'vitest';

import type { ParsedExcelData } from '../../../../helpers/excel';
import type { NodeKind } from '../../../../helpers/schema';
import {
  assembleMergedData,
  buildAutoSelection,
  buildMergedItems,
  isHeaderMatch,
  mergeHeaders,
} from './merge-data';
import type { ItemValue, TableHeader } from './types';

const header = (id: string, label = id, value?: string, type?: TableHeader['type']): TableHeader => ({
  id,
  label,
  value,
  type,
});

const item = (id: string, label = id, value?: string, type?: ItemValue['type']): ItemValue => ({
  id,
  label,
  value,
  type,
});

const sheet = (overrides: Partial<ParsedExcelData> = {}): ParsedExcelData =>
  ({
    id: 'sheet-1',
    name: 'Sheet1',
    type: 'decisionTableNode' as NodeKind,
    position: { x: 0, y: 0 },
    headers: [],
    rules: [],
    existingTableData: {
      headers: [],
      hitPolicy: 'F',
    },
    ...overrides,
  }) as ParsedExcelData;

describe('isHeaderMatch', () => {
  it('matches by identical id', () => {
    expect(isHeaderMatch(header('a'), header('a'))).toBe(true);
  });

  it('matches by case-insensitive value', () => {
    expect(isHeaderMatch(header('a', 'A', 'Name'), header('b', 'B', 'name'))).toBe(true);
  });

  it('matches by case-insensitive label when values are absent', () => {
    expect(isHeaderMatch(header('a', 'Amount'), header('b', 'amount'))).toBe(true);
  });

  it('returns false for disjoint headers', () => {
    expect(isHeaderMatch(header('a', 'X', 'x'), header('b', 'Y', 'y'))).toBe(false);
  });
});

describe('mergeHeaders', () => {
  it('prefers the new header fields and falls back to existing ones', () => {
    const merged = mergeHeaders(header('n', '', undefined), header('e', 'Label', 'value', 'input'));
    expect(merged).toEqual({ id: 'n', label: 'Label', value: 'value', type: 'input' });
  });

  it('uses the new header alone and derives value from label when unmatched', () => {
    expect(mergeHeaders(header('n', 'Fresh'))).toEqual({ id: 'n', label: 'Fresh', value: 'Fresh' });
  });
});

describe('buildMergedItems', () => {
  it('merges new headers with matching existing ones and appends leftovers', () => {
    const existing = [header('keep', 'Kept', 'kept', 'input'), header('extra', 'Extra', 'extra')];
    const incoming = [header('keep', 'Renamed', 'renamed')];

    const items = buildMergedItems(existing, incoming);

    expect(items.map((i) => i.id)).toEqual(['keep', 'extra', '_description']);
    expect(items[0].label).toBe('Renamed');
    expect(items[0].value).toBe('renamed');
    expect(items[1].value).toBe('extra');
  });

  it('injects a single _description item exactly once', () => {
    const withDescription = buildMergedItems([], [header('_description', 'DESC', 'description')]);
    expect(withDescription.filter((i) => i.id === '_description')).toHaveLength(1);

    const withoutDescription = buildMergedItems([], [header('a')]);
    expect(withoutDescription.at(-1)?.id).toBe('_description');
  });
});

describe('buildAutoSelection', () => {
  it('marks second-to-last as output when a description column exists', () => {
    const selection = buildAutoSelection([
      item('a', 'A', 'a'),
      item('b', 'B', 'b'),
      item('d', 'DESCRIPTION', 'description'),
    ]);

    expect(selection['a'].type).not.toBe('output');
    expect(selection['b'].type).toBe('output');
    expect(selection['d'].type).not.toBe('output');
  });

  it('marks the last non-description column as output without description', () => {
    const selection = buildAutoSelection([item('a', 'A', 'a'), item('b', 'B', 'b')]);
    expect(selection['a'].type).not.toBe('output');
    expect(selection['b'].type).toBe('output');
  });

  it('never reassigns output when one already exists earlier in the list', () => {
    const selection = buildAutoSelection([item('a', 'A', 'a', 'output'), item('b', 'B', 'b')]);
    expect(selection['a'].type).toBe('output');
    expect(selection['b'].type).not.toBe('output');
  });
});

describe('assembleMergedData', () => {
  const excel = [
    sheet({
      id: 'sheet-1',
      name: 'Pricing',
      headers: [{ id: 'h1' }, { id: 'h2' }, { id: '_id' }],
      rules: [
        [
          { headerId: 'h1', value: 'a,b' },
          { headerId: 'h2', value: 'plain' },
          { headerId: 'ignored', value: 'dropped' },
          { headerId: '_id', value: 'row-1' },
        ],
      ],
      existingTableData: {
        headers: [] as never,
        hitPolicy: 'F',
        inputField: 'customer',
        outputPath: '$.out',
        passThrough: true,
        executionMode: 'loop',
      },
    }),
  ];

  const selected: Record<string, Record<string, ItemValue>> = {
    step0: {
      h1: item('col-h1', 'Col H1', 'out1', 'output'),
      h2: item('col-h2', 'Col H2', 'in2'),
    },
  };
  const wraps = { step0: { h1: true } };

  it('filters rules to selected headers plus _id and remaps header ids', () => {
    const [merged] = assembleMergedData(excel, selected, wraps);

    expect(merged.rules[0]).toHaveLength(3);
    const byHeader = Object.fromEntries(merged.rules[0].map((r) => [r.headerId, r.value]));
    expect(byHeader['col-h1']).toBe('"a", "b"');
    expect(byHeader['col-h2']).toBe('plain');
    expect(byHeader['_id']).toBe('row-1');
  });

  it('defaults non-description items to input and applies wrap flags', () => {
    const [merged] = assembleMergedData(excel, selected, wraps);

    const h1 = merged.items.find((i) => i.id === 'col-h1');
    expect(h1?.type).toBe('output'); // preserved from selection
    expect(h1?.wrapInQuotes).toBe(true);

    const h2 = merged.items.find((i) => i.id === 'col-h2');
    expect(h2?.type).toBe('input');
    expect(h2?.wrapInQuotes).toBe(false);
  });

  it('passes through sheet metadata from existing table data', () => {
    const [merged] = assembleMergedData(excel, selected, wraps);

    expect(merged.id).toBe('sheet-1');
    expect(merged.name).toBe('Pricing');
    expect(merged.hitPolicy).toBe('F');
    expect(merged.inputField).toBe('customer');
    expect(merged.outputPath).toBe('$.out');
    expect(merged.passThrough).toBe(true);
    expect(merged.executionMode).toBe('loop');
  });
});
