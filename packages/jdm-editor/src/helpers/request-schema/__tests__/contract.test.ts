import { describe, expect, it } from 'vitest';

import {
  INPUT_CONTRACT_SUPPORTED_VERSION,
  INPUT_CONTRACT_VERSION,
  applySchemaTextToInputContract,
  computeExampleDrift,
  contractExamplesToSources,
  exportInputContractEnvelope,
  hasExampleDrift,
  migrateRequestExampleDataByDefinitions,
  parseInputContractEnvelope,
  readRequestInputContract,
  requestSchemaFingerprint,
  writeRequestInputContract,
} from '../contract';
import { getRequestDefinitions } from '../definitions';
import { getRequestExampleSources } from '../examples';
import { parseRequestSchemaValue } from '../schema-value';
import type { InputContract, RequestDefinition } from '../types';

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

const legacySchemaUI = JSON.stringify({
  'type': 'object',
  'properties': {
    customer: { type: 'string', description: 'Customer tier', default: 'GOLD' },
  },
  'examples': [{ customer: 'GOLD' }, { customer: 'SILVER', bonus: 1 }],
  'x-examples-meta': [
    { name: '正常GOLD用户', description: 'gold tier' },
    { name: '带多余字段', description: '' },
  ],
});

describe('input contract bridge', () => {
  it('projects legacy schema-embedded examples into the contract (read fallback)', () => {
    const content = { schemaUI: legacySchemaUI };
    const { contract, origin } = readRequestInputContract(content);

    expect(origin).toBe('legacy');
    expect(contract.contractVersion).toBe(INPUT_CONTRACT_VERSION);
    expect(contract.schema).toEqual({
      type: 'object',
      properties: { customer: { type: 'string', description: 'Customer tier', default: 'GOLD' } },
    });
    expect(Object.keys(contract.schema)).not.toContain('examples');
    expect(contract.examples).toHaveLength(2);
    expect(contract.examples[0]).toMatchObject({
      id: 'schema-example-0',
      name: '正常GOLD用户',
      description: 'gold tier',
      data: { customer: 'GOLD' },
    });
    expect(contract.examples[1].name).toBe('带多余字段');
    expect(contract.examples[1].description).toBeUndefined();
    expect(contract.examples[1].data).toEqual({ customer: 'SILVER', bonus: 1 });
  });

  it('dual-writes contract + legacy mirror so old readers keep working', () => {
    const content: Record<string, any> = {};
    const contract: InputContract = {
      contractVersion: INPUT_CONTRACT_VERSION,
      schema: { type: 'object', properties: { customer: { type: 'string' } } },
      examples: [
        {
          id: 'ex-1',
          name: 'GOLD',
          description: 'gold tier',
          data: { customer: 'GOLD' },
          schemaFingerprint: requestSchemaFingerprint({ type: 'object' }),
        },
        { id: 'ex-2', name: 'Bare', data: {} },
      ],
    };

    writeRequestInputContract(content, contract);

    // 规范形态入 content.inputContract；未锚定的指纹不物化
    expect(content.inputContract).toEqual({
      contractVersion: INPUT_CONTRACT_VERSION,
      schema: contract.schema,
      examples: [
        {
          id: 'ex-1',
          name: 'GOLD',
          description: 'gold tier',
          data: { customer: 'GOLD' },
          schemaFingerprint: expect.any(String),
        },
        { id: 'ex-2', name: 'Bare', data: {} },
      ],
    });

    // legacy 镜像：schema 字段（新内容走 schema；legacy 图保持 schemaUI——
    // setRequestSchemaValue 的既有字段选择）重新内嵌 examples + x-examples-meta
    const mirror = parseRequestSchemaValue(content.schema ?? content.schemaUI);
    expect(mirror?.examples).toEqual([{ customer: 'GOLD' }, {}]);
    expect(mirror?.['x-examples-meta']).toEqual([
      { name: 'GOLD', description: 'gold tier' },
      { name: 'Bare', description: undefined },
    ]);

    // 旧版本读取路径（getRequestExampleSources）看到同一组示例
    const legacyRead = getRequestExampleSources(content);
    expect(legacyRead.map((source) => source.name)).toEqual(['GOLD', 'Bare']);
    expect(legacyRead.map((source) => source.data)).toEqual([{ customer: 'GOLD' }, {}]);

    // 往返一致
    const roundTrip = readRequestInputContract(content);
    expect(roundTrip.origin).toBe('contract');
    expect(roundTrip.contract.examples.map((example) => example.id)).toEqual(['ex-1', 'ex-2']);
    expect(roundTrip.contract.examples[0].schemaFingerprint).toBe(contract.examples[0].schemaFingerprint);
    expect(roundTrip.contract.schema).toEqual(contract.schema);
  });

  it('routes structure edits through applySchemaText while preserving contract examples', () => {
    const content: Record<string, any> = {};
    const contract: InputContract = {
      contractVersion: INPUT_CONTRACT_VERSION,
      schema: { type: 'object', properties: { customer: { type: 'string' } } },
      examples: [{ id: 'ex-1', name: 'GOLD', data: { customer: 'GOLD' } }],
    };
    writeRequestInputContract(content, contract);

    const current = readRequestInputContract(content).contract;
    const next = applySchemaTextToInputContract(
      current,
      JSON.stringify({ type: 'object', properties: { customer: { type: 'string' }, age: { type: 'number' } } }),
    );

    expect(Object.keys(next.schema.properties ?? {})).toEqual(['customer', 'age']);
    expect(next.examples).toEqual(current.examples);

    // 粘贴 legacy 形态 schema（带内嵌 examples）→ 按序并入契约示例集，保留既有 id
    const pasted = applySchemaTextToInputContract(
      next,
      JSON.stringify({
        'type': 'object',
        'properties': next.schema.properties,
        'examples': [{ customer: 'SILVER' }],
        'x-examples-meta': [{ name: 'SILVER' }],
      }),
    );

    expect(pasted.examples).toHaveLength(1);
    expect(pasted.examples[0]).toMatchObject({ id: 'ex-1', name: 'SILVER', data: { customer: 'SILVER' } });
    expect(pasted.examples[0].schemaFingerprint).toBeUndefined();
  });

  it('fingerprints are canonical (key order independent) and sensitive to content', () => {
    const left = requestSchemaFingerprint({ type: 'object', properties: { a: { type: 'string' } } });
    const right = requestSchemaFingerprint({ properties: { a: { type: 'string' } }, type: 'object' });

    expect(left).toBe(right);
    expect(left).not.toBe(requestSchemaFingerprint({ type: 'object', properties: { a: { type: 'number' } } }));
  });

  it('contractExamplesToSources keeps a 1:1 mapping for the editor views', () => {
    const contract: InputContract = {
      contractVersion: 1,
      schema: {},
      examples: [{ id: 'ex-1', name: '', data: { a: 1 } }],
    };

    const sources = contractExamplesToSources(contract, { dataLabel: 'Example data' });
    expect(sources).toEqual([
      { id: 'ex-1', name: 'Example data 1', description: undefined, data: { a: 1 }, source: 'schema.examples' },
    ]);
  });
});

describe('example drift (ADR-013 §2 three-category report)', () => {
  const definitions = [
    definition({ id: '1', path: 'customer', name: 'customer', type: 'string' }),
    definition({ id: '2', path: 'cart.weight', name: 'weight', type: 'number', parentPath: 'cart', depth: 1 }),
  ];

  it('reports missing / extra / type-mismatch per example', () => {
    const drift = computeExampleDrift({ cart: { weight: 'heavy' }, legacy: true }, definitions);

    expect(drift.missing.map((definition) => definition.path)).toEqual(['customer']);
    expect(drift.extra).toEqual(['legacy']);
    expect(drift.conflicts).toEqual([{ path: 'cart.weight', nextType: 'number', value: 'heavy' }]);
    expect(hasExampleDrift(drift)).toBe(true);
  });

  it('clean example has no drift', () => {
    const drift = computeExampleDrift({ customer: 'GOLD', cart: { weight: 3 } }, definitions);

    expect(drift.missing).toHaveLength(0);
    expect(drift.extra).toHaveLength(0);
    expect(drift.conflicts).toHaveLength(0);
    expect(hasExampleDrift(drift)).toBe(false);
  });

  it('nested extra paths under an object definition are not flagged', () => {
    const drift = computeExampleDrift({ customer: 'GOLD', cart: { weight: 3, note: 'fragile' } }, [
      definition({ id: '1', path: 'customer', name: 'customer', type: 'string' }),
      definition({ id: '2', path: 'cart', name: 'cart', type: 'object' }),
    ]);

    expect(drift.extra).toHaveLength(0);
  });
});

describe('safe migration (ADR-013 §2)', () => {
  const definitions = [
    definition({ id: '1', path: 'customer', name: 'customer', type: 'string', defaultValue: 'GOLD' }),
    definition({ id: '2', path: 'cart.weight', name: 'weight', type: 'number', parentPath: 'cart', depth: 1 }),
    definition({ id: '3', path: 'when', name: 'when', type: 'datetime' }),
  ];

  it('fills missing from defaults, strips extras, keeps type conflicts untouched', () => {
    const { data, conflicts } = migrateRequestExampleDataByDefinitions(
      { cart: { weight: 'heavy' }, legacy: true },
      definitions,
    );

    expect(data.customer).toBe('GOLD');
    expect(data.cart).toEqual({ weight: 'heavy' });
    expect(data.legacy).toBeUndefined();
    expect(data.when).toEqual(expect.any(String));
    expect(conflicts).toEqual([{ path: 'cart.weight', nextType: 'number', value: 'heavy' }]);
  });

  it('migrated data recomputes to a conflict-free report once types are fixed by the user', () => {
    const firstPass = migrateRequestExampleDataByDefinitions({ cart: { weight: 'heavy' } }, definitions);
    const fixed = { ...firstPass.data, cart: { weight: 12 } };
    const secondPass = migrateRequestExampleDataByDefinitions(fixed, definitions);

    expect(secondPass.conflicts).toHaveLength(0);
    expect(hasExampleDrift(computeExampleDrift(secondPass.data, definitions))).toBe(false);
  });

  it('leaves data untouched when there are no definitions', () => {
    const { data, conflicts } = migrateRequestExampleDataByDefinitions({ any: 'thing' }, []);

    expect(data).toEqual({ any: 'thing' });
    expect(conflicts).toHaveLength(0);
  });
});

describe('contract ↔ definitions coherence', () => {
  it('definitions derive from the contract schema after a contract write', () => {
    const content: Record<string, any> = {};
    writeRequestInputContract(content, {
      contractVersion: INPUT_CONTRACT_VERSION,
      schema: { type: 'object', properties: { customer: { type: 'string' } } },
      examples: [{ id: 'ex-1', name: 'GOLD', data: { customer: 'GOLD' } }],
    });

    expect(getRequestDefinitions(content).map((definition) => definition.path)).toEqual(['customer']);
  });
});

describe('share envelope (ADR-013 清单 #7)', () => {
  const contract: InputContract = {
    contractVersion: INPUT_CONTRACT_VERSION,
    schema: { type: 'object', properties: { customer: { type: 'string' } } },
    examples: [
      { id: 'ex-1', name: 'GOLD', description: 'gold tier', data: { customer: 'GOLD' }, schemaFingerprint: 'ab' },
      { id: 'ex-2', name: '', data: {} },
    ],
  };

  it('exports a self-contained envelope without fingerprint anchors', () => {
    const envelope = exportInputContractEnvelope(contract);

    expect(envelope).toEqual({
      contractVersion: INPUT_CONTRACT_VERSION,
      schema: contract.schema,
      examples: [
        { id: 'ex-1', name: 'GOLD', description: 'gold tier', data: { customer: 'GOLD' } },
        { id: 'ex-2', name: '', data: {} },
      ],
    });
    expect(JSON.stringify(envelope)).not.toContain('schemaFingerprint');
  });

  it('round-trips export → parse back into an equivalent contract', () => {
    const parsed = parseInputContractEnvelope(JSON.stringify(exportInputContractEnvelope(contract)));

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.contract.contractVersion).toBe(INPUT_CONTRACT_VERSION);
    expect(parsed.contract.schema).toEqual(contract.schema);
    expect(parsed.contract.examples).toEqual([
      { id: 'ex-1', name: 'GOLD', description: 'gold tier', data: { customer: 'GOLD' } },
      { id: 'ex-2', name: 'Data 2', data: {} },
    ]);
  });

  it('rejects invalid json / malformed shape / newer versions deterministically', () => {
    expect(parseInputContractEnvelope('{not json')).toEqual({ ok: false, error: 'invalid-json' });
    expect(parseInputContractEnvelope('{"schema": "not-a-record"}')).toEqual({ ok: false, error: 'invalid-shape' });
    expect(parseInputContractEnvelope('{"contractVersion": 99, "schema": {}, "examples": []}')).toEqual({
      ok: false,
      error: 'unsupported-version',
    });
    expect(INPUT_CONTRACT_SUPPORTED_VERSION).toBe(1);
  });

  it('blanks missing/duplicate ids for the caller to mint (deterministic parse)', () => {
    const parsed = parseInputContractEnvelope(
      JSON.stringify({
        contractVersion: 1,
        schema: {},
        examples: [
          { name: 'A', data: {} },
          { id: 'dup', data: {} },
          { id: 'dup', data: {} },
        ],
      }),
    );

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      return;
    }

    expect(parsed.contract.examples.map((example) => example.id)).toEqual(['', 'dup', '']);
  });
});
