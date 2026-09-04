import type { CustomNodeExpression } from './custom-node-types';
import { parseOperatorArgs, quote, unquote } from './http-request-protocol';

export const JSON_PATH_UDF = 'json_path';

export interface JsonPathFields {
  inputExpr: string;
  pathExpr: string;
  defaultExpr: string;
}

export const normalizeJsonPath = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('$') ? trimmed : `$.${trimmed}`;
};

export const parseJsonPath = (expr?: CustomNodeExpression): JsonPathFields => {
  const args = expr ? parseOperatorArgs(expr.value) : [];
  return {
    inputExpr: args[1] ?? '',
    pathExpr: unquote(args[2] ?? ''),
    defaultExpr: args[3] ?? '',
  };
};

/** 变长尾参:default 末尾空值截断;路径槽位恒以字符串字面量序列化 */
export const toJsonPathValue = (fields: JsonPathFields): string[] => {
  const path = quote(normalizeJsonPath(fields.pathExpr));
  const tail = [fields.defaultExpr];
  let end = tail.length;
  while (end > 0 && tail[end - 1].trim() === '') {
    end -= 1;
  }
  return [JSON_PATH_UDF, fields.inputExpr, path, ...tail.slice(0, end)];
};
