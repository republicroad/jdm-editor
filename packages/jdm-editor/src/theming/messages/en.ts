/**
 * English message catalog — source of truth for all user-visible strings.
 * Keys use flat dot notation: `{component}.{context}.{element}`.
 * Chinese translation lives in `zh-CN.ts`.
 */
export const en = {
  // ── common ──
  'common.ok': 'OK',
  'common.cancel': 'Cancel',
  'common.remove': 'Remove',
  'common.delete': 'Delete',
  'common.retry': 'Retry',
  'common.close': 'Close',
  'common.update': 'Update',
  'common.create': 'Create',
  'common.convert': 'Convert',
  'common.format': 'Format',
  'common.recover': 'Recover',
  'common.copy': 'Copy',

  // ── decision table ──
  'dt.toolbar.import': 'Import Excel',
  'dt.toolbar.export': 'Export Excel',
  'dt.toolbar.addRowAbove': 'Add row above',
  'dt.toolbar.addRowBelow': 'Add row below',
  'dt.toolbar.removeRow': 'Remove row',
  'dt.toolbar.removeRowConfirm': 'Remove row?',
  'dt.table.column': 'Table column',
  'dt.table.excelColumn': 'Excel column',
  'dt.table.selectExcelColumn': 'Select Excel column',
  'dt.table.description': 'Description',
  'dt.table.selectDescription': 'Select Excel column for description',
  'dt.table.reorderFields': 'Reorder fields',

  // ── field edit ──
  'dt.field.input.add': 'Add Input',
  'dt.field.input.label': 'Input Field',
  'dt.field.output.add': 'Add Output',
  'dt.field.output.label': 'Output Field',
  'dt.field.label': 'Field label',
  'dt.field.name': 'Name',
  'dt.field.type': 'Field Type',
  'dt.field.outputType': 'Output Type',
  'dt.field.editColumn': 'Edit column',
  'dt.field.removeColumn': 'Remove column',
  'dt.field.removeConfirm': 'Remove this column?',
  'dt.field.wrapQuotes': 'Wrap values in quotes',

  // ── excel dialog ──
  'dt.excel.title': 'Map Excel data',
  'dt.excel.input': 'Input',
  'dt.excel.output': 'Output',
  'dt.excel.enterFieldName': 'Enter field name',

  // ── decision graph ──
  'dg.node.decisionTables': 'Decision Tables',
  'dg.node.expressions': 'Expressions',
  'dg.node.functions': 'Functions',
  'dg.toolbar.uploadJson': 'Upload JSON',
  'dg.toolbar.uploadExcel': 'Upload Excel',
  'dg.toolbar.downloadJson': 'Download JSON',
  'dg.toolbar.downloadExcel': 'Download Excel',
  'dg.toolbar.searchNodes': 'Search nodes',
  'dg.toolbar.closeClose': 'Close panel',
  'dg.toolbar.schema': 'JSON Schema',
  'dg.tabs.close': 'Close',
  'dg.tabs.closeAll': 'Close all Tabs',
  'dg.tabs.closeOthers': 'Close other Tabs',
  'dg.tabs.closeRight': 'Close Tabs to the right',
  'dg.tabs.closeLeft': 'Close Tabs to the left',
  'dg.jsonSchema.title': 'Convert to JSON Schema',
  'dg.jsonSchema.copyJson': 'Copy JSON',

  // ── expression ──
  'expression.placeholder': 'Expression',
  'expression.addRowAbove': 'Add row above',
  'expression.addRowBelow': 'Add row below',

  // ── function ──
  'func.debugger.copy': 'Copy to clipboard',
  'func.debugger.copied': 'Copied to clipboard',
  'func.preview.noResults': 'Run simulation to see the results',

  // ── safe boundary ──
  'safe.title': 'Something went wrong',
  'safe.retry': 'Retry',

  // ── misc ──
  'misc.delete': 'Delete',
} as const;

export type TranslationKey = keyof typeof en;
