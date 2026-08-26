import type { ParsedExcelData, RuleData } from '../../../../helpers/excel';
import type { ImportColumn, ItemValue, MappedExcelData, TableHeader } from './types';

const isHeaderMatch = (header1: TableHeader, header2: TableHeader) => {
  return (
    header1.id === header2.id ||
    header1.value?.toLowerCase() === header2.value?.toLowerCase() ||
    header1.label?.toLowerCase() === header2.label?.toLowerCase()
  );
};

/**
 * Derive the mappable column list from the spreadsheet snapshot: existing
 * table columns are matched against excel headers (by id/value/label) and
 * enriched with their schema metadata. When the sheet has no output column,
 * the last input column is promoted to output so every import yields one.
 */
export const buildImportColumns = (spreadSheetData: ParsedExcelData): ImportColumn[] => {
  const existingTableHeaders: TableHeader[] = spreadSheetData.existingTableData.headers
    .filter((h) => h.type !== undefined)
    .map((h) => ({
      id: h.id,
      label: h.name as string,
      value: h.field,
      type: h.type,
    }));

  const excelHeaders: TableHeader[] = (spreadSheetData.headers || [])
    .filter((h) => h.id !== '_description' && h.id !== '_id')
    .map((h) => ({
      id: h.id || crypto.randomUUID(),
      label: h.name as string,
      value: h.value,
      type: h._type as 'input' | 'output' | undefined,
    }));

  const schemaItems = spreadSheetData.existingTableData.headers;

  const importColumns: ImportColumn[] = existingTableHeaders
    .filter((h) => h.type === 'input' || h.type === 'output')
    .map((tableHeader) => {
      const matchedExcel = excelHeaders.find((eh) => isHeaderMatch(eh, tableHeader));
      const schemaItem = schemaItems.find((s) => s.id === tableHeader.id);
      return {
        id: tableHeader.id,
        name: tableHeader.label,
        field: tableHeader.value,
        type: tableHeader.type as 'input' | 'output',
        excelHeaderId: matchedExcel?.id,
        defaultValue: schemaItem?.defaultValue,
        fieldType: schemaItem?.fieldType,
        outputFieldType: schemaItem?.outputFieldType,
      };
    });

  // If no outputs exist, make the last input an output
  if (!importColumns.some((c) => c.type === 'output')) {
    const lastInput = [...importColumns].reverse().find((c) => c.type === 'input');
    if (lastInput) {
      lastInput.type = 'output';
    }
  }

  return importColumns;
};

export type AssembleMappedDataArgs = {
  spreadSheetData: ParsedExcelData;
  columns: ImportColumn[];
  disabledColumns: Record<string, boolean>;
  wrapStates: Record<string, boolean>;
  descriptionExcelId?: string;
  descriptionEnabled: boolean;
};

/** Build items + rules payload for the mapped excel import. */
export const assembleMappedData = ({
  spreadSheetData,
  columns,
  disabledColumns,
  wrapStates,
  descriptionExcelId,
  descriptionEnabled,
}: AssembleMappedDataArgs): MappedExcelData => {
  const enabled = columns.filter((c) => !disabledColumns[c.id]);
  const inputItems = enabled
    .filter((c) => c.type === 'input')
    .map((c) => ({
      id: c.id,
      label: c.name,
      value: c.field || c.name,
      type: 'input' as const,
      wrapInQuotes: wrapStates[c.id] || false,
    }));
  const outputItems = enabled
    .filter((c) => c.type === 'output')
    .map((c) => ({
      id: c.id,
      label: c.name,
      value: c.field || c.name,
      type: 'output' as const,
      wrapInQuotes: wrapStates[c.id] || false,
    }));
  const items: ItemValue[] = [...inputItems, ...outputItems];

  if (descriptionEnabled && descriptionExcelId) {
    items.push({ id: '_description', label: 'Description', value: 'description' });
  }

  const wrapLookup = items.reduce(
    (acc, item) => {
      acc[item.id] = item.wrapInQuotes || false;
      return acc;
    },
    {} as Record<string, boolean>,
  );

  const rules = spreadSheetData.rules.map((ruleRow) => {
    const ruleData: RuleData[] = [];
    for (const col of enabled) {
      const excelRule = col.excelHeaderId ? ruleRow.find((r) => r.headerId === col.excelHeaderId) : undefined;
      const rawValue = excelRule?.value ?? col.defaultValue ?? '';
      const value =
        wrapLookup[col.id] && rawValue
          ? rawValue
              .split(',')
              .map((s) => `"${s.trim()}"`)
              .join(', ')
          : rawValue;
      ruleData.push({ headerId: col.id, value });
    }
    // Add _id
    const idRule = ruleRow.find((r) => r.headerId === '_id');
    if (idRule) ruleData.push(idRule);
    // Add description
    if (descriptionEnabled && descriptionExcelId) {
      const descRule = ruleRow.find((r) => r.headerId === descriptionExcelId);
      ruleData.push({ headerId: '_description', value: descRule?.value ?? '' });
    }
    return ruleData;
  });

  return { items, rules };
};
