import type { ParsedExcelData, RuleData } from '../../../../helpers/excel';
import type { NodeKind } from '../../../../helpers/schema';
import type { HitPolicy } from '../../../decision-table/context/dt-store.context';

export type ItemValue = {
  id: string;
  label: string;
  value?: string;
  type?: 'input' | 'output';
  field?: string;
  name?: string;
  wrapInQuotes?: boolean;
};

export type SelectedItems = {
  [stepKey: string]: {
    [headerId: string]: ItemValue;
  };
};

export type MergedDataItem = {
  items: ItemValue[];
  rules: RuleData[][];
  id: string;
  name: string;
  type: NodeKind;
  position: { x: number; y: number };
  hitPolicy: HitPolicy | string;
  inputField?: string | null;
  outputPath?: string | null;
  passThrough?: boolean;
  executionMode?: 'single' | 'loop';
};

export type GraphExcelDialogProps = {
  excelData?: ParsedExcelData[] | null;
  handleSuccess: (items: MergedDataItem[]) => void;
  handleCancel: () => void;
};

export type TableHeader = {
  id: string;
  label: string;
  value?: string;
  type?: 'input' | 'output';
};
