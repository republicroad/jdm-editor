import type { CustomNodeExpression } from './custom-node-types';

export const UDF_FUNC = 'http_request';

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export interface HttpRequestFields {
  urlExpr: string;
  method: HttpMethod;
  headersExpr: string;
  bodyExpr: string;
  paramsExpr: string;
  timeoutExpr: string;
  retryExpr: string;
  authExpr: string;
}

export interface KeyValueRow {
  key: string;
  valueExpr: string;
}

export type AuthMode = 'none' | 'basic' | 'bearer';

export interface AuthState {
  mode: AuthMode;
  username: string;
  passwordExpr: string;
  tokenExpr: string;
}

export const EMPTY_AUTH: AuthState = { mode: 'none', username: '', passwordExpr: '', tokenExpr: '' };

export const unquote = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  return trimmed;
};

export const quote = (value: string): string => JSON.stringify(value);

/** 表达式实参拆分：数组原样(仅 trim)；旧 `;;` 字符串按引号感知切分 */
export const parseOperatorArgs = (expr: string | string[]): string[] => {
  if (Array.isArray(expr)) {
    return expr.map((s) => s.trim());
  }
  const pattern = /;;(?=(?:[^"'`]*["'`][^"'`]*["'`])*[^"'`]*$)/;
  return expr.split(pattern).map((s) => s.trim());
};

export const normalizeMethod = (value: string): HttpMethod => {
  const upper = value.trim().toUpperCase();
  return (HTTP_METHODS as readonly string[]).includes(upper) ? (upper as HttpMethod) : 'GET';
};

export const isIdentKey = (key: string): boolean => /^[A-Za-z_$][\w$]*$/.test(key);

export const serializeHeaderKey = (key: string): string => (isIdentKey(key) ? key : JSON.stringify(key));

export const splitTopLevel = (text: string, separator: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let quoteChar: string | null = null;
  let escaped = false;
  let current = '';
  for (const ch of text) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (quoteChar) {
      current += ch;
      if (ch === '\\') {
        escaped = true;
      } else if (ch === quoteChar) {
        quoteChar = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quoteChar = ch;
      current += ch;
      continue;
    }
    if ('{[('.includes(ch)) {
      depth += 1;
      current += ch;
      continue;
    }
    if ('}])'.includes(ch)) {
      depth -= 1;
      current += ch;
      continue;
    }
    if (ch === separator && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  parts.push(current);
  return parts;
};

export const findTopLevelColon = (text: string): number => {
  let depth = 0;
  let quoteChar: string | null = null;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const ch = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quoteChar) {
      if (ch === '\\') {
        escaped = true;
      } else if (ch === quoteChar) {
        quoteChar = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quoteChar = ch;
      continue;
    }
    if ('{[('.includes(ch)) {
      depth += 1;
    } else if ('}])'.includes(ch)) {
      depth -= 1;
    } else if (ch === ':' && depth === 0) {
      return index;
    }
  }
  return -1;
};

const unquoteHeaderKey = (raw: string): string | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    try {
      return JSON.parse(trimmed) as string;
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (isIdentKey(trimmed)) {
    return trimmed;
  }
  return null;
};

/** `{ k: expr, ... }` 对象字面量 ⇄ 行数组；无法拆行时返回 null(交由原始表达式模式) */
export const parseObjectLiteralRows = (expr: string): KeyValueRow[] | null => {
  const trimmed = expr.trim();
  if (!trimmed) {
    return [];
  }
  if (!(trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    return null;
  }
  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }
  const rows: KeyValueRow[] = [];
  for (const part of splitTopLevel(inner, ',')) {
    const piece = part.trim();
    if (!piece) {
      continue;
    }
    const colonIndex = findTopLevelColon(piece);
    if (colonIndex < 0) {
      return null;
    }
    const key = unquoteHeaderKey(piece.slice(0, colonIndex));
    const valueExpr = piece.slice(colonIndex + 1).trim();
    if (key === null) {
      return null;
    }
    rows.push({ key, valueExpr });
  }
  return rows;
};

export const serializeObjectLiteralRows = (rows: KeyValueRow[]): string => {
  const kept = rows.filter((row) => row.key.trim() !== '' || row.valueExpr.trim() !== '');
  if (kept.length === 0) {
    return '';
  }
  const body = kept.map((row) => `${serializeHeaderKey(row.key)}: ${row.valueExpr}`).join(', ');
  return `{ ${body} }`;
};

export const parseHttpRequest = (expr?: CustomNodeExpression): HttpRequestFields => {
  const args = expr ? parseOperatorArgs(expr.value) : [];
  return {
    urlExpr: args[1] ?? '',
    method: normalizeMethod(unquote(args[2] ?? '')),
    headersExpr: args[3] ?? '',
    bodyExpr: args[4] ?? '',
    paramsExpr: args[5] ?? '',
    timeoutExpr: args[6] ?? '',
    retryExpr: args[7] ?? '',
    authExpr: args[8] ?? '',
  };
};

/**
 * 变长序列化：可选尾部参数(params/timeout/retry/auth)按位置占位，末尾连续空值截断省略；
 * 中段空值保留空串占位以保证后续参数位置正确，后端对空串回退默认值。
 */
export const toHttpRequestValue = (fields: HttpRequestFields): string[] => {
  const tail = [fields.paramsExpr, fields.timeoutExpr, fields.retryExpr, fields.authExpr];
  let end = tail.length;
  while (end > 0 && tail[end - 1].trim() === '') {
    end -= 1;
  }
  return [UDF_FUNC, fields.urlExpr, quote(fields.method), fields.headersExpr, fields.bodyExpr, ...tail.slice(0, end)];
};

/** 解析 auth 表达式为结构化状态；非对象字面量或无法识别的 type 返回 null(交由界面提示保留原文) */
export const parseAuthState = (expr: string): AuthState | null => {
  const trimmed = expr.trim();
  if (!trimmed) {
    return EMPTY_AUTH;
  }
  const rows = parseObjectLiteralRows(trimmed);
  if (!rows) {
    return null;
  }
  const findRow = (key: string): string => rows.find((row) => row.key === key)?.valueExpr.trim() ?? '';
  const mode = unquote(findRow('type')) as AuthMode;
  if (mode !== 'basic' && mode !== 'bearer') {
    return null;
  }
  return {
    mode,
    username: unquote(findRow('username')),
    passwordExpr: findRow('password'),
    tokenExpr: findRow('token'),
  };
};

export const serializeAuthExpr = (state: AuthState): string => {
  if (state.mode === 'none') {
    return '';
  }
  if (state.mode === 'basic') {
    const parts = ['type: "basic"'];
    if (state.username || state.passwordExpr) {
      parts.push(`username: ${quote(state.username)}`);
    }
    if (state.passwordExpr) {
      parts.push(`password: ${state.passwordExpr}`);
    }
    return `{ ${parts.join(', ')} }`;
  }
  const parts = ['type: "bearer"'];
  if (state.tokenExpr) {
    parts.push(`token: ${state.tokenExpr}`);
  }
  return `{ ${parts.join(', ')} }`;
};
