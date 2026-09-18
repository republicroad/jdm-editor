// ab 域(ab_bucket 函数)：稳定哈希分桶——A/B 实验与灰度放量的纯函数底座。
// FNV-1a 32 位：同 key 恒同桶（可重放），无状态无出网。
import { defineContrib, defineTool } from '../register.ts';

/** FNV-1a 32 位哈希（十进制无符号） */
export const fnv1a = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
};

const MIN_BUCKETS = 1;
const MAX_BUCKETS = 1000;

export const ab_bucket = defineTool({
  name: 'bucket',
  description:
    '将 key 稳定哈希到 [0, buckets) 的整数桶号（FNV-1a，同 key 恒同桶，无状态无出网）。' +
    '用于 A/B 分桶、灰度放量、按标识抽查。buckets 支持 1–1000，非法值回退 2。',
  parametersSchema: {
    properties: {
      key: { type: 'string', title: 'Key', description: '分桶键（如 userId / deviceId）' },
      buckets: {
        type: 'integer',
        title: 'Buckets',
        description: `桶数(${MIN_BUCKETS}–${MAX_BUCKETS})，默认 2`,
        default: 2,
      },
    },
    required: ['key'],
    title: 'ab_bucket',
    type: 'object',
  },
  returnsSchema: { type: 'integer', title: '桶号', description: '[0, buckets) 内的整数' },
  fn: (kwargs: Record<string, unknown>) => {
    const key = String(kwargs?.key ?? '');
    const raw = Number(kwargs?.buckets);
    const buckets = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), MIN_BUCKETS), MAX_BUCKETS) : 2;
    return fnv1a(key) % buckets;
  },
});

export const { fn: abBucket } = ab_bucket;

export default defineContrib(import.meta.url, {
  tools: [ab_bucket],
});
