import { describe, expect, it } from 'vitest';

import { validateExampleDataBySchema, validateExampleDatasBySchema } from '../ajv-validator';

describe('ajv lazy validation service (ADR-013 OQ2: ajv core + 2020-12)', () => {
  const schema = {
    type: 'object',
    properties: {
      customer: { type: 'string', enum: ['GOLD', 'SILVER'] },
      cart: {
        type: 'object',
        properties: { weight: { type: 'number', minimum: 0 } },
        required: ['weight'],
      },
    },
    required: ['customer'],
  };

  it('reports required / enum / minimum violations with instance paths', async () => {
    const issues = await validateExampleDataBySchema({ cart: { weight: -1 } }, schema);

    expect(issues.some((issue) => issue.includes("must have required property 'customer'"))).toBe(true);
    expect(issues.some((issue) => issue.includes('/cart/weight') && issue.includes('>= 0'))).toBe(true);

    const enumIssues = await validateExampleDataBySchema({ customer: 'BRONZE', cart: { weight: 1 } }, schema);
    expect(enumIssues.some((issue) => issue.includes('allowed values') || issue.includes('enum'))).toBe(true);
  });

  it('clean data yields an empty issue list', async () => {
    const issues = await validateExampleDataBySchema({ customer: 'GOLD', cart: { weight: 3 } }, schema);

    expect(issues).toEqual([]);
  });

  it('empty schema accepts anything (contract with no structure yet)', async () => {
    expect(await validateExampleDataBySchema({ any: 'thing' }, {})).toEqual([]);
  });

  it('validates format keywords via ajv-formats (definitions emit date-time for datetime fields)', async () => {
    const formatSchema = {
      type: 'object',
      properties: { when: { type: 'string', format: 'date-time' } },
      required: ['when'],
    };

    expect(await validateExampleDataBySchema({ when: '2026-10-01T00:00:00Z' }, formatSchema)).toEqual([]);
    expect(
      (await validateExampleDataBySchema({ when: 'not-a-timestamp' }, formatSchema)).some((issue) =>
        issue.includes('format'),
      ),
    ).toBe(true);
  });

  it('non-compilable schema degrades to an empty list (schema errors surface in the Schema tab)', async () => {
    const issues = await validateExampleDataBySchema(
      { a: 1 },
      { type: 'object', properties: { a: { type: 'strng' } } },
    );

    expect(issues).toEqual([]);
  });

  it('batch validation shares one compile across examples', async () => {
    const results = await validateExampleDatasBySchema(
      [{ customer: 'GOLD', cart: { weight: 1 } }, { customer: 'BRONZE' }, {}],
      schema,
    );

    expect(results[0]).toEqual([]);
    expect(results[1].length).toBeGreaterThan(0);
    expect(results[2].length).toBeGreaterThan(0);
  });
});
