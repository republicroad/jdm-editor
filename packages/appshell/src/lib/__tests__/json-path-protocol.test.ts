import { describe, expect, test } from 'vitest';

import { normalizeJsonPath, parseJsonPath, toJsonPathValue } from '../json-path-protocol';

const exprOf = (value: unknown[]) => ({ id: 'n1', value }) as never;

describe('normalizeJsonPath', () => {
  test('缺 $ 前缀自动补全；空白归一', () => {
    expect(normalizeJsonPath('store.book[0]')).toBe('$.store.book[0]');
    expect(normalizeJsonPath('  $.a.b  ')).toBe('$.a.b');
    expect(normalizeJsonPath('')).toBe('');
  });
});

describe('parseJsonPath / toJsonPathValue 变长协议', () => {
  test('完整解析与默认值槽位', () => {
    const fields = parseJsonPath(exprOf(['json_path', 'input.payload', '"$.a.b"', '{ fallback: 1 }']));
    expect(fields.inputExpr).toBe('input.payload');
    expect(fields.pathExpr).toBe('$.a.b');
    expect(fields.defaultExpr).toBe('{ fallback: 1 }');
  });

  test('末尾 default 截断；路径恒为引号字面量', () => {
    expect(toJsonPathValue({ inputExpr: 'x', pathExpr: '$.a', defaultExpr: '' })).toEqual(['json_path', 'x', '"$.a"']);
    expect(toJsonPathValue({ inputExpr: 'x', pathExpr: '$.a', defaultExpr: '"n/a"' })).toEqual([
      'json_path',
      'x',
      '"$.a"',
      '"n/a"',
    ]);
  });

  test('裸路径序列化时自动补前缀，往返稳定', () => {
    const original = ['json_path', 'x', '"$.a.b"'];
    const fields = parseJsonPath(exprOf(original));
    expect(toJsonPathValue(fields)).toEqual(original);
    const bare = toJsonPathValue({ inputExpr: 'x', pathExpr: 'a.b', defaultExpr: '' });
    expect(bare).toEqual(original);
  });

  test('空表达式安全解析', () => {
    expect(toJsonPathValue(parseJsonPath(undefined))).toEqual(['json_path', '', '""']);
  });
});
