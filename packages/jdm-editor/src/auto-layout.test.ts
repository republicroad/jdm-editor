import { describe, expect, it } from 'vitest';

import type { DecisionEdge, DecisionNode } from './components/decision-graph/dg-types';
import { computeAutoLayout } from './helpers/auto-layout';

const node = (id: string): DecisionNode =>
  ({ id, name: id, type: 'decisionTable', position: { x: 0, y: 0 } }) as unknown as DecisionNode;
const edge = (sourceId: string, targetId: string): DecisionEdge =>
  ({ id: `${sourceId}-${targetId}`, sourceId, targetId }) as unknown as DecisionEdge;

/** WS1-R6: dagre auto-layout over dynamically imported @dagrejs/dagre */
describe('computeAutoLayout', () => {
  it('places downstream nodes to the right of upstream ones (LR ranks)', async () => {
    const positions = await computeAutoLayout(
      [node('input'), node('table'), node('output')],
      [edge('input', 'table'), edge('table', 'output')],
      {
        input: { width: 220, height: 72 },
        table: { width: 220, height: 72 },
        output: { width: 220, height: 72 },
      },
    );

    expect(positions.input.x).toBeLessThan(positions.table.x);
    expect(positions.table.x).toBeLessThan(positions.output.x);
  });

  it('returns top-left coordinates derived from dagre centers', async () => {
    const size = { width: 220, height: 72 };
    const positions = await computeAutoLayout([node('a')], [], { a: size });

    // a single node is centered at (width/2, height/2) — top-left must be (0, 0)
    expect(positions.a.x).toBeCloseTo(0, 5);
    expect(positions.a.y).toBeCloseTo(0, 5);
  });

  it('ignores dangling edges instead of crashing', async () => {
    const positions = await computeAutoLayout([node('a'), node('b')], [edge('a', 'ghost'), edge('a', 'b')], {});

    expect(Object.keys(positions).sort()).toEqual(['a', 'b']);
    expect(positions.a.x).toBeLessThan(positions.b.x);
  });

  it('returns empty positions for an empty graph without importing dagre', async () => {
    const positions = await computeAutoLayout([], []);
    expect(positions).toEqual({});
  });
});
