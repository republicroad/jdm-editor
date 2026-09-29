import { type VariableType } from '@gorules/zen-engine-wasm';
import type { NodeProps } from '@xyflow/react';
import type React from 'react';

import type { DecisionNode } from '../../dg-types';
import type { DecisionNodeProps } from '../decision-node';

export enum NodeKind {
  Input = 'inputNode',
  Output = 'outputNode',
  DecisionTable = 'decisionTableNode',
  Function = 'functionNode',
  Expression = 'expressionNode',
  Switch = 'switchNode',
}

export type MinimalNodeProps = Pick<NodeProps, 'id' | 'selected'> & { data: any };
export type MinimalNodeSpecification = Pick<
  NodeSpecification,
  'color' | 'icon' | 'displayName' | 'documentationUrl' | 'helper' | 'renderSettings'
>;

type GenerateNodeParams = {
  index: number;
};

export type InferTypeData<T> = {
  input: VariableType;
  content: T;
};

export type NodeSpecification<T = any> = {
  icon?: React.ReactNode;
  type: string;
  color?: DecisionNodeProps['color'];
  group?: string;
  displayName: string | React.ReactNode;
  documentationUrl?: string;
  shortDescription?: string;
  /** L6（ADR-008）：面板搜索附加关键词——如 schema 容器节点的内部工具名（命中时高亮词条） */
  searchKeywords?: string[];
  /** ADR-009：pack 元数据（目录 origin 徽标/版本/许可），schema 端点与文件协议透传 */
  meta?: { origin: 'reference' | 'extension' | 'industry'; version: string; license?: 'oss' | 'proprietary' };
  helper?: string | React.ReactNode;
  renderTab?: (props: { id: string; user?: string; customFunctions?: any }) => React.ReactNode;
  getDiffContent?: (current: T, previous: T) => T;
  generateNode: (params: GenerateNodeParams) => Omit<DecisionNode<T>, 'position' | 'id' | 'type'>;
  renderNode: React.FC<MinimalNodeProps & { specification: MinimalNodeSpecification }>;
  renderSettings?: React.FC<{ id: string }>;
  inferTypes?: {
    needsUpdate: (content: T, prevContent: T) => boolean;
    determineOutputType: (state: InferTypeData<T>) => VariableType;
  };

  onNodeAdd?: (node: DecisionNode<T>) => Promise<DecisionNode<T>>;
};
