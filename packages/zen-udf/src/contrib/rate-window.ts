import { getExecContext } from '../exec-context.ts';
import { defineContrib, defineTool } from '../register.ts';

/**
 * 旧平台函数域重建（第六十九批 D2，docs/13 §8.3）：滑动窗口频控。
 * U8 起拆分为 RateStore 端口 + 进程内参考实现：
 *  - 端口（RateStore）是机制契约；verdict 侧提供 Redis 真实实现（宿主裁决 D1），
 *    并复用 rate-store-conformance.ts 的同一套契约测试。
 *  - InMemoryRateStore 为单实例语义的开发态参考实现，仅测试/本地使用。
 *
 * 字段语义按图内 returnSchema 重建（撞库攻击防御.json）：
 *  - rate(entity, window) → RateCommonResult {counter 窗口内事件数, v 实体, idle 距上次事件秒数, timestamp}
 *  - groupDistinct(group, value, window) → GroupDistinctCommonResult
 *    {pv 组窗口内事件数, uv 组窗口内去重值数, idle 距该 (group,value) 对上次事件秒数,
 *     gidle 距该组上次事件秒数, vidle 距该值上次事件秒数(跨组), group, v, timestamp}
 */
export interface RateCommonResult {
  counter: number;
  v: string;
  idle: number;
  timestamp: string;
}

export interface GroupDistinctCommonResult {
  idle: number;
  pv: number;
  uv: number;
  gidle: number;
  vidle: number;
  group: string;
  v: string;
  timestamp: string;
}

/** 频控存储端口：Redis 化实现（verdict 侧）须通过 rate-store-conformance 契约测试 */
export interface RateStore {
  rate(entity: string, windowMs: number, asOf?: number): RateCommonResult | Promise<RateCommonResult>;
  groupDistinct(
    group: string,
    value: string,
    windowMs: number,
    asOf?: number,
  ): GroupDistinctCommonResult | Promise<GroupDistinctCommonResult>;
  /** 清空状态（测试辅助；生产实现可为 no-op） */
  reset?(): void;
}

const secondsSince = (now: number, t?: number): number => (t ? Math.max(0, Math.floor((now - t) / 1000)) : 0);

/** 进程内滑动窗口参考实现（单实例语义；多副本请使用 Redis 化实现） */
export class InMemoryRateStore implements RateStore {
  private rateWindows = new Map<string, number[]>();
  private groupWindows = new Map<string, { pv: number[]; values: Map<string, number[]> }>();
  private valueWindows = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  reset(): void {
    this.rateWindows.clear();
    this.groupWindows.clear();
    this.valueWindows.clear();
  }

  rate(entity: string, windowMs: number, asOf?: number): RateCommonResult {
    const now = asOf ?? this.now();
    const stamps = (this.rateWindows.get(entity) ?? []).filter((t) => now - t < windowMs);
    const previous = stamps[stamps.length - 1];
    stamps.push(now);
    this.rateWindows.set(entity, stamps);
    return {
      counter: stamps.length,
      v: entity,
      idle: secondsSince(now, previous),
      timestamp: new Date(now).toISOString(),
    };
  }

  groupDistinct(group: string, value: string, windowMs: number, asOf?: number): GroupDistinctCommonResult {
    const now = asOf ?? this.now();

    const entry = this.groupWindows.get(group) ?? { pv: [], values: new Map<string, number[]>() };
    entry.pv = entry.pv.filter((t) => now - t < windowMs);
    const groupPrevious = entry.pv[entry.pv.length - 1];
    entry.pv.push(now);

    const valueStamps = (entry.values.get(value) ?? []).filter((t) => now - t < windowMs);
    const pairPrevious = valueStamps[valueStamps.length - 1];
    valueStamps.push(now);
    entry.values.set(value, valueStamps);
    for (const [v, stamps] of entry.values) {
      if (stamps.filter((t) => now - t < windowMs).length === 0) entry.values.delete(v);
    }
    this.groupWindows.set(group, entry);

    const globalStamps = (this.valueWindows.get(value) ?? []).filter((t) => now - t < windowMs);
    const globalPrevious = globalStamps[globalStamps.length - 1];
    globalStamps.push(now);
    this.valueWindows.set(value, globalStamps);

    return {
      idle: secondsSince(now, pairPrevious),
      pv: entry.pv.length,
      uv: entry.values.size,
      gidle: secondsSince(now, groupPrevious),
      vidle: secondsSince(now, globalPrevious),
      group,
      v: value,
      timestamp: new Date(now).toISOString(),
    };
  }
}

/** 活动存储：缺省为进程内参考实现；宿主经 setRateStore 注入 Redis 化实现 */
let activeStore: RateStore = new InMemoryRateStore();

export const setRateStore = (store: RateStore): void => {
  activeStore = store;
};

export const getRateStore = (): RateStore => activeStore;

/** 测试辅助：重置活动存储（若实现支持 reset；生产勿用） */
export const __resetRateWindows = (): void => {
  activeStore.reset?.();
};

const WINDOW_MS = 60 * 60 * 1000;

/** 事件时间锚点：ExecContext.eventTime / replay.asOf（ISO）→ epoch ms；缺省 undefined = 处理时间 */
const resolveAsOfMs = (): number | undefined => {
  const ctx = getExecContext();
  const iso = ctx?.eventTime ?? ctx?.replay?.asOf;
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : undefined;
};

const rate_1h = defineTool({
  name: 'rate_1h',
  semantics: 'observe',
  description: '旧域重建·频次统计：记录实体事件并返回其 1 小时滑动窗口内的事件计数。',
  parametersSchema: {
    properties: {
      entity: {
        type: 'string',
        title: '实体',
        description: '计数实体（如 ip、phone）',
      },
    },
  },
  returnsSchema: {
    type: 'object',
    title: 'RateCommonResult',
    properties: {
      counter: { type: 'integer', title: 'Counter', default: 0 },
      v: { type: 'string', title: 'V', default: '' },
      idle: { type: 'integer', title: 'Idle', default: 0 },
      timestamp: { type: 'string', title: 'Timestamp', default: '' },
    },
  },
  fn: function rateUdf(kwargs: Record<string, unknown>) {
    const entity = String(kwargs?.entity ?? '');
    return Promise.resolve(getRateStore().rate(entity, WINDOW_MS, resolveAsOfMs()));
  },
});

const group_distinct_1h = defineTool({
  name: 'group_distinct_1h',
  semantics: 'observe',
  description: '旧域重建·组去重统计：记录 (组, 值) 事件并返回 1 小时滑动窗口内组事件数(pv)与去重值数(uv)。',
  parametersSchema: {
    properties: {
      group: {
        type: 'string',
        title: '组',
        description: '分组键（如 ip）',
      },
      value: {
        type: 'string',
        title: '值',
        description: '组内观测值（如 phone）',
      },
    },
  },
  returnsSchema: {
    type: 'object',
    title: 'GroupDistinctCommonResult',
    properties: {
      idle: { type: 'integer', title: 'Idle', default: 0 },
      pv: { type: 'integer', title: 'Pv', default: 0 },
      uv: { type: 'integer', title: 'Uv', default: 0 },
      gidle: { type: 'integer', title: 'Gidle', default: 0 },
      vidle: { type: 'integer', title: 'Vidle', default: 0 },
      group: { type: 'string', title: 'Group', default: '' },
      v: { type: 'string', title: 'V', default: '' },
      timestamp: { type: 'string', title: 'Timestamp', default: '' },
    },
  },
  fn: function groupDistinctUdf(kwargs: Record<string, unknown>) {
    const group = String(kwargs?.group ?? '');
    const value = String(kwargs?.value ?? '');
    return Promise.resolve(getRateStore().groupDistinct(group, value, WINDOW_MS, resolveAsOfMs()));
  },
});

export default defineContrib(import.meta.url, {
  tools: [rate_1h, group_distinct_1h],
});
