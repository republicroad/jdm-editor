import { describe, expect, it } from 'vitest';

import type { DecisionGraphType } from '../../dg-types';
import { computeGraphDiff } from '../compute-graph-diff';

const node = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id.toUpperCase(),
  type: 'inputNode',
  position: { x: 0, y: 0 },
  ...extra,
});

const edge = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  sourceId: 'a',
  targetId: 'b',
  ...extra,
});

const graph = (nodes: unknown[] = [], edges: unknown[] = []): DecisionGraphType =>
  ({ nodes, edges }) as unknown as DecisionGraphType;

describe('computeGraphDiff', () => {
  it('两版全空图 = 无变化', () => {
    expect(computeGraphDiff(graph(), graph()).unchanged).toBe(true);
  });

  it('相同内容 = 无变化', () => {
    const a = graph([node('n1'), node('n2', { content: { cases: [1, 2] } })], [edge('e1')]);
    const b = graph([node('n1'), node('n2', { content: { cases: [1, 2] } })], [edge('e1')]);
    expect(computeGraphDiff(a, b).unchanged).toBe(true);
  });

  it('仅位置变化 = 无变化（spec 验收 #2）', () => {
    const a = graph([node('n1', { position: { x: 0, y: 0 } })], []);
    const b = graph([node('n1', { position: { x: 120, y: 240 } })], []);
    const diff = computeGraphDiff(a, b);
    expect(diff.unchanged).toBe(true);
    expect(diff.modifiedNodes).toHaveLength(0);
  });

  it('运行时 _diff 染色残留不参与比较', () => {
    const a = graph([node('n1', { _diff: { status: 'modified' } })], []);
    const b = graph([node('n1')], []);
    expect(computeGraphDiff(a, b).unchanged).toBe(true);
  });

  it('新增节点（b 有 a 无）', () => {
    const diff = computeGraphDiff(graph([node('n1')]), graph([node('n1'), node('n2', { type: 'switchNode' })]));
    expect(diff.addedNodes).toEqual([{ id: 'n2', name: 'N2', kind: 'switchNode' }]);
    expect(diff.removedNodes).toHaveLength(0);
    expect(diff.unchanged).toBe(false);
  });

  it('删除节点携带变更前名称', () => {
    const diff = computeGraphDiff(graph([node('n1'), node('old')]), graph([node('n1')]));
    expect(diff.removedNodes).toEqual([{ id: 'old', name: 'OLD', kind: 'inputNode' }]);
  });

  it('修改节点：内容变化检出并列出字段', () => {
    const a = graph([node('n1', { name: '表A', content: { hitPolicy: 'first' }, description: 'x' })]);
    const b = graph([node('n1', { name: '表B', content: { hitPolicy: 'collect' }, description: 'x' })]);
    const diff = computeGraphDiff(a, b);
    expect(diff.modifiedNodes).toEqual([{ id: 'n1', name: '表B', kind: 'inputNode', fields: ['name', 'content'] }]);
  });

  it('字段相等但键序不同的内容不算变更', () => {
    const a = graph([node('n1', { content: { a: 1, b: [1, { y: 2, x: 1 }] } })]);
    const b = graph([node('n1', { content: { b: [1, { x: 1, y: 2 }], a: 1 } })]);
    expect(computeGraphDiff(a, b).unchanged).toBe(true);
  });

  it('边独立于节点比较：增/删/改各成集合', () => {
    const a = graph([node('n1'), node('n2')], [edge('e1'), edge('e2', { sourceId: 'x' })]);
    const b = graph([node('n1'), node('n2')], [edge('e1'), edge('e3', { targetId: 'y' })]);

    const diff = computeGraphDiff(a, b);
    expect(diff.addedEdges.map((e) => e.id)).toEqual(['e3']);
    expect(diff.removedEdges.map((e) => e.id)).toEqual(['e2']);
    expect(diff.modifiedEdges.map((e) => e.id)).toEqual([]);
  });

  it('边内容变化（sourceId/targetId/name）计为修改并列出字段', () => {
    const a = graph([], [edge('e1', { targetId: 'b' })]);
    const b = graph([], [edge('e1', { targetId: 'c', name: '新连线' })]);
    const diff = computeGraphDiff(a, b);
    expect(diff.modifiedEdges).toEqual([{ id: 'e1', name: '新连线', kind: undefined, fields: ['targetId', 'name'] }]);
  });

  it('混合用例：增删改并存且 summary 完整', () => {
    const a = graph([node('n1'), node('gone')], [edge('e1')]);
    const b = graph([node('n1', { name: 'renamed' }), node('new')], [edge('e1'), edge('e2')]);
    const diff = computeGraphDiff(a, b);

    expect(diff.addedNodes.map((n) => n.id)).toEqual(['new']);
    expect(diff.removedNodes.map((n) => n.id)).toEqual(['gone']);
    expect(diff.modifiedNodes.map((n) => n.id)).toEqual(['n1']);
    expect(diff.addedEdges.map((e) => e.id)).toEqual(['e2']);
    expect(diff.unchanged).toBe(false);
  });

  it('undefined 输入数组容错（空图语义）', () => {
    const diff = computeGraphDiff({} as unknown as DecisionGraphType, graph([node('n1')]));
    expect(diff.addedNodes).toHaveLength(1);
    expect(diff.removedNodes).toHaveLength(0);
  });
});
