import { describe, expect, it } from 'vitest';

import type { ParsedExcelData, RuleData } from '../../../../helpers/excel';
import type { NodeKind } from '../../../../helpers/schema';
import type { TableSchemaItem } from '../../context/dt-store.context';
import { assembleMappedData, buildImportColumns } from './mapping';
import type { ImportColumn } from './types';

const schemaItem = (
  overrides: Partial<TableSchemaItem> & {
    id: string;
    name?: string;
    field?: string;
    type?: 'input' | 'output';
  },
): TableSchemaItem & { type: 'input' | 'output' } =>
  ({ name: overrides.id, ...overrides }) as TableSchemaItem & { type: 'input' | 'output' };

const sheet = (overrides: Partial<ParsedExcelData> = {}): ParsedExcelData =>
  ({
    id: 'sheet-1',
    name: 'Sheet1',
    type: 'decisionTableNode' as NodeKind,
    position: { x: 0, y: 0 },
    headers: [],
    rules: [],
    existingTableData: {
      headers: [] as TableSchemaItem[],
      hitPolicy: 'F',
    },
    ...overrides,
  }) as ParsedExcelData;

describe('buildImportColumns', () => {
  it('matches existing columns to excel headers by value (case-insensitive)', () => {
    const data = sheet({
      headers: [
        { id: 'x1', name: 'Customer', value: 'customer' },
        { id: 'x2', name: 'Total', value: 'total' },
      ],
      existingTableData: {
        headers: [
          schemaItem({ id: 'in-a', name: 'customer', field: 'Customer', type: 'input' }),
          schemaItem({ id: 'out-b', name: 'total', field: 'TOTAL', type: 'output' }),
        ],
        hitPolicy: 'F',
      },    });

    const columns = buildImportColumns(data);
    expect(columns.find((c) => c.id === 'in-a')?.excelHeaderId).toBe('x1');
    expect(columns.find((c) => c.id === 'out-b')?.excelHeaderId).toBe('x2');
  });

  it('carries schema metadata onto the mapped columns', () => {
    const fieldType = { type: 'string' } as const;
    const outputFieldType = { type: 'number' } as const;
    const data = sheet({
      existingTableData: {
        headers: [
          schemaItem({
            id: 'in-a',
            name: 'age',
            field: 'age',
            type: 'input',
            defaultValue: '18',
            fieldType,
            outputFieldType,
          }),
        ],
        hitPolicy: 'F',
      },
    });

    const [col] = buildImportColumns(data);
    expect(col.defaultValue).toBe('18');
    expect(col.fieldType).toEqual(fieldType);
    // Schema items carry both; the input column surfaces its own kind.
    expect(col.outputFieldType).toEqual(outputFieldType);
  });

  it('promotes the last input to output when the table has none', () => {
    const data = sheet({
      existingTableData: {
        headers: [
          schemaItem({ id: 'in-a', name: 'a', field: 'a', type: 'input' }),
          schemaItem({ id: 'in-b', name: 'b', field: 'b', type: 'input' }),
        ],
        hitPolicy: 'F',
      },
    });

    const columns = buildImportColumns(data);
    expect(columns.map((c) => c.type)).toEqual(['input', 'output']);
    expect(columns[1].id).toBe('in-b');
  });

  it('leaves unmatched excelHeaderId undefined and keeps explicit outputs', () => {
    const data = sheet({
      headers: [{ id: 'x9', name: 'Unknown', value: 'unknown' }],
      existingTableData: {
        headers: [
          schemaItem({ id: 'in-a', name: 'a', field: 'a', type: 'input' }),
          schemaItem({ id: 'out-b', name: 'b', field: 'b', type: 'output' }),
        ],
        hitPolicy: 'F',
      },
    });

    const columns = buildImportColumns(data);
    const inA = columns.find((c) => c.id === 'in-a') as ImportColumn;
    expect(inA.excelHeaderId).toBeUndefined();
    expect(columns.find((c) => c.id === 'out-b')?.type).toBe('output');
  });
});

describe('assembleMappedData', () => {
  const spreadSheetData = sheet({
    headers: [{ id: 'x1' }, { id: '_description', name: 'Notes' }],
    rules: [
      [
        { headerId: 'x1', value: 'a,b' },
        { headerId: '_description', value: 'note text' },
        { headerId: '_id', value: 'row-9' },
      ],
    ],
  });
  const columns: ImportColumn[] = [
    { id: 'in-a', name: 'A', field: 'a', type: 'input', excelHeaderId: 'x1' },
    { id: 'out-b', name: 'B', field: 'b', type: 'output' },
  ];

  const assemble = (over: Partial<Parameters<typeof assembleMappedData>[0]> = {}) =>
    assembleMappedData({
      spreadSheetData,
      columns,
      disabledColumns: {},
      wrapStates: {},
      descriptionEnabled: true,
      descriptionExcelId: '_description',
      ...over,
    });

  it('orders items inputs-first and appends description when enabled', () => {
    const { items } = assemble();

    expect(items.map((i) => i.id)).toEqual(['in-a', 'out-b', '_description']);
    expect(items[0].type).toBe('input');
    expect(items[1].type).toBe('output');
  });

  it('omits description item when disabled or unselected', () => {
    expect(assemble({ descriptionEnabled: false }).items.map((i) => i.id)).not.toContain('_description');
    expect(
      assemble({ descriptionEnabled: true, descriptionExcelId: undefined }).items.map((i) => i.id),
    ).not.toContain('_description');
  });

  it('quotes comma-split wrapped values and leaves unwrapped values raw', () => {
    const { rules } = assemble({ wrapStates: { 'in-a': true } });
    const byHeader = Object.fromEntries(rules[0].map((r) => [r.headerId, r.value]));

    expect(byHeader['in-a']).toBe('"a", "b"');
    expect(byHeader['out-b']).toBe('');
  });

  it('falls back to column defaultValue when no excel rule matches', () => {
    const withDefault = columns.map((c) => (c.id === 'out-b' ? { ...c, defaultValue: '42' } : c));
    const { rules } = assemble({ columns: withDefault, wrapStates: {} });

    expect(rules[0].find((r: RuleData) => r.headerId === 'out-b')?.value).toBe('42');
  });

  it('passes _id rules through untouched and emits description values per row', () => {
    const { rules } = assemble();

    const row = rules[0];
    expect(row.find((r) => r.headerId === '_id')).toEqual({ headerId: '_id', value: 'row-9' });
    expect(row.find((r) => r.headerId === '_description')).toEqual({
      headerId: '_description',
      value: 'note text',
    });
  });

  it('excludes disabled columns from both items and rules', () => {
    const { items, rules } = assemble({ disabledColumns: { 'in-a': true }, wrapStates: {} });

    expect(items.map((i) => i.id)).toEqual(['out-b', '_description']);
    expect(rules[0].some((r) => r.headerId === 'in-a')).toBe(false);
  });

  it('emits an empty description rule when the row has no matching header cell', () => {
    const sparse = sheet({
      rules: [[{ headerId: 'x1', value: 'a,b' }]],
    });
    const { rules } = assemble({ spreadSheetData: sparse });

    expect(rules[0].find((r) => r.headerId === '_description')?.value).toBe('');
  });
});
