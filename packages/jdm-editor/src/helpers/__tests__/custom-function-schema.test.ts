import { describe, expect, it } from 'vitest';

import {
  buildDefaultFunctionExpression,
  editorValueToNamedCall,
  healExpressionsForScope,
  resolveFunctionScope,
} from '../custom-function-schema';

const namespaces = [
  {
    name: 'debug',
    title: 'debug',
    tools: [
      {
        name: 'inout',
        title: 'inout',
        parameters: {
          type: 'object',
          properties: {
            a: { type: 'string', description: '参数 a', default: 'x' },
            b: { type: 'integer', description: '参数 b' },
          },
          required: ['a'],
        },
        returns: { type: 'string' },
      },
      { name: 'func_without_args', parameters: { type: 'object', properties: {} } },
    ],
  },
  {
    name: 'shared_counter',
    title: 'shared_counter',
    tools: [
      { name: 'rate_1h', parameters: { type: 'object', properties: { field: { type: 'string' } } } },
      { name: 'group_distinct_1h', parameters: { type: 'object', properties: { a: {}, b: {} } } },
    ],
  },
  {
    name: 'phone',
    title: 'phone',
    tools: [{ name: 'phone_number_info', parameters: { type: 'object', properties: { phone: {} } } }],
  },
];

describe('resolveFunctionScope', () => {
  it('returns free scope without kind', () => {
    const scope = resolveFunctionScope(undefined, namespaces);
    expect(scope.mode).toBe('free');
    expect(scope.functions.map((f) => f.name)).toEqual([
      'inout',
      'func_without_args',
      'rate_1h',
      'group_distinct_1h',
      'phone_number_info',
    ]);
  });

  it('returns legacy scope for UDF kind with all functions', () => {
    const scope = resolveFunctionScope('UDF', namespaces);
    expect(scope.mode).toBe('legacy');
    expect(scope.functions).toHaveLength(5);
  });

  it('returns scoped scope for namespace container kind', () => {
    const scope = resolveFunctionScope('shared_counter', namespaces);
    expect(scope.mode).toBe('scoped');
    expect(scope.functions.map((f) => f.name)).toEqual(['rate_1h', 'group_distinct_1h']);
    expect(scope.functions.every((f) => f.namespace === 'shared_counter')).toBe(true);
  });

  it('returns scoped scope for namespace without explicit type', () => {
    const scope = resolveFunctionScope('phone', namespaces);
    expect(scope.mode).toBe('scoped');
    expect(scope.functions.map((f) => f.name)).toEqual(['phone_number_info']);
  });

  it('returns free scope for bare function-name kinds (naming abandoned)', () => {
    expect(resolveFunctionScope('inout', namespaces).mode).toBe('free');
    expect(resolveFunctionScope('phone_number_info', namespaces).mode).toBe('free');
  });

  it('does not treat legacy derived ns.tool kind as scoped (naming abandoned)', () => {
    const scope = resolveFunctionScope('debug.inout', namespaces);
    expect(scope.mode).toBe('free');
  });

  it('returns free scope for unknown kinds', () => {
    expect(resolveFunctionScope('nonexistent', namespaces).mode).toBe('free');
  });

  it('returns free scope with empty functions for non-array input', () => {
    const scope = resolveFunctionScope('shared_counter', undefined);
    expect(scope.mode).toBe('free');
    expect(scope.functions).toHaveLength(0);
  });
});

describe('buildDefaultFunctionExpression', () => {
  it('builds value array and arg exprs from parameter defaults', () => {
    const funcDef = namespaces[0].tools[0];
    const entry = buildDefaultFunctionExpression(funcDef);

    expect(entry.type).toBe('function');
    expect(entry.value).toEqual(['inout', 'x', '']);
    expect(entry.arg_exprs).toEqual({ a: 'x', b: '' });
    expect(entry.funcmeta).toBe(funcDef);
    expect(entry.returnSchema).toEqual({ type: 'string' });
  });
});

describe('editorValueToNamedCall（ADR-015 #3 写路径切规范形，seal ADR-022 移植）', () => {
  const funcDef = namespaces[0].tools[0]; // inout(a, b)

  it('maps positional args onto declared names in declaration order', () => {
    expect(editorValueToNamedCall(['inout', 'x', '1'], funcDef)).toEqual({
      $call: 'inout',
      kwargs: { a: 'x', b: '1' },
    });
  });

  it('collects overflow args into the $positional reserved key', () => {
    expect(editorValueToNamedCall(['inout', 'x', '1', 'extra'], funcDef)).toEqual({
      $call: 'inout',
      kwargs: { a: 'x', b: '1', $positional: ['extra'] },
    });
  });

  it('merges priorKwargs extra keys and drops stale $positional when no overflow', () => {
    const prior = { custom: 'keep', $positional: ['old'] };
    expect(editorValueToNamedCall(['inout', 'x'], funcDef, prior)).toEqual({
      $call: 'inout',
      kwargs: { custom: 'keep', a: 'x' },
    });
  });

  it('passes named-form values through untouched (already canonical)', () => {
    expect(editorValueToNamedCall({ $call: 'inout', kwargs: { a: 'x' } }, funcDef)).toBeNull();
  });

  it('returns null for non-array, empty, or nameless editor values', () => {
    expect(editorValueToNamedCall('fn;;x', funcDef)).toBeNull();
    expect(editorValueToNamedCall([], funcDef)).toBeNull();
    expect(editorValueToNamedCall(['', 'x'], funcDef)).toBeNull();
    expect(editorValueToNamedCall(['  '], funcDef)).toBeNull();
  });

  it('without funcDef, canonicalizes with all args into $positional (nothing lost, drift flags it)', () => {
    expect(editorValueToNamedCall(['mystery', 'x'])).toEqual({
      $call: 'mystery',
      kwargs: { $positional: ['x'] },
    });
  });
});

describe('healExpressionsForScope', () => {
  const scopedScope = resolveFunctionScope('shared_counter', namespaces);
  const legacyScope = resolveFunctionScope('UDF', namespaces);

  it('resets scoped rows to the first function when out of set', () => {
    const expressions = [{ id: '1', key: 'out', value: ['inout', '1'], type: 'function' }];
    const healed = healExpressionsForScope(expressions, scopedScope);

    expect(healed?.[0].value).toEqual(['rate_1h', '']);
    expect(healed?.[0].funcmeta.name).toBe('rate_1h');
  });

  it('heals drifted string-form values', () => {
    const expressions = [{ id: '1', key: 'out', value: 'inout;;ip', type: 'function' }];
    const healed = healExpressionsForScope(expressions, scopedScope);

    expect(healed?.[0].value).toEqual(['rate_1h', '']);
  });

  it('keeps scoped rows whose function is inside the set', () => {
    const expressions = [{ id: '1', key: 'out', value: ['group_distinct_1h', 'a', 'b'], type: 'function' }];
    expect(healExpressionsForScope(expressions, scopedScope)).toBeNull();
  });

  it('never heals legacy scope', () => {
    const expressions = [{ id: '1', key: 'out', value: ['whatever', '1'], type: 'function' }];
    expect(healExpressionsForScope(expressions, legacyScope)).toBeNull();
  });

  it('ignores non-function rows', () => {
    const expressions = [{ id: '1', key: 'plain', value: 'input.x' }];
    expect(healExpressionsForScope(expressions, scopedScope)).toBeNull();
  });

  it('returns null for empty scope functions', () => {
    const expressions = [{ id: '1', key: 'out', value: ['rate_1h', '1'], type: 'function' }];
    expect(healExpressionsForScope(expressions, { mode: 'scoped', functions: [] })).toBeNull();
  });
});
