import type { ParsedExcelData, RuleData } from '../../../../helpers/excel';
import type { ColumnFieldType, OutputFieldType } from '../../../../helpers/schema';

export type ItemValue = {
  id: string;
  label: string;
  value?: string;
  type?: 'input' | 'output';
  field?: string;
  name?: string;
  wrapInQuotes?: boolean;
};

export type MappedExcelData = {
  items: ItemValue[];
  rules: RuleData[][];
};

export type DtExcelDialogProps = {
  excelData?: ParsedExcelData[] | null;
  handleSuccess: (mappedExcelData: MappedExcelData) => void;
  handleCancel: () => void;
};

export type ImportColumn = {
  id: string;
  name: string;
  field?: string;
  type: 'input' | 'output';
  excelHeaderId?: string;
  defaultValue?: string;
  fieldType?: ColumnFieldType;
  outputFieldType?: OutputFieldType;
};

export type TableHeader = {
  id: string;
  label: string;
  value?: string;
  type?: 'input' | 'output';
};
