import type { CustomNodeExpression } from './custom-node-types';
import { parseOperatorArgs, quote, unquote } from './http-request-protocol';

export const CRYPTO_UDF = 'crypto';

export const CRYPTO_ALGORITHMS = ['md5', 'sha1', 'sha256', 'sha512'] as const;
export type CryptoAlgorithm = (typeof CRYPTO_ALGORITHMS)[number];

export const CRYPTO_ENCODINGS = ['hex', 'base64', 'base64url'] as const;
export type CryptoEncoding = (typeof CRYPTO_ENCODINGS)[number];

export interface CryptoFields {
  inputExpr: string;
  algorithm: CryptoAlgorithm;
  secretExpr: string;
  encoding: CryptoEncoding;
  upperExpr: string;
}

export type CryptoMode = 'plain' | 'hmac';

/** 密钥槽位非空即 HMAC(旧图兼容的隐式约定) */
export const deriveCryptoMode = (secretExpr: string): CryptoMode => (secretExpr.trim() !== '' ? 'hmac' : 'plain');

/** 显式模式归一：普通摘要强制清空密钥槽位，HMAC 保留原表达式 */
export const applyCryptoMode = (fields: CryptoFields, mode: CryptoMode): CryptoFields => ({
  ...fields,
  secretExpr: mode === 'plain' ? '' : fields.secretExpr,
});

export const normalizeAlgorithm = (value: string): CryptoAlgorithm => {
  const lowered = value.trim().toLowerCase();
  return (CRYPTO_ALGORITHMS as readonly string[]).includes(lowered) ? (lowered as CryptoAlgorithm) : 'sha256';
};

export const normalizeEncoding = (value: string): CryptoEncoding => {
  const lowered = value.trim().toLowerCase();
  return (CRYPTO_ENCODINGS as readonly string[]).includes(lowered) ? (lowered as CryptoEncoding) : 'hex';
};

/** upper 槽位仅接受布尔字面量 true(其余一律视为未勾选) */
export const isUpperChecked = (expr: string): boolean => expr.trim() === 'true';

export const parseCrypto = (expr?: CustomNodeExpression): CryptoFields => {
  const args = expr ? parseOperatorArgs(expr.value) : [];
  return {
    inputExpr: args[1] ?? '',
    algorithm: normalizeAlgorithm(unquote(args[2] ?? '')),
    secretExpr: args[3] ?? '',
    encoding: normalizeEncoding(unquote(args[4] ?? '')),
    upperExpr: args[5] ?? '',
  };
};

/**
 * 变长序列化：固定前缀 [crypto, input, "algorithm"]，可选尾参(secret/encoding/upper)
 * 末尾连续空值截断省略，中段空串占位保证槽位对齐；后端对缺省/空值回退默认。
 */
export const toCryptoValue = (fields: CryptoFields): string[] => {
  const tail = [fields.secretExpr, quote(fields.encoding), fields.upperExpr.trim() === 'true' ? 'true' : ''];
  let end = tail.length;
  while (end > 0 && tail[end - 1].trim() === '') {
    end -= 1;
  }
  return [CRYPTO_UDF, fields.inputExpr, quote(fields.algorithm), ...tail.slice(0, end)];
};
