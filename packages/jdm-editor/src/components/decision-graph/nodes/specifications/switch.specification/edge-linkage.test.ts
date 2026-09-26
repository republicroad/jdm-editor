import { describe, expect, it } from 'vitest';

import type { DecisionEdge } from '../../../dg-types';
import { applyStatementNameToEdges } from './edge-linkage';

const edge = (partial: Partial<DecisionEdge>): DecisionEdge =>
  ({ id: 'e', type: 'edge', sourceId: 'sw', targetId: 't', ...partial }) as unknown as DecisionEdge;

/** WS1-R4 增强 — case 名镜像到出边 edge.name */
describe('applyStatementNameToEdges', () => {
  const statementEdge = { sourceId: 'sw', sourceHandle: 'stmt-1' };

  it("mirrors the name onto the statement's outgoing edge only", () => {
    const edges = [
      edge({ id: 'e1', ...statementEdge }),
      edge({ id: 'e2', sourceId: 'sw', sourceHandle: 'stmt-2' }),
      edge({ id: 'e3', sourceId: 'other', sourceHandle: 'stmt-1' }),
      edge({ id: 'e4', sourceId: 'sw' }),
    ];

    const result = applyStatementNameToEdges(edges as DecisionEdge[], 'sw', 'stmt-1', 'highRisk');

    expect(result.find((e) => e.id === 'e1')?.name).toBe('highRisk');
    expect(result.find((e) => e.id === 'e2')?.name).toBeUndefined();
    expect(result.find((e) => e.id === 'e3')?.name).toBeUndefined();
    expect(result.find((e) => e.id === 'e4')?.name).toBeUndefined();
  });

  it('clears the edge label when the name is blank', () => {
    const edges = [edge({ id: 'e1', ...statementEdge, name: 'highRisk' })] as DecisionEdge[];

    const blanked = applyStatementNameToEdges(edges, 'sw', 'stmt-1', '   ');

    expect(blanked[0].name).toBeUndefined();
  });

  it('does not mutate the input edges', () => {
    const original = edge({ id: 'e1', ...statementEdge, name: 'old' });
    const edges = [original];

    applyStatementNameToEdges(edges, 'sw', 'stmt-1', 'new');

    expect(original.name).toBe('old');
  });
});
