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

  it('preserves switch statement case names through a parse round-trip (WS1-R4)', () => {
    // zod strips undeclared keys — the case name mirrors onto edge.name for the
    // branch label chip, so an upload round-trip must not silently drop it
    const result = nodeSchema.parse({
      id: 'sw',
      type: NodeKind.Switch,
      name: 'Switch',
      content: {
        hitPolicy: 'first',
        statements: [
          { id: 's1', condition: 'x > 1', name: 'highRisk' },
          { id: 's2', condition: 'x <= 1', name: '' },
        ],
      },
    });

    expect(result.content.statements[0].name).toBe('highRisk');
    expect(result.content.statements[1].name).toBeUndefined();
  });

  it('preserves every model field through a full parse round-trip (upload fidelity)', () => {
    // The JSON upload path safeParses the whole model; zod strips any key not
    // declared in the schemas (the statements[].name and edge.name bugs were
    // both this class). This fixture fills EVERY declared field of every
    // builtin node with canonical (post-transform) values — parse output must
    // deep-equal the input, so any future undeclared-key strip fails here.
    // Note: model `settings` is intentionally absent — the upload handler
    // passes it into safeParse but no schema declares it and nothing in the
    // editor consumes it.
    const model = {
      nodes: [
        {
          id: 'in-1',
          type: NodeKind.Input,
          name: 'Request',
          position: { x: 1, y: 2 },
          content: {
            schema: '{"type":"object"}',
            expressions: [{ id: 'ie-1', key: 'k', value: 'v', type: 'string' }],
            inputField: 'req',
            outputPath: 'res',
          },
        },
        {
          id: 'out-1',
          type: NodeKind.Output,
          name: 'Response',
          position: { x: 3, y: 4 },
          content: { schema: '{"type":"object"}' },
        },
        {
          id: 'dt-1',
          type: NodeKind.DecisionTable,
          name: 'Table',
          position: { x: 5, y: 6 },
          content: {
            hitPolicy: 'collect',
            passThrough: true,
            inputField: 't-in',
            outputPath: 't-out',
            executionMode: 'loop',
            inputs: [
              {
                id: 'dti-1',
                name: 'Risk',
                field: 'customer.risk',
                defaultValue: '10',
                fieldType: {
                  type: 'string',
                  enum: { type: 'inline', values: [{ label: 'L', value: 'V' }], loose: true },
                },
              },
              { id: 'dti-2', name: 'Age', field: 'customer.age', defaultValue: null, fieldType: { type: 'number' } },
            ],
            outputs: [
              {
                id: 'dto-1',
                name: 'Discount',
                field: 'discount',
                defaultValue: '0',
                outputFieldType: { type: 'string', enum: { type: 'ref', ref: 'dic-1', loose: false } },
              },
              { id: 'dto-2', name: 'Fee', field: 'fee', defaultValue: null, outputFieldType: { type: 'auto' } },
            ],
            rules: [{ _id: 'r1', _description: 'desc', dti_1: '> 90', dti_2: '< 40', dto_1: '"Y"', dto_2: '5' }],
          },
        },
        {
          id: 'fn-1',
          type: NodeKind.Function,
          name: 'Function',
          position: { x: 7, y: 8 },
          content: { source: 'return 1;' },
        },
        {
          id: 'ex-1',
          type: NodeKind.Expression,
          name: 'Expression',
          position: { x: 9, y: 10 },
          content: {
            expressions: [{ id: 'ee-1', key: 'out', value: '1 + 1' }],
            passThrough: true,
            inputField: 'e-in',
            outputPath: 'e-out',
            executionMode: 'loop',
          },
        },
        {
          id: 'de-1',
          type: NodeKind.Decision,
          name: 'Decision',
          position: { x: 11, y: 12 },
          content: { key: 'sub', passThrough: true, inputField: 'd-in', outputPath: 'd-out', executionMode: 'single' },
        },
        {
          id: 'sw-1',
          type: NodeKind.Switch,
          name: 'Switch',
          position: { x: 13, y: 14 },
          content: {
            hitPolicy: 'first',
            statements: [
              { id: 'st-1', condition: 'a > 1', isDefault: false, name: 'highRisk' },
              { id: 'st-2', condition: '', isDefault: true },
            ],
          },
        },
        {
          id: 'cn-1',
          type: CustomKind,
          name: 'Custom',
          position: { x: 15, y: 16 },
          content: { kind: 'http.request', config: { url: 'https://x', nested: { deep: [1, 2] } } },
        },
      ],
      edges: [
        { id: 'ed-1', sourceId: 'sw-1', targetId: 'dt-1', sourceHandle: 'st-1', type: 'edge', name: 'highRisk' },
        { id: 'ed-2', sourceId: 'in-1', targetId: 'sw-1', type: 'edge' },
      ],
    };

    const result = decisionModelSchema.parse(JSON.parse(JSON.stringify(model)));

    expect(result).toEqual(model);
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
