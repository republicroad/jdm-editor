import type { DecisionEdge, DecisionNode } from '../components/decision-graph/dg-types';

/**
 * WS1-R6 — dagre auto-layout, lazily loaded.
 *
 * @dagrejs/dagre is a regular dependency kept EXTERNAL by the build (see
 * vite.config.ts): dist/index.js preserves `import('@dagrejs/dagre')`, so
 * the kernel bundle never pays for it and host bundlers emit their own lazy
 * chunk, fetched only when the user triggers auto layout (roadmap §1.1).
 *
 * Dagre computes node CENTERS; reactflow positions are TOP-LEFT corners —
 * measured node dimensions (or the fallback estimate) convert between them.
 */

export type AutoLayoutOptions = {
  /** Gap between two ranks (columns in the LR layout). Default 100. */
  ranksep?: number;
  /** Gap between nodes in the same rank. Default 60. */
  nodesep?: number;
};

export type NodeMeasuredSize = { width: number; height: number };

export type AutoLayoutPositions = Record<string, { x: number; y: number }>;

const FALLBACK_SIZE: NodeMeasuredSize = { width: 220, height: 72 };

export const computeAutoLayout = async (
  nodes: DecisionNode[],
  edges: DecisionEdge[],
  measured: Record<string, NodeMeasuredSize> = {},
  options: AutoLayoutOptions = {},
): Promise<AutoLayoutPositions> => {
  if (nodes.length === 0) {
    return {};
  }

  const dagre = await import('@dagrejs/dagre');
  const g = new dagre.graphlib.Graph({ compound: false });
  g.setGraph({ rankdir: 'LR', nodesep: options.nodesep ?? 60, ranksep: options.ranksep ?? 100 });
  g.setDefaultNodeLabel(() => ({}));
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const size = measured[node.id] ?? FALLBACK_SIZE;
    // dagre mutates the size object in place (stamps x/y/rank onto it) —
    // a shared reference (e.g. FALLBACK_SIZE) would alias every node's
    // readback to the last-laid-out node's position
    g.setNode(node.id, { ...size });
  }
  for (const edge of edges) {
    // dangling edges (source/target removed mid-edit) must not crash layout
    if (g.hasNode(edge.sourceId) && g.hasNode(edge.targetId)) {
      g.setEdge(edge.sourceId, edge.targetId);
    }
  }

  dagre.layout(g);

  const positions: AutoLayoutPositions = {};
  for (const node of nodes) {
    const { x, y, width, height } = g.node(node.id) as { x: number; y: number; width: number; height: number };
    positions[node.id] = { x: x - width / 2, y: y - height / 2 };
  }
  return positions;
};
