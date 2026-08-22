import { MarkerType } from '@xyflow/react';
import { describe, expect, it } from 'vitest';

import type { DecisionEdge, DecisionNode } from '../dg-types';
import { privateSymbol } from '../dg-types';
import { mapToDecisionEdge, mapToGraphEdge, mapToGraphEdges, mapToGraphNode, mapToGraphNodes } from '../dg-util';

describe('dg-util mappers', () => {
  it('maps a reactflow edge to a decision edge', () => {
    const result = mapToDecisionEdge({
      id: 'e1',
      source: 'a',
      target: 'b',
      sourceHandle: null,
      targetHandle: 'th',
      label: 'yes',
      data: {},
    });

    expect(result).toEqual({
      id: 'e1',
      sourceId: 'a',
      targetId: 'b',
      name: 'yes',
      sourceHandle: undefined,
      targetHandle: 'th',
      type: undefined,
    });
  });

  it('maps a decision node to a graph node including private metadata', () => {
    const node = {
      id: 'n1',
      name: 'Table',
      type: 'decisionTableNode',
      position: { x: 1, y: 2 },
      content: { kind: 'widget' },
      [privateSymbol]: { dimensions: { height: 40, width: 120 }, selected: true },
    } as DecisionNode;

    expect(mapToGraphNode(node)).toEqual({
      id: 'n1',
      type: 'decisionTableNode',
      position: { x: 1, y: 2 },
      height: 40,
      width: 120,
      selected: true,
      data: { name: 'Table', kind: 'widget' },
    });
  });

  it('maps graph nodes in batch', () => {
    const nodes = [
      { id: 'a', name: 'A', position: { x: 0, y: 0 } },
      { id: 'b', name: 'B', position: { x: 5, y: 5 } },
    ] as DecisionNode[];

    expect(mapToGraphNodes(nodes)).toHaveLength(2);
  });

  it('maps a decision edge to a reactflow edge with arrow marker and default type', () => {
    const edge: DecisionEdge = {
      id: 'e1',
      sourceId: 'a',
      targetId: 'b',
      sourceHandle: 'sh',
      targetHandle: null,
      name: 'label',
    };

    expect(mapToGraphEdge(edge)).toMatchObject({
      id: 'e1',
      source: 'a',
      target: 'b',
      type: 'edge',
      label: 'label',
      sourceHandle: 'sh',
      targetHandle: null,
      markerEnd: { type: MarkerType.ArrowClosed },
    });
  });

  it('preserves an existing edge type', () => {
    const edge: DecisionEdge = { id: 'e1', sourceId: 'a', targetId: 'b', type: 'customEdge' };
    expect(mapToGraphEdge(edge).type).toBe('customEdge');
  });

  it('filters incomplete edges when mapping in batch', () => {
    const edges = [
      { id: 'ok', sourceId: 'a', targetId: 'b' },
      { id: 'noSource', sourceId: '', targetId: 'b' },
      { id: 'noTarget', sourceId: 'a' },
    ] as DecisionEdge[];

    const mapped = mapToGraphEdges(edges);
    expect(mapped.map((edge) => edge.id)).toEqual(['ok']);
  });
});
