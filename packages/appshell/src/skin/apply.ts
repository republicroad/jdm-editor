import type { CustomNodeSpec } from '../lib/custom-node-registry';
import type { NodeUiOverride } from './types';

/**
 * 按节点 kind 应用 UI 槽位覆写：仅替换显式给出的槽位，其余字段（kind/displayName/
 * generateNode/inferTypes…）与未命中 kind 的节点保持原样。纯函数，不改入参。
 */
export function applyNodeOverrides(
  nodes: CustomNodeSpec[],
  overrides: Record<string, NodeUiOverride> = {},
): CustomNodeSpec[] {
  const kinds = Object.keys(overrides);
  if (kinds.length === 0) {
    return nodes;
  }

  return nodes.map((node) => {
    const override = overrides[node.kind];
    if (!override) {
      return node;
    }
    return {
      ...node,
      ...(override.renderTab ? { renderTab: override.renderTab } : {}),
      ...(override.renderNode ? { renderNode: override.renderNode } : {}),
    };
  });
}
