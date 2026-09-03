import { describe, expect, it } from 'vitest';

import {
  normalizeCustomNodeExpressions,
  normalizeOperatorExprValue,
  parseOperatorExprInput,
  smartSplit,
  toOperatorExprArray,
  toOperatorExprDisplay,
  toOperatorExprString,
} from '../utility';

describe('smartSplit', () => {
  it('splits on ;; separators', () => {
    expect(smartSplit('a;;b;;c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps ;; inside quotes intact', () => {
    expect(smartSplit('x;;"a;;b"')).toEqual(['x', '"a;;b"']);
  });

  it('returns a single empty entry for empty input', () => {
    expect(smartSplit('')).toEqual(['']);
  });
});

describe('operator expression conversions', () => {
  it('toOperatorExprArray passes arrays through and splits strings', () => {
    expect(toOperatorExprArray(['a'])).toEqual(['a']);
    expect(toOperatorExprArray('a;;b')).toEqual(['a', 'b']);
  });

  it('toOperatorExprString joins arrays and passes strings', () => {
    expect(toOperatorExprString(['a', 'b'])).toBe('a;;b');
    expect(toOperatorExprString('a')).toBe('a');
  });

  it('toOperatorExprDisplay JSON-stringifies arrays', () => {
    expect(toOperatorExprDisplay(['a', 'b'])).toBe('["a","b"]');
    expect(toOperatorExprDisplay('a')).toBe('a');
  });

  it('parseOperatorExprInput accepts JSON arrays', () => {
    expect(parseOperatorExprInput('["x","y"]')).toEqual(['x', 'y']);
  });

  it('parseOperatorExprInput falls back to smartSplit', () => {
    expect(parseOperatorExprInput('x;;y')).toEqual(['x', 'y']);
    expect(parseOperatorExprInput('plain')).toBe('plain');
  });

  it('parseOperatorExprInput ignores non-string arrays', () => {
    // numbers inside the JSON array are not all-strings, so the raw text wins
    expect(parseOperatorExprInput('[1,2]')).toBe('[1,2]');
  });
});

describe('normalizeOperatorExprValue', () => {
  it('splits legacy ;; strings', () => {
    expect(normalizeOperatorExprValue('a;;b')).toEqual(['a', 'b']);
  });

  it('leaves plain values untouched', () => {
    expect(normalizeOperatorExprValue('plain')).toBe('plain');
    expect(normalizeOperatorExprValue(42)).toBe(42);
  });
});

describe('normalizeCustomNodeExpressions', () => {
  it('passes non-custom nodes through untouched', () => {
    const nodes = [{ type: 'inputNode', content: { config: { expressions: [] } } }];
    const result = normalizeCustomNodeExpressions(nodes as any);
    expect(result[0]).toBe(nodes[0]);
  });

  it('migrates ;; expression values and expr_asts on custom nodes', () => {
    const nodes = [
      {
        type: 'customNode',
        content: {
          config: {
            expressions: [
              { key: 'a', value: 'x;;y' },
              { key: 'b', value: 'solo' },
            ],
            expr_asts: [{ key: 'a', value: 'x;;y' }],
          },
        },
      },
    ];
    const [node] = normalizeCustomNodeExpressions(nodes as any) as any[];
    expect(node.content.config.expressions[0].value).toEqual(['x', 'y']);
    expect(node.content.config.expressions[1].value).toBe('solo');
    expect(node.content.config.expr_asts[0].value).toEqual(['x', 'y']);
  });

  it('leaves custom nodes without array expressions untouched', () => {
    const nodes = [{ type: 'customNode', content: { config: {} } }];
    expect(normalizeCustomNodeExpressions(nodes)[0]).toBe(nodes[0]);
  });
});
