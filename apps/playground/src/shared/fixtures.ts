import { type GraphPersistenceAdapter, createIndexedDbAdapter } from '@republicroad/jdm-appshell';

/**
 * MPA 各实例共享的持久化面：IndexedDB 按 origin 存储，graph 实例 Save 的产物
 * 对 trust / reui 实例直接可见（同一 GRAPH_ID），跨实例延续编辑成果。
 */
export const GRAPH_ID = 'playground-graph';

export const graphAdapter: GraphPersistenceAdapter = createIndexedDbAdapter();

export const initialGraph = {
  id: GRAPH_ID,
  name: 'playground',
  nodes: [
    { id: 'in-1', type: 'inputNode', position: { x: 40, y: 160 }, name: 'Request' },
    { id: 'out-1', type: 'outputNode', position: { x: 640, y: 160 }, name: 'Response' },
  ],
  edges: [],
};

export const initialTable = {
  hitPolicy: 'first',
  inputs: [{ id: 'in-tier', name: 'Tier', field: 'customer.tier', fieldType: { type: 'string' } }],
  outputs: [{ id: 'out-rate', name: 'Rate', field: 'discount.rate', outputFieldType: { type: 'number' } }],
  rules: [
    { 'id': 'r1', 'in-tier': '"GOLD"', 'out-rate': '0.85' },
    { 'id': 'r2', 'in-tier': '"SILVER"', 'out-rate': '0.9' },
  ],
};
