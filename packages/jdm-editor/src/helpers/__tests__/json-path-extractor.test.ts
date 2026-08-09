import { describe, expect, it } from 'bun:test';

import { extractJsonFields } from '../json-path-extractor';

describe('extractJsonFields', () => {
  it('extracts top-level fields with positions', () => {
    const fields = extractJsonFields('{ "name": "alice" }');

    expect(fields).toEqual([
      {
        path: 'name',
        name: 'name',
        line: 1,
        column: 3,
        lineEnd: 1,
        lineEndColumn: 20,
      },
    ]);
  });

  it('extracts nested object paths with correct line/column', () => {
    const fields = extractJsonFields('{\n  "user": {\n    "name": "alice"\n  },\n  "active": true\n}');

    expect(fields.map(({ path, name, line, column }) => ({ path, name, line, column }))).toEqual([
      { path: 'user', name: 'user', line: 2, column: 3 },
      { path: 'user.name', name: 'name', line: 3, column: 5 },
      { path: 'active', name: 'active', line: 5, column: 3 },
    ]);
  });

  it('extracts array elements with indexed paths', () => {
    const fields = extractJsonFields('{ "items": [{ "x": 1 }] }');

    expect(fields.map(({ path, name }) => ({ path, name }))).toEqual([
      { path: 'items', name: 'items' },
      { path: 'items.0.x', name: 'x' },
    ]);
  });

  it('gracefully degrades for incomplete JSON', () => {
    expect(extractJsonFields('{ "name": ').map(({ path }) => path)).toEqual(['name']);
    expect(extractJsonFields('')).toEqual([]);
  });
});
