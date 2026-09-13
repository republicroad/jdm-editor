import { defineContrib, defineTool } from '../register.ts';

/**
 * 旧平台函数域重建（第六十九批 D2，docs/13 §8.3）：内存滑动窗口计数。
 * 进程内实现（单实例语义有效），生产多副本的 Redis 化留宿主层。
 *
 * 字段语义按图内 returnSchema 重建（撞库攻击防御.json，原实现已随重设计移除，
 * 本实现依据字段名与风控语义重构并在注释中明示）：
 *  - rate_1h(entity) → RateCommonResult {counter 窗口内事件数, v 实体, idle 距上次事件秒数, timestamp}
 *  - group_distinct_1h(group, value) → GroupDistinctCommonResult
 *    {pv 组窗口内事件数, uv 组窗口内去重值数, idle 距该 (group,value) 对上次事件秒数,
 *     gidle 距该组上次事件秒数, vidle 距该值上次事件秒数(跨组), group, v, timestamp}
 */

const WINDOW_MS = 60 * 60 * 1000;

const rateWindows = new Map<string, number[]>();
const groupWindows = new Map<string, { pv: number[]; values: Map<string, number[]> }>();
const valueWindows = new Map<string, number[]>();

/** 测试辅助：清空全部窗口状态（生产勿用） */
export const __resetRateWindows = (): void => {
  rateWindows.clear();
  groupWindows.clear();
  valueWindows.clear();
};

const inWindow = (stamps: number[], now: number): number[] => stamps.filter((t) => now - t < WINDOW_MS);

const secondsSince = (now: number, t?: number): number => (t ? Math.max(0, Math.floor((now - t) / 1000)) : 0);

const rate_1h = defineTool({
  name: 'rate_1h',
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
    const now = Date.now();
    const stamps = inWindow(rateWindows.get(entity) ?? [], now);
    const previous = stamps[stamps.length - 1];
    stamps.push(now);
    rateWindows.set(entity, stamps);
    return {
      counter: stamps.length,
      v: entity,
      idle: secondsSince(now, previous),
      timestamp: new Date(now).toISOString(),
    };
  },
});

const group_distinct_1h = defineTool({
  name: 'group_distinct_1h',
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
    const now = Date.now();

    const entry = groupWindows.get(group) ?? { pv: [], values: new Map<string, number[]>() };
    entry.pv = inWindow(entry.pv, now);
    const groupPrevious = entry.pv[entry.pv.length - 1];
    entry.pv.push(now);

    const valueStamps = inWindow(entry.values.get(value) ?? [], now);
    const pairPrevious = valueStamps[valueStamps.length - 1];
    valueStamps.push(now);
    entry.values.set(value, valueStamps);
    for (const [v, stamps] of entry.values) {
      if (inWindow(stamps, now).length === 0) entry.values.delete(v);
    }
    groupWindows.set(group, entry);

    const globalPrevious = (valueWindows.get(value) ?? []).filter((t) => now - t < WINDOW_MS).slice(-1)[0];
    const globalStamps = inWindow(valueWindows.get(value) ?? [], now);
    globalStamps.push(now);
    valueWindows.set(value, globalStamps);

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
  },
});

export default defineContrib(import.meta.url, {
  tools: [rate_1h, group_distinct_1h],
});
