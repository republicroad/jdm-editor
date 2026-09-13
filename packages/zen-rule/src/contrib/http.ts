// http 域(http_request 函数，有专属 UI 设计，文件名即 namespace)
import { defineContrib, defineTool } from '../register.ts';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 5;
const RETRY_BASE_DELAY_MS = 200;

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const httpErrorResult = (error: string) => ({ status: 0, headers: {}, body: null, error });

/** 宽松整数化：null/undefined/空串/非法值回退 fallback，并夹取 [min, max] */
const coerceCount = (value: unknown, min: number, max: number, fallback: number): number => {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
};

/** 查询参数合并：URL 解析失败返回 null（由调用方直接报错，不参与重试） */
const buildUrlWithParams = (rawUrl: string, params: Record<string, unknown>): string | null => {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  for (const [key, value] of Object.entries(params)) {
    parsed.searchParams.set(key, String(value));
  }
  return parsed.toString();
};

/** 认证注入：headers 显式 Authorization 优先；basic 编码 user:password，bearer 直填 token */
const applyAuthHeader = (requestHeaders: Record<string, string>, auth: Record<string, unknown>): void => {
  const hasAuthorization = Object.keys(requestHeaders).some((k) => k.toLowerCase() === 'authorization');
  if (hasAuthorization) {
    return;
  }
  const type = String(auth.type ?? '')
    .trim()
    .toLowerCase();
  if (type === 'basic') {
    const raw = `${String(auth.username ?? '')}:${String(auth.password ?? '')}`;
    const encoded = Buffer.from(raw, 'utf8').toString('base64');
    requestHeaders['authorization'] = `Basic ${encoded}`;
  } else if (type === 'bearer') {
    const token = String(auth.token ?? '');
    if (token) {
      requestHeaders['authorization'] = `Bearer ${token}`;
    }
  }
};

interface HttpAttemptResult {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  error?: undefined | string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 网络异常/超时(status=0)、429 与 5xx 可重试；其余 4xx 属业务错误不重试 */
const shouldRetryResult = (result: HttpAttemptResult): boolean =>
  result.status === 0 || result.status === 429 || result.status >= 500;

export const http_request = defineTool({
  name: 'http_request',
  description:
    '发起 HTTP 请求, 返回响应结果 { status, headers, body }. 支持 params 查询参数合并、timeout 单次超时(默认 10s, 上限 60s)、' +
    'retry 重试(仅网络异常/超时/5xx/429, 指数退避)与 auth 认证({ type: "basic", username, password } 或 { type: "bearer", token }, ' +
    'headers 显式 Authorization 优先). 失败返回结构化错误 { status: 0, error }, 不抛出异常.',
  parametersSchema: {
    properties: {
      url: {
        type: 'string',
        title: 'URL',
        description: '请求地址',
      },
      method: {
        type: 'string',
        title: 'Method',
        description: 'HTTP 方法(GET/POST/PUT/PATCH/DELETE/HEAD/OPTIONS)，默认 GET',
        default: 'GET',
      },
      headers: {
        type: 'object',
        title: 'Headers',
        description: '请求头键值对对象，默认无',
        default: null,
      },
      body: {
        type: 'object',
        title: 'Body',
        description:
          '请求体对象(自动 JSON 序列化并补充 content-type: application/json)，GET/HEAD 忽略，空对象视为无请求体',
        default: null,
      },
      params: {
        type: 'object',
        title: 'Params',
        description: '查询参数键值对对象，合并到 URL 查询串(URL 已有同名参数时覆盖)，默认无',
        default: null,
      },
      timeout: {
        type: 'integer',
        title: 'Timeout',
        description: `单次请求超时毫秒数(${MIN_TIMEOUT_MS}–${MAX_TIMEOUT_MS})，默认 ${DEFAULT_TIMEOUT_MS}`,
        default: DEFAULT_TIMEOUT_MS,
      },
      retry: {
        type: 'integer',
        title: 'Retry',
        description: `失败重试次数(0–${MAX_RETRIES})，仅网络异常/超时/5xx/429 触发，指数退避，默认 0`,
        default: 0,
      },
      auth: {
        type: 'object',
        title: 'Auth',
        description:
          "认证配置。Basic: { type: 'basic', username, password }；Bearer: { type: 'bearer', token }。headers 显式 Authorization 优先，默认无",
        default: null,
      },
    },
    required: ['url'],
    title: 'http_request',
    type: 'object',
  },
  returnsSchema: { type: 'object', title: 'http_request 函数返回', properties: {} },
  fn: async function httpRequestUdf(kwargs: Record<string, unknown>) {
    const rawUrl = String(kwargs?.url ?? '').trim();
    const method =
      String(kwargs?.method ?? 'GET')
        .trim()
        .toUpperCase() || 'GET';
    const rawBody = asRecord(kwargs?.body);
    const rawParams = asRecord(kwargs?.params);
    const rawAuth = asRecord(kwargs?.auth);
    const retryCount = coerceCount(kwargs?.retry, 0, MAX_RETRIES, 0);

    if (!rawUrl) {
      return httpErrorResult('url is required');
    }
    if (!HTTP_METHODS.has(method)) {
      return httpErrorResult(`unsupported http method '${method}'`);
    }

    const url = buildUrlWithParams(rawUrl, rawParams);
    if (!url) {
      return httpErrorResult(`invalid url '${rawUrl}'`);
    }

    const requestHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(asRecord(kwargs?.headers))) {
      requestHeaders[String(key)] = String(value);
    }
    applyAuthHeader(requestHeaders, rawAuth);

    let requestBody: string | undefined;
    if (method !== 'GET' && method !== 'HEAD' && Object.keys(rawBody).length > 0) {
      requestBody = JSON.stringify(rawBody);
      const hasContentType = Object.keys(requestHeaders).some((k) => k.toLowerCase() === 'content-type');
      if (!hasContentType) {
        requestHeaders['content-type'] = 'application/json';
      }
    }

    const attemptOnce = async (): Promise<HttpAttemptResult> => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          method,
          headers: requestHeaders,
          body: requestBody,
          signal: controller.signal,
        });
        const responseText = await response.text();
        let responseBody: unknown;
        try {
          responseBody = JSON.parse(responseText);
        } catch {
          responseBody = responseText;
        }
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody,
        };
      } catch (e) {
        return { status: 0, headers: {}, body: null, error: e instanceof Error ? e.message : String(e) };
      } finally {
        clearTimeout(timer);
      }
    };

    const timeoutMs = coerceCount(kwargs?.timeout, MIN_TIMEOUT_MS, MAX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
    let result = await attemptOnce();
    for (let attempt = 1; attempt <= retryCount && shouldRetryResult(result); attempt += 1) {
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      result = await attemptOnce();
    }
    return result;
  },
});

export const { fn: httpRequest } = http_request;

export default defineContrib(import.meta.url, {
  tools: [http_request],
});
