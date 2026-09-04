import { describe, expect, test } from 'bun:test';

import type { CustomNodeSpec } from '../../lib/custom-node-registry';
import { applyNodeOverrides } from '../apply';

const baseNode = (kind: string, tab: string, node: string): CustomNodeSpec =>
  ({
    kind,
    displayName: kind,
    generateNode: () => ({ name: kind }),
    renderTab: () => tab,
    renderNode: (() => node) as CustomNodeSpec['renderNode'],
  }) as unknown as CustomNodeSpec;

describe('applyNodeOverrides', () => {
  const nodes = [baseNode('crypto', 'crypto-tab', 'crypto-node'), baseNode('debug', 'debug-tab', 'debug-node')];

  test('空覆写原样返回（同一引用）', () => {
    expect(applyNodeOverrides(nodes)).toBe(nodes);
    expect(applyNodeOverrides(nodes, {})).toBe(nodes);
  });

  test('按 kind 只替换显式给出的槽位', () => {
    const [overridden] = applyNodeOverrides(nodes, {
      crypto: { renderTab: () => 'hijacked-tab' },
    });
    expect(overridden?.kind).toBe('crypto');
    expect((overridden?.renderTab as () => string)()).toBe('hijacked-tab');
    expect((overridden?.renderNode as () => string)()).toBe('crypto-node');
  });

  test('renderNode 与 renderTab 可同时劫持', () => {
    const [overridden] = applyNodeOverrides(nodes, {
      crypto: { renderTab: () => 't2', renderNode: (() => 'n2') as CustomNodeSpec['renderNode'] },
    });
    expect((overridden?.renderTab as () => string)()).toBe('t2');
    expect((overridden?.renderNode as () => string)()).toBe('n2');
  });

  test('未命中 kind 的节点保持原引用', () => {
    const [, debugNode] = applyNodeOverrides(nodes, { crypto: { renderTab: () => 'x' } });
    expect(debugNode).toBe(nodes[1]);
  });

  test('不修改入参数组', () => {
    applyNodeOverrides(nodes, { crypto: { renderTab: () => 'y' } });
    expect((nodes[0].renderTab as () => string)()).toBe('crypto-tab');
  });
});
