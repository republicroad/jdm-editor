import { describe, expect, test } from 'bun:test';

import {
  applyCryptoMode,
  deriveCryptoMode,
  isUpperChecked,
  normalizeAlgorithm,
  normalizeEncoding,
  parseCrypto,
  toCryptoValue,
} from '../crypto-protocol';

const exprOf = (value: unknown[]) => ({ id: 'n1', value }) as never;

describe('normalizeAlgorithm / normalizeEncoding', () => {
  test('合法值大小写归一', () => {
    expect(normalizeAlgorithm(' MD5 ')).toBe('md5');
    expect(normalizeEncoding('Base64URL')).toBe('base64url');
  });

  test('非法值回退默认', () => {
    expect(normalizeAlgorithm('')).toBe('sha256');
    expect(normalizeAlgorithm('sm3')).toBe('sha256');
    expect(normalizeEncoding('rot13')).toBe('hex');
  });
});

describe('parseCrypto / toCryptoValue 变长协议', () => {
  test('完整 6 槽解析', () => {
    const fields = parseCrypto(exprOf(['crypto', 'input.phone', '"md5"', '"secret"', '"base64"', 'true']));
    expect(fields.inputExpr).toBe('input.phone');
    expect(fields.algorithm).toBe('md5');
    expect(fields.secretExpr).toBe('"secret"');
    expect(fields.encoding).toBe('base64');
    expect(isUpperChecked(fields.upperExpr)).toBe(true);
  });

  test('最小图(仅 input+algorithm)兼容，可选尾参为空', () => {
    const fields = parseCrypto(exprOf(['crypto', 'input.id', '"sha256"']));
    expect(fields.secretExpr).toBe('');
    expect(fields.encoding).toBe('hex');
    expect(isUpperChecked(fields.upperExpr)).toBe(false);
  });

  test('非法算法/编码槽位回退默认', () => {
    const fields = parseCrypto(exprOf(['crypto', 'x', '"sm3"', '', '"rot13"']));
    expect(fields.algorithm).toBe('sha256');
    expect(fields.encoding).toBe('hex');
  });

  test('末尾连续空值截断；中段空串占位保留', () => {
    const base = { inputExpr: 'x', algorithm: 'sha256' as const, secretExpr: '', encoding: 'hex' as const };
    expect(toCryptoValue({ ...base, upperExpr: '' })).toEqual(['crypto', 'x', '"sha256"', '', '"hex"']);
    expect(toCryptoValue({ ...base, secretExpr: '', encoding: 'base64url', upperExpr: '' })).toEqual([
      'crypto',
      'x',
      '"sha256"',
      '',
      '"base64url"',
    ]);
    expect(toCryptoValue({ ...base, secretExpr: 'env.KEY', encoding: 'hex', upperExpr: '' })).toEqual([
      'crypto',
      'x',
      '"sha256"',
      'env.KEY',
      '"hex"',
    ]);
    expect(toCryptoValue({ ...base, secretExpr: '', encoding: 'hex', upperExpr: 'true' })).toEqual([
      'crypto',
      'x',
      '"sha256"',
      '',
      '"hex"',
      'true',
    ]);
  });

  test('upper 非法字面量不序列化、解析为未勾选', () => {
    const fields = parseCrypto(exprOf(['crypto', 'x', '"sha256"', '', '"hex"', '"true"']));
    expect(isUpperChecked(fields.upperExpr)).toBe(false);
  });

  test('parse→serialize 往返稳定', () => {
    const original = ['crypto', 'input.raw', '"sha1"', '"k"', '"base64"', 'true'];
    expect(toCryptoValue(parseCrypto(exprOf(original)))).toEqual(original);
  });

  test('空表达式安全解析', () => {
    expect(toCryptoValue(parseCrypto(undefined))).toEqual(['crypto', '', '"sha256"', '', '"hex"']);
  });
});

describe('deriveCryptoMode / applyCryptoMode', () => {
  test('密钥非空推导 HMAC，空推导普通摘要', () => {
    expect(deriveCryptoMode('env.KEY')).toBe('hmac');
    expect(deriveCryptoMode('  ')).toBe('plain');
    expect(deriveCryptoMode('')).toBe('plain');
  });

  test('切回普通摘要强制清空密钥槽位', () => {
    const hmacFields = {
      inputExpr: 'x',
      algorithm: 'sha256' as const,
      secretExpr: 'env.KEY',
      encoding: 'hex' as const,
      upperExpr: '',
    };
    expect(applyCryptoMode(hmacFields, 'plain').secretExpr).toBe('');
    expect(applyCryptoMode(hmacFields, 'hmac').secretExpr).toBe('env.KEY');
  });

  test('模式归一后序列化与旧图兼容', () => {
    const fields = parseCrypto(exprOf(['crypto', 'x', '"md5"', '"k"', '"hex"']));
    expect(deriveCryptoMode(fields.secretExpr)).toBe('hmac');
    const cleared = applyCryptoMode(fields, 'plain');
    expect(toCryptoValue(cleared)).toEqual(['crypto', 'x', '"md5"', '', '"hex"']);
  });
});
