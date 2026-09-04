import { describe, expect, test } from 'vitest';

import {
  EMPTY_AUTH,
  normalizeMethod,
  parseAuthState,
  parseHttpRequest,
  parseObjectLiteralRows,
  parseOperatorArgs,
  quote,
  serializeAuthExpr,
  serializeObjectLiteralRows,
  toHttpRequestValue,
  unquote,
} from '../http-request-protocol';

describe('quote/unquote', () => {
  test('round-trip', () => {
    expect(unquote(quote('hello world'))).toBe('hello world');
    expect(unquote(quote(''))).toBe('');
  });

  test('unquote 非双引号原样返回(trim)', () => {
    expect(unquote('  plain  ')).toBe('plain');
    expect(unquote("'single'")).toBe("'single'");
  });
});

describe('parseOperatorArgs', () => {
  test('数组输入仅 trim', () => {
    expect(parseOperatorArgs([' a ', 'b'])).toEqual(['a', 'b']);
  });

  test('旧 ;; 字符串按引号感知切分', () => {
    expect(parseOperatorArgs('a;;"x;;y";;c')).toEqual(['a', '"x;;y"', 'c']);
    expect(parseOperatorArgs("url;;'GET'")).toEqual(['url', "'GET'"]);
  });
});

describe('normalizeMethod', () => {
  test('合法方法大小写与空白归一', () => {
    expect(normalizeMethod(' get ')).toBe('GET');
    expect(normalizeMethod('"post"')).toBe('GET');
    expect(normalizeMethod('PATCH')).toBe('PATCH');
  });

  test('非法回退 GET', () => {
    expect(normalizeMethod('')).toBe('GET');
    expect(normalizeMethod('TRACE')).toBe('GET');
  });
});

const exprOf = (value: unknown[]) => ({ id: 'n1', value }) as never;

describe('parseHttpRequest / toHttpRequestValue 变长协议', () => {
  test('完整 9 位参数解析', () => {
    const fields = parseHttpRequest(
      exprOf(['http_request', 'urlExpr', '"POST"', '{ a: 1 }', '', '{ p: 1 }', '5000', '2', '{ type: "basic" }']),
    );
    expect(fields.urlExpr).toBe('urlExpr');
    expect(fields.method).toBe('POST');
    expect(fields.headersExpr).toBe('{ a: 1 }');
    expect(fields.paramsExpr).toBe('{ p: 1 }');
    expect(fields.timeoutExpr).toBe('5000');
    expect(fields.retryExpr).toBe('2');
    expect(fields.authExpr).toBe('{ type: "basic" }');
  });

  test('旧图 5 位参数兼容，可选尾部为空串', () => {
    const fields = parseHttpRequest(exprOf(['http_request', 'u', '"GET"', '', '']));
    expect(fields.method).toBe('GET');
    expect(fields.paramsExpr).toBe('');
    expect(fields.authExpr).toBe('');
  });

  test('末尾连续空值截断；中段空值占位保留', () => {
    const base = { urlExpr: 'u', method: 'GET' as const, headersExpr: '', bodyExpr: '' };
    expect(toHttpRequestValue({ ...base, paramsExpr: '', timeoutExpr: '', retryExpr: '', authExpr: '' })).toEqual([
      'http_request',
      'u',
      '"GET"',
      '',
      '',
    ]);
    expect(toHttpRequestValue({ ...base, paramsExpr: '', timeoutExpr: '5000', retryExpr: '', authExpr: '' })).toEqual([
      'http_request',
      'u',
      '"GET"',
      '',
      '',
      '',
      '5000',
    ]);
    expect(
      toHttpRequestValue({
        ...base,
        paramsExpr: '{ q: 1 }',
        timeoutExpr: '',
        retryExpr: '1',
        authExpr: '{ type: "bearer", token: t }',
      }),
    ).toEqual(['http_request', 'u', '"GET"', '', '', '{ q: 1 }', '', '1', '{ type: "bearer", token: t }']);
  });

  test('parse→serialize 往返稳定', () => {
    const original = ['http_request', 'u', '"DELETE"', '{ h: 1 }', 'body', '{ p: 2 }', '1000'];
    const fields = parseHttpRequest(exprOf(original));
    expect(toHttpRequestValue(fields)).toEqual(original);
  });
});

describe('parseObjectLiteralRows / serializeObjectLiteralRows', () => {
  test('裸键、带引号键、嵌套值拆行', () => {
    const rows = parseObjectLiteralRows('{ "Content-Type": v, "X-A": "a, b", nested: { k: 1, j: 2 } }');
    expect(rows).toEqual([
      { key: 'Content-Type', valueExpr: 'v' },
      { key: 'X-A', valueExpr: '"a, b"' },
      { key: 'nested', valueExpr: '{ k: 1, j: 2 }' },
    ]);
  });

  test('裸键含非法字符整体解析失败', () => {
    expect(parseObjectLiteralRows('{ Content-Type: v }')).toBeNull();
  });

  test('空表达式为空数组；非对象字面量为 null', () => {
    expect(parseObjectLiteralRows('')).toEqual([]);
    expect(parseObjectLiteralRows('   ')).toEqual([]);
    expect(parseObjectLiteralRows('headers.someProp')).toBeNull();
    expect(parseObjectLiteralRows('[1, 2]')).toBeNull();
  });

  test('serialize 跳过全空行；全空为空串', () => {
    expect(
      serializeObjectLiteralRows([
        { key: '', valueExpr: '' },
        { key: 'k', valueExpr: 'v' },
      ]),
    ).toBe('{ k: v }');
    expect(serializeObjectLiteralRows([])).toBe('');
  });

  test('非标识符键序列化加引号，往返一致', () => {
    const rows = [{ key: 'X-Custom Key', valueExpr: 'v' }];
    const serialized = serializeObjectLiteralRows(rows);
    expect(serialized).toBe('{ "X-Custom Key": v }');
    expect(parseObjectLiteralRows(serialized)).toEqual(rows);
  });
});

describe('parseAuthState / serializeAuthExpr', () => {
  test('空表达式为 none 默认态', () => {
    expect(parseAuthState('')).toEqual(EMPTY_AUTH);
  });

  test('basic 完整往返', () => {
    const state = { mode: 'basic' as const, username: 'user', passwordExpr: 'env.PASS', tokenExpr: '' };
    const serialized = serializeAuthExpr(state);
    expect(serialized).toContain('type: "basic"');
    expect(parseAuthState(serialized)).toEqual(state);
  });

  test('basic 无凭据最小形态可解析', () => {
    expect(parseAuthState('{ type: "basic" }')).toEqual({
      mode: 'basic',
      username: '',
      passwordExpr: '',
      tokenExpr: '',
    });
  });

  test('bearer token 表达式原样保留', () => {
    const state = { mode: 'bearer' as const, username: '', passwordExpr: '', tokenExpr: 'headers.token' };
    const serialized = serializeAuthExpr(state);
    expect(serialized).toBe('{ type: "bearer", token: headers.token }');
    expect(parseAuthState(serialized)).toEqual(state);
  });

  test('未知模式或非对象字面量为 null', () => {
    expect(parseAuthState("{ type: 'digest' }")).toBeNull();
    expect(parseAuthState('someAuthConfig')).toBeNull();
  });

  test('单引号 type 值无法解析为 null（unquote 只处理双引号）', () => {
    expect(parseAuthState("{ type: 'basic' }")).toBeNull();
  });

  test('none 序列化为空串', () => {
    expect(serializeAuthExpr(EMPTY_AUTH)).toBe('');
  });
});
