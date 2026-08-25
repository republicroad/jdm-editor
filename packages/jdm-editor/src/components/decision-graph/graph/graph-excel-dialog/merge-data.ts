import type { ParsedExcelData } from '../../../../helpers/excel';
import type { ItemValue, MergedDataItem, SelectedItems, TableHeader } from './types';

export const isHeaderMatch = (header1: TableHeader, header2: TableHeader) => {
  return (
    header1.id === header2.id ||
    header1.value?.toLowerCase() === header2.value?.toLowerCase() ||
    header1.label?.toLowerCase() === header2.label?.toLowerCase()
  );
};

export const mergeHeaders = (newHeader: TableHeader, existingHeader?: TableHeader) => {
  if (existingHeader) {
    return {
      id: newHeader.id,
      label: newHeader.label || existingHeader.label,
      value: newHeader.value || existingHeader.value,
      type: newHeader.type || existingHeader.type,
    };
  }

  return {
    ...newHeader,
    value: newHeader.value || newHeader.label,
  };
};

/** Merge excel headers with the table's existing headers, keeping unmatched ones. */
export const buildMergedItems = (
  existingTableHeaders: TableHeader[],
  newTableHeaders: TableHeader[],
): ItemValue[] => {
  const items = [
    ...newTableHeaders.map((newTableHeader) => {
      const existingHeader = existingTableHeaders.find((header) => isHeaderMatch(header, newTableHeader));

      return mergeHeaders(newTableHeader, existingHeader);
    }),
    ...existingTableHeaders.filter(
      (existingTableHeader) => !newTableHeaders.some((newHeader) => isHeaderMatch(newHeader, existingTableHeader)),
    ),
  ];

  if (!items.some((item) => item.id === '_description')) {
    items.push({
      id: '_description',
      label: 'DESCRIPTION',
      value: 'description',
    });
  }

  return items;
};

/**
 * Auto-pick input/output roles: second-to-last matched column becomes output
 * when a description column exists, otherwise the last non-description match.
 */
export const buildAutoSelection = (
  matchingHeaders: ItemValue[],
): Record<string, ItemValue> => {
  return matchingHeaders.reduce((acc, tableHeader, index) => {
    const hasDescription = matchingHeaders.some((header) => header.value === 'description');
    const hasOutputAlready = matchingHeaders.slice(0, index).some((header) => header.type === 'output');

    let shouldBeOutput;

    if (hasDescription) {
      // If there's description, set second-to-last as output
      shouldBeOutput = index === matchingHeaders.length - 2 && !hasOutputAlready;
    } else {
      // If no description, set last as output (excluding if it IS description)
      shouldBeOutput =
        index === matchingHeaders.length - 1 && tableHeader.value !== 'description' && !hasOutputAlready;
    }

    return {
      ...acc,
      [tableHeader.id]: {
        id: tableHeader.id,
        label: tableHeader.label,
        value: tableHeader.value,
        type: shouldBeOutput ? 'output' : tableHeader.type,
      },
    };
  }, {});
};

/** Assemble the final per-sheet node payloads from the user's selections. */
export const assembleMergedData = (
  excelData: ParsedExcelData[],
  selectedItems: SelectedItems,
  headerWrapStates: Record<string, Record<string, boolean>>,
): MergedDataItem[] => {
  return Object.keys(selectedItems).map((stepKey, index) => {
    const stepItems = selectedItems[stepKey];
    const stepWrapStates = headerWrapStates[stepKey] || {};

    const items = Object.keys(stepItems).map((key) => ({
      ...stepItems[key],
      wrapInQuotes: stepWrapStates[key] || false,
      ...(stepItems[key].value !== 'description' && {
        type: stepItems[key].type ?? 'input',
      }),
    }));

    const wrap = items.reduce(
      (acc, item) => {
        acc[item.id] = item.wrapInQuotes || false;
        return acc;
      },
      {} as Record<string, boolean>,
    );

    const selectedHeaderIds = Object.keys(stepItems);

    const rules = (excelData[index].rules || []).map((rulesData) => {
      return rulesData
        .filter((rule) => [...selectedHeaderIds, '_id'].includes(rule.headerId))
        .map((rule) => ({
          headerId: stepItems[rule.headerId]?.id ?? rule.headerId,
          value: wrap[stepItems[rule.headerId]?.id ?? rule.headerId]
            ? rule.value
              ? rule.value
                  .split(',')
                  .map((s) => `"${s.trim()}"`)
                  .join(', ')
              : ''
            : rule.value,
        }));
    });

    return {
      items,
      rules,
      id: excelData[index].id,
      name: excelData[index].name,
      type: excelData[index].type,
      position: excelData[index].position,
      hitPolicy: excelData[index].existingTableData.hitPolicy,
      inputField: excelData[index].existingTableData.inputField,
      outputPath: excelData[index].existingTableData.outputPath,
      passThrough: excelData[index].existingTableData.passThrough,
      executionMode: excelData[index].existingTableData.executionMode,
    };
  });
};
