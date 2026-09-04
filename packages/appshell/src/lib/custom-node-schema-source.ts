import fallbackSchema from '../assets/custom-node-schema.json';
import type { CustomNodeNamespace } from './custom-node-types';

// 自定义节点 schema 来源：同源/自定义 URL 字符串，或宿主注入的加载函数(库复用时不假设后端存在)
export type CustomNodeSchemaSource = string | (() => Promise<CustomNodeNamespace[]> | CustomNodeNamespace[]);

export const DEFAULT_SCHEMA_URL = '/api/custom-nodes/schema';

/** 校验并收窄 schema 载荷；非法结构抛错，由调用方决定回退策略 */
export function parseCustomNodeSchemaPayload(payload: unknown): CustomNodeNamespace[] {
  if (!Array.isArray(payload)) {
    throw new Error('schema response is not an array');
  }
  return payload as CustomNodeNamespace[];
}

export async function fetchCustomNodeSchema(
  source: CustomNodeSchemaSource = DEFAULT_SCHEMA_URL,
): Promise<CustomNodeNamespace[]> {
  try {
    let payload: unknown;
    if (typeof source === 'function') {
      payload = await source();
    } else {
      const response = await fetch(source, { headers: { Accept: 'application/json' } });
      if (!response.ok) {
        throw new Error(`schema request failed: ${response.status}`);
      }
      payload = await response.json();
    }
    return parseCustomNodeSchemaPayload(payload);
  } catch (error) {
    console.warn('[custom-node] fetch schema failed, using bundled fallback', error);
    return fallbackSchema as CustomNodeNamespace[];
  }
}
