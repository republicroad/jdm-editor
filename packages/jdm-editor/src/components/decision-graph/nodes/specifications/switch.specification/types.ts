import type { Diff } from '../../../dg-types';

export type SwitchStatement = {
  id: string;
  condition?: string;
  isDefault?: boolean;
} & Diff;

export type NodeSwitchData = {
  hitPolicy?: 'first' | 'collect';
  statements?: (SwitchStatement & Diff)[];
} & Diff;
