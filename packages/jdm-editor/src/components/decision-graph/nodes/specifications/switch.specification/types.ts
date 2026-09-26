import type { Diff } from '../../../dg-types';

export type SwitchStatement = {
  id: string;
  condition?: string;
  isDefault?: boolean;
  /** WS1-R4 增强：case 名——镜像到出边 edge.name，渲染为分支路径标签芯片 */
  name?: string;
} & Diff;

export type NodeSwitchData = {
  hitPolicy?: 'first' | 'collect';
  statements?: (SwitchStatement & Diff)[];
} & Diff;
