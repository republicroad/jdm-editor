import { describe, expect, it } from 'vitest';

import {
  CustomKind,
  DECISION_GRAPH_CONTENT_TYPE,
  NodeKind,
  decisionModelSchema,
  edgeSchema,
  nodeSchema,
} from '../schema';

const position = { x: 10, y: 20 };

describe('schema', () => {
  it('exposes the canonical JDM content type', () => {
    expect(DECISION_GRAPH_CONTENT_TYPE).toBe('application/vnd.gorules.decision');
  });

  it('parses an input node and fills defaults', () => {
    const result = nodeSchema.parse({ id: 'in', type: NodeKind.Input, name: 'Input', position });

    expect(result).toMatchObject({
      id: 'in',
      name: 'Input',
      position,
      content: { schema: '' },
    });
  });

  it('normalizes nullish decision table fields', () => {
    const result = nodeSchema.parse({
      id: 'dt',
      type: NodeKind.DecisionTable,
      name: 'Table',
      content: {
        hitPolicy: null,
        executionMode: undefined,
        passThrough: undefined,
        inputField: '   ',
        outputPath: '',
        inputs: [{ id: 'i1', field: 'age' }],
        outputs: [{ id: 'o1', name: 'Output', field: 'result' }],
        rules: [{ age: null }],
      },
    });

    expect(result.content.hitPolicy).toBe('first');
    expect(result.content.executionMode).toBe('single');
    expect(result.content.passThrough).toBe(false);
    expect(result.content.inputField).toBe(null);
    expect(result.content.outputPath).toBe(null);
    expect(result.content.rules).toEqual([{ age: '' }]);
    expect(result.content.inputs[0].field).toBe('age');
  });

  it('keeps non-empty inputField values', () => {
    const result = nodeSchema.parse({
      id: 'dt',
      type: NodeKind.DecisionTable,
      name: 'Table',
      content: { inputField: 'customer', inputs: [], outputs: [], rules: [] },
    });

    expect(result.content.inputField).toBe('customer');
  });

  it('accepts function node content as string or object', () => {
    const asString = nodeSchema.parse({ id: 'f1', type: NodeKind.Function, name: 'Fn', content: 'return 1' });
    expect(asString.content).toBe('return 1');

    const asObject = nodeSchema.parse({ id: 'f2', type: NodeKind.Function, name: 'Fn', content: {} });
    expect(asObject.content.source).toBe('');
  });

  it('parses switch statements with defaults', () => {
    const result = nodeSchema.parse({
      id: 'sw',
      type: NodeKind.Switch,
      name: 'Switch',
      content: {
        hitPolicy: null,
        statements: [{ id: 's1', condition: 'x > 1', isDefault: null }, { id: 's2' }],
      },
    });

    expect(result.content.hitPolicy).toBe('first');
    expect(result.content.statements[0].isDefault).toBe(false);
    expect(result.content.statements[1].condition).toBe('');
    expect(result.content.statements[1].isDefault).toBe(false);
  });

  it('requires a key for decision nodes and normalizes options', () => {
    const result = nodeSchema.parse({
      id: 'd1',
      type: NodeKind.Decision,
      name: 'Decision',
      content: { key: 'decision', executionMode: null },
    });
    expect(result.content.executionMode).toBe('single');

    expect(() => nodeSchema.parse({ id: 'd2', type: NodeKind.Decision, name: 'Decision', content: {} })).toThrowError();
  });

  it('parses expression nodes with defaulting keys and values', () => {
    const result = nodeSchema.parse({
      id: 'e1',
      type: NodeKind.Expression,
      name: 'Expression',
      content: { expressions: [{ id: 'exp1' }] },
    });

    expect(result.content.expressions[0]).toMatchObject({ id: 'exp1', key: '', value: '' });
    expect(result.content.passThrough).toBe(false);
  });

  it('rejects built-in kinds without required props but allows unknown custom kinds', () => {
    expect(() => nodeSchema.parse({ id: 'bad', type: NodeKind.Output })).toThrowError();

    const unknown = nodeSchema.parse({
      id: 'u1',
      type: 'someUnknownKind',
      name: 'Unknown',
      position,
      content: { anything: true },
    });
    expect(unknown.type).toBe('someUnknownKind');

    const custom = nodeSchema.parse({
      id: 'c1',
      type: CustomKind,
      name: 'Custom',
      position,
      content: { kind: 'myWidget', config: { a: 1 } },
    });
    expect(custom.content.kind).toBe('myWidget');
  });

  it('validates edges strictly', () => {
    const edge = edgeSchema.parse({ id: 'e', sourceId: 'a', targetId: 'b', type: 'edge' });
    expect(edge.sourceHandle).toBeUndefined();

    expect(() => edgeSchema.parse({ id: 'e', sourceId: 'a', targetId: 'b', type: 'link' })).toThrowError();
  });

  it('defaults decision model collections', () => {
    expect(decisionModelSchema.parse({})).toEqual({ nodes: [], edges: [] });
  });
});
