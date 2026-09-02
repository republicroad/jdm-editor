import { describe, expect, it } from 'vitest';

import {
  buildRequestExampleTemplateFromDefinitions,
  collectExampleDataPaths,
  formatJsonDraft,
  getRequestExampleDataDefinitionConflicts,
  getRequestExampleSources,
  mergeRequestExampleDefaultsByDefinitions,
  normalizeRequestExampleDataByDefinitions,
  updateRequestSchemaExamples,
} from '../examples';
import type { RequestDefinition } from '../types';

const definition = (overrides: Partial<RequestDefinition> = {}): RequestDefinition => ({
  id: '1',
  path: 'name',
  name: 'Name',
  type: 'string',
  description: '',
  format: '',
  order: 0,
  depth: 0,
  parentPath: null,
  source: 'schema.properties',
  ...overrides,
});

describe('mergeRequestExampleDefaultsByDefinitions', () => {
  it('fills missing fields with parsed defaults', () => {
    const data = {};
    const definitions = [
      definition({ path: 'name', type: 'string', defaultValue: 'anon' }),
      definition({ path: 'count', type: 'number', defaultValue: '42' }),
      definition({ path: 'active', type: 'boolean', defaultValue: 'true' }),
    ];

    expect(mergeRequestExampleDefaultsByDefinitions(data, definitions)).toEqual({
      name: 'anon',
      count: 42,
      active: true,
    });
  });

  it('parses object and array defaults from JSON strings', () => {
    const definitions = [
      definition({ path: 'meta', type: 'object', defaultValue: '{"k":1}' }),
      definition({ path: 'tags', type: 'array', defaultValue: '["a","b"]' }),
    ];

    expect(mergeRequestExampleDefaultsByDefinitions({}, definitions)).toEqual({
      meta: { k: 1 },
      tags: ['a', 'b'],
    });
  });

  it('preserves existing non-skeleton values', () => {
    const data = { name: 'existing', deep: 'keep-me' };
    const definitions = [
      definition({ path: 'name', type: 'string', defaultValue: 'anon' }),
      definition({ path: 'user.name', type: 'string', defaultValue: 'nested' }),
    ];

    expect(mergeRequestExampleDefaultsByDefinitions(data, definitions)).toEqual({
      name: 'existing',
      deep: 'keep-me',
      user: { name: 'nested' },
    });
  });

  it('replaces skeleton placeholder values with defaults', () => {
    const data = { count: 0, active: false, tags: [], meta: {}, empty: '' };
    const definitions = [
      definition({ path: 'count', type: 'number', defaultValue: '5' }),
      definition({ path: 'active', type: 'boolean', defaultValue: 'true' }),
      definition({ path: 'tags', type: 'array', defaultValue: '["x"]' }),
      definition({ path: 'meta', type: 'object', defaultValue: '{"a":1}' }),
      definition({ path: 'empty', type: 'string', defaultValue: 'filled' }),
    ];

    expect(mergeRequestExampleDefaultsByDefinitions(data, definitions)).toEqual({
      count: 5,
      active: true,
      tags: ['x'],
      meta: { a: 1 },
      empty: 'filled',
    });
  });

  it('does not mutate the input data', () => {
    const data = { count: 0, user: { name: '' } };
    const definitions = [
      definition({ path: 'count', type: 'number', defaultValue: '5' }),
      definition({ path: 'user.name', type: 'string', defaultValue: 'nested' }),
    ];

    const merged = mergeRequestExampleDefaultsByDefinitions(data, definitions);

    expect(merged).toEqual({ count: 5, user: { name: 'nested' } });
    expect(data).toEqual({ count: 0, user: { name: '' } });
  });

  it('skips definitions without defaults or with blank name/path', () => {
    const definitions = [
      definition({ path: 'x', type: 'number' }),
      definition({ path: 'y', type: 'string', defaultValue: 'v' }),
      definition({ path: 'y', name: ' ', type: 'string', defaultValue: 'w' }),
    ];

    expect(mergeRequestExampleDefaultsByDefinitions({}, definitions)).toEqual({ y: 'v' });
  });
});

describe('normalizeRequestExampleDataByDefinitions', () => {
  it('normalizes datetime values to ISO-ish strings', () => {
    const data = { createdAt: '2024-01-01', updatedAt: '2024-01-01 10:30:00', name: 'alice', count: 3 };
    const definitions = [
      definition({ path: 'createdAt', type: 'datetime' }),
      definition({ path: 'updatedAt', type: 'datetime' }),
      definition({ path: 'name', type: 'string' }),
    ];

    expect(normalizeRequestExampleDataByDefinitions(data, definitions)).toEqual({
      createdAt: '2024-01-01T00:00:00+08:00',
      updatedAt: '2024-01-01T10:30:00+08:00',
      name: 'alice',
      count: 3,
    });
  });

  it('leaves non-datetime values untouched and does not mutate input', () => {
    const data = { createdAt: 123, name: 'alice' };
    const definitions = [definition({ path: 'createdAt', type: 'datetime' })];

    const result = normalizeRequestExampleDataByDefinitions(data, definitions);

    expect(result).toEqual(data);
    expect(data).toEqual({ createdAt: 123, name: 'alice' });
  });
});

describe('getRequestExampleDataDefinitionConflicts', () => {
  it('reports type mismatches with value and nextType', () => {
    const data = { age: 'thirty', active: 'yes', name: 'alice' };
    const definitions = [
      definition({ path: 'age', type: 'number' }),
      definition({ path: 'active', type: 'boolean' }),
      definition({ path: 'name', type: 'string' }),
    ];

    expect(getRequestExampleDataDefinitionConflicts(data, definitions)).toEqual([
      { path: 'age', nextType: 'number', value: 'thirty' },
      { path: 'active', nextType: 'boolean', value: 'yes' },
    ]);
  });

  it('ignores missing values, matching types and blank definitions', () => {
    const data = { age: 30 };
    const definitions = [
      definition({ path: 'age', type: 'number' }),
      definition({ path: 'missing', type: 'string' }),
      definition({ path: 'ignored', name: '  ', type: 'string' }),
    ];

    expect(getRequestExampleDataDefinitionConflicts(data, definitions)).toEqual([]);
  });
});

describe('buildRequestExampleTemplateFromDefinitions', () => {
  it('builds nested template preferring defaults over type placeholders', () => {
    const definitions = [
      definition({ path: 'name', type: 'string', defaultValue: 'default-name' }),
      definition({ path: 'age', type: 'number', defaultValue: '42' }),
      definition({ path: 'tags', type: 'array', defaultValue: '["a"]' }),
      definition({ path: 'user', type: 'object' }),
      definition({ path: 'user.profile', type: 'object' }),
    ];

    expect(buildRequestExampleTemplateFromDefinitions(definitions)).toEqual({
      name: 'default-name',
      age: 42,
      tags: ['a'],
      user: { profile: {} },
    });
  });
});

describe('updateRequestSchemaExamples', () => {
  it('embeds examples into the schema and keeps existing fields', () => {
    const result = updateRequestSchemaExamples({ type: 'object', properties: { name: { type: 'string' } } }, [
      { name: 'alice' },
    ]);
    const parsed = JSON.parse(result);

    expect(parsed).toEqual({
      type: 'object',
      properties: { name: { type: 'string' } },
      examples: [{ name: 'alice' }],
    });
  });

  it('adds x-examples-meta only when meta has content', () => {
    const withMeta = JSON.parse(
      updateRequestSchemaExamples({}, [{ name: 'alice' }], [{ name: 'First', description: 'desc' }]),
    );
    expect(withMeta['x-examples-meta']).toEqual([{ name: 'First', description: 'desc' }]);

    const withoutContent = JSON.parse(
      updateRequestSchemaExamples({}, [{ name: 'alice' }], [{ name: '', description: '' }]),
    );
    expect(withoutContent['x-examples-meta']).toBeUndefined();

    const withoutMeta = JSON.parse(updateRequestSchemaExamples({}, [{ name: 'alice' }]));
    expect(withoutMeta['x-examples-meta']).toBeUndefined();
  });
});

describe('getRequestExampleSources', () => {
  it('maps schema examples with meta into sources', () => {
    const content = {
      schema: JSON.stringify({
        'type': 'object',
        'properties': { name: { type: 'string' } },
        'examples': [{ name: 'alice' }, 42],
        'x-examples-meta': [{ name: 'First', description: 'desc' }],
      }),
    };

    expect(getRequestExampleSources(content, { dataLabel: 'Data' })).toEqual([
      {
        id: 'schema-example-0',
        name: 'First',
        description: 'desc',
        data: { name: 'alice' },
        source: 'schema.examples',
      },
      {
        id: 'schema-example-1',
        name: 'Data 2',
        description: undefined,
        data: { value: 42 },
        source: 'schema.examples',
      },
    ]);
  });

  it('falls back to legacy content.inputs when no schema examples exist', () => {
    const content = {
      inputs: [
        { key: 'name', type: 'string', value: 'alice' },
        { key: 'age', type: 'number', value: '30' },
      ],
    };

    expect(getRequestExampleSources(content, { dataLabel: 'Data' })).toEqual([
      {
        id: 'schema-example-0',
        name: 'Data 1',
        description: undefined,
        data: { name: 'alice', age: 30 },
        source: 'schema.examples',
      },
    ]);
  });

  it('returns an empty list when there are no examples or inputs', () => {
    expect(getRequestExampleSources({})).toEqual([]);
    expect(getRequestExampleSources(undefined)).toEqual([]);
  });
});

describe('formatJsonDraft and collectExampleDataPaths', () => {
  it('formats drafts and collects leaf data paths', () => {
    expect(formatJsonDraft(undefined)).toBe('');
    expect(formatJsonDraft('plain')).toBe('plain');
    expect(formatJsonDraft({ a: 1 })).toBe('{\n  "a": 1\n}');

    expect(collectExampleDataPaths({ user: { name: 'a', tags: ['x'] }, count: 1 })).toEqual([
      'user.name',
      'user.tags',
      'count',
    ]);
  });
});
