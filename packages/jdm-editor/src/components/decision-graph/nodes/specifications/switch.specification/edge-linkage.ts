import type { DecisionEdge } from '../../../dg-types';

/**
 * WS1-R4 增强 — case 名 ↔ 边标签联动。
 *
 * A switch statement's name is the source of truth for its branch label;
 * the outgoing edge (sourceId = switch node, sourceHandle = statement id)
 * mirrors it as `edge.name`, which mapToGraphEdge feeds to the R4 label
 * chip. Clearing the name clears the edge label.
 */
export const applyStatementNameToEdges = (
  edges: DecisionEdge[],
  switchNodeId: string,
  statementId: string,
  name: string,
): DecisionEdge[] =>
  edges.map((edge) =>
    edge.sourceId === switchNodeId && edge.sourceHandle === statementId
      ? { ...edge, name: name.trim() === '' ? undefined : name }
      : edge,
  );
