import { describe, expect, test } from 'vitest';

import fallbackSchema from '../../assets/custom-node-schema.json';
import { EMPTY_EXPRESSIONS_CONFIG, LEGACY_UDF_KIND, legacyUdfPlan, schemaToNodePlans } from '../custom-node-plans';
import { fetchCustomNodeSchema, parseCustomNodeSchemaPayload } from '../custom-node-schema-source';
import type { CustomNodeNamespace } from '../custom-node-types';

const FALLBACK_SCHEMA = fallbackSchema as CustomNodeNamespace[];

describe('parseCustomNodeSchemaPayload', () => {
  test('accepts namespace arrays', () => {
    const payload = [{ type: 'namespace' as const, name: 'contrib', title: 'Contrib', tools: [] }];
    expect(parseCustomNodeSchemaPayload(payload)).toEqual(payload);
  });

  test('rejects non-array payloads', () => {
    expect(() => parseCustomNodeSchemaPayload({})).toThrow('schema response is not an array');
    expect(() => parseCustomNodeSchemaPayload(null)).toThrow();
  });
});

describe('fetchCustomNodeSchema', () => {
  test('uses injected async loader without touching the network', async () => {
    const injected: CustomNodeNamespace[] = [{ type: 'namespace', name: 'host', title: 'Host Nodes', tools: [] }];
    const result = await fetchCustomNodeSchema(async () => injected);
    expect(result).toBe(injected);
  });

  test('uses injected sync loader result directly', async () => {
    const injected: CustomNodeNamespace[] = [{ type: 'namespace', name: 'sync-host', title: 'Sync', tools: [] }];
    expect(await fetchCustomNodeSchema(() => injected)).toEqual(injected);
  });

  test('falls back to bundled fixture when loader throws', async () => {
    const result = await fetchCustomNodeSchema(async () => {
      throw new Error('backend unavailable');
    });
    expect(result).toEqual(FALLBACK_SCHEMA);
  });

  test('falls back to bundled fixture on invalid URL payload shape', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ broken: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })) as unknown as typeof fetch;
    try {
      const result = await fetchCustomNodeSchema('/api/custom-nodes/schema');
      expect(result).toEqual(FALLBACK_SCHEMA);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('schemaToNodePlans', () => {
  const collectionNamespace: CustomNodeNamespace = {
    name: 'shared_counter',
    title: 'shared_counter',
    tools: [
      {
        name: 'counter_rate_1h',
        title: 'counter_rate_1h',
        type: 'function',
        parameters: { type: 'object', properties: { field: { type: 'string' } } },
        returns: { type: 'integer' },
        namespace: 'shared_counter',
        kind: 'shared_counter',
      },
    ],
  };

  test('generates a single container plan keyed by namespace name', () => {
    const plans = schemaToNodePlans([collectionNamespace]);
    expect(plans).toHaveLength(1);
    expect(plans[0].kind).toBe('shared_counter');
    expect(plans[0].group).toBe('自定义函数');
    expect(plans[0].seed({ index: 2 }).name).toBe('shared_counter2');
  });

  test('container plan seeds empty expressions config', () => {
    const plans = schemaToNodePlans([collectionNamespace]);
    expect(plans[0].seed({ index: 0 }).config).toEqual(EMPTY_EXPRESSIONS_CONFIG);
  });

  test('skips namespaces without tools', () => {
    expect(schemaToNodePlans([{ ...collectionNamespace, tools: [] }])).toHaveLength(0);
  });

  test('bundled fallback fixture resolves every namespace as a container', () => {
    const plans = schemaToNodePlans(FALLBACK_SCHEMA);
    const kinds = plans.map((plan) => plan.kind);
    expect(kinds).toContain('debug');
    expect(kinds).toContain('debugui');
    expect(kinds).toContain('http');
    expect(kinds).not.toContain('inout');
    expect(kinds).not.toContain('current_date');
    expect(plans.every((plan) => plan.group === '自定义函数')).toBe(true);
  });
});

describe('legacyUdfPlan', () => {
  test('registers legacy UDF kind with free-scope semantics', () => {
    const plan = legacyUdfPlan();
    expect(plan.kind).toBe(LEGACY_UDF_KIND);
    expect(plan.seed({ index: 1 }).name).toBe('UDF1');
    expect(plan.seed({ index: 1 }).config.expressions).toEqual([]);
  });
});
