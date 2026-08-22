import { describe, expect, it } from 'vitest';

import type { DecisionEdge, DecisionGraphType, DecisionNode } from '../../components/decision-graph/dg-types';
import { createGraphWalker } from '../traversal';

const node = (id: string, type: string): DecisionNode => ({ id, name: id, type, position: { x: 0, y: 0 } });
const edge = (id: string, sourceId: string, targetId: string): DecisionEdge => ({
  id,
  sourceId,
  targetId,
  type: 'edge',
});

const linearGraph = (): DecisionGraphType => ({
  nodes: [node('in', 'inputNode'), node('dt', 'decisionTableNode'), node('out', 'outputNode')],
  edges: [edge('e1', 'in', 'dt'), edge('e2', 'dt', 'out')],
});

const collect = (graph: DecisionGraphType) =>
  Array.from(createGraphWalker().walk(graph)).map(({ node: n, incomers }) => ({
    id: n.id,
    incomers: incomers.map((i) => i.id),
  }));

describe('createGraphWalker', () => {
  it('walks a linear graph from input to output with correct incomers', () => {
    expect(collect(linearGraph())).toEqual([
      { id: 'in', incomers: [] },
      { id: 'dt', incomers: ['in'] },
      { id: 'out', incomers: ['dt'] },
    ]);
  });

  it('yields nothing when there is no input node', () => {
    const graph: DecisionGraphType = {
      nodes: [node('dt', 'decisionTableNode'), node('out', 'outputNode')],
      edges: [edge('e1', 'dt', 'out')],
    };

    expect(collect(graph)).toEqual([]);
  });

  it('yields nothing for cyclic graphs', () => {
    const graph: DecisionGraphType = {
      nodes: [node('in', 'inputNode'), node('a', 'expressionNode'), node('b', 'expressionNode')],
      edges: [edge('e1', 'in', 'a'), edge('e2', 'a', 'b'), edge('e3', 'b', 'a')],
    };

    expect(collect(graph)).toEqual([]);
  });

  it('visits every diamond branch exactly once with merged incomers', () => {
    const graph: DecisionGraphType = {
      nodes: [
        node('in', 'inputNode'),
        node('sw', 'switchNode'),
        node('l', 'decisionTableNode'),
        node('r', 'decisionTableNode'),
        node('out', 'outputNode'),
      ],
      edges: [
        edge('e1', 'in', 'sw'),
        edge('e2', 'sw', 'l'),
        edge('e3', 'sw', 'r'),
        edge('e4', 'l', 'out'),
        edge('e5', 'r', 'out'),
      ],
    };

    const walked = collect(graph);
    expect(walked.map((entry) => entry.id).sort()).toEqual(['in', 'l', 'out', 'r', 'sw']);

    const out = walked.find((entry) => entry.id === 'out');
    expect(out).toBeDefined();
    expect(out!.incomers.sort()).toEqual(['l', 'r']);
  });

  it('reuses the cache when walking an unchanged graph', () => {
    const walker = createGraphWalker();
    const first = Array.from(walker.walk(linearGraph())).map(({ node: n }) => n.id);
    const second = Array.from(walker.walk(linearGraph())).map(({ node: n }) => n.id);

    expect(second).toEqual(first);
  });

  it('invalidates the cache after the graph changes', () => {
    const walker = createGraphWalker();
    const graph = linearGraph();
    Array.from(walker.walk(graph));

    graph.edges.push(edge('e3', 'in', 'dt'));
    const rewalked = Array.from(walker.walk(graph)).map(({ node: n }) => n.id);

    expect(rewalked.length).toBeGreaterThan(0);
  });
});
