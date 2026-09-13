import { describe, expect, test } from 'vitest';

import type { RateStore } from './rate-window.ts';

/**
 * RateStore 契约测试（U8）：任何 RateStore 实现（含 verdict 侧 Redis 实现）都应
 * 用本套件验证同一行为语义。工厂接收可注入时钟 now()——实现应使用该时钟打点
 * （Redis 实现可将 now() 的时间戳随命令传入，而非依赖服务器时钟）。
 */
export const rateStoreConformance = (name: string, createStore: (now: () => number) => RateStore): void => {
  describe(`RateStore conformance: ${name}`, () => {
    let nowMs = 1_700_000_000_000;
    let store: RateStore;

    const advance = (ms: number): void => {
      nowMs += ms;
    };

    test('rate：首次计数 1、递增、实体间独立', async () => {
      store = createStore(() => nowMs);
      const a1 = await store.rate('ip-a', 3_600_000);
      const a2 = await store.rate('ip-a', 3_600_000);
      const b1 = await store.rate('ip-b', 3_600_000);
      expect([a1.counter, a2.counter, b1.counter]).toEqual([1, 2, 1]);
      expect(a1.v).toBe('ip-a');
      expect(a1.idle).toBe(0);
      expect(typeof a1.timestamp).toBe('string');
    });

    test('rate：窗口滑出后计数重置，idle 为距上次事件秒数', async () => {
      nowMs = 1_700_000_000_000;
      store = createStore(() => nowMs);
      await store.rate('ip-w', 60_000);
      advance(30_000);
      const second = await store.rate('ip-w', 60_000);
      expect(second.counter).toBe(2);
      expect(second.idle).toBe(30);
      advance(61_000); // 两次事件均滑出 60s 窗口
      const third = await store.rate('ip-w', 60_000);
      expect(third.counter).toBe(1);
    });

    test('groupDistinct：pv 累计、uv 按值去重、组间独立', async () => {
      nowMs = 1_800_000_000_000;
      store = createStore(() => nowMs);
      const r1 = await store.groupDistinct('g-ip', 'p1', 3_600_000);
      const r2 = await store.groupDistinct('g-ip', 'p1', 3_600_000);
      const r3 = await store.groupDistinct('g-ip', 'p2', 3_600_000);
      const other = await store.groupDistinct('g-other', 'p1', 3_600_000);
      expect([r1.pv, r1.uv]).toEqual([1, 1]);
      expect([r2.pv, r2.uv]).toEqual([2, 1]);
      expect([r3.pv, r3.uv]).toEqual([3, 2]);
      expect(other.pv).toBe(1);
      expect(other.group).toBe('g-other');
      expect(other.v).toBe('p1');
    });

    test('rate/groupDistinct：asOf 事件时间锚点（point-in-time 复算）', async () => {
      nowMs = 2_100_000_000_000;
      store = createStore(() => nowMs);
      await store.rate('ip-asof', 60_000);
      const atPlus30 = await store.rate('ip-asof', 60_000, nowMs + 30_000);
      expect(atPlus30.counter).toBe(2);
      expect(atPlus30.idle).toBe(30);
      const atPlus61 = await store.rate('ip-asof', 60_000, nowMs + 61_000);
      // 窗口随 asOf 平移：事件1(nowMs) 滑出，事件2(nowMs+30s) 仍在窗内，本次调用自身计入 → 2
      expect(atPlus61.counter).toBe(2);

      const g1 = await store.groupDistinct('g-asof', 'v1', 60_000, nowMs + 90_000);
      const g2 = await store.groupDistinct('g-asof', 'v2', 60_000, nowMs + 90_000);
      expect([g1.pv, g1.uv]).toEqual([1, 1]);
      expect([g2.pv, g2.uv]).toEqual([2, 2]);
    });

    test('groupDistinct：窗口滑出后 pv/uv 重置', async () => {
      nowMs = 1_900_000_000_000;
      store = createStore(() => nowMs);
      await store.groupDistinct('g-w', 'v1', 60_000);
      await store.groupDistinct('g-w', 'v2', 60_000);
      advance(61_000);
      const after = await store.groupDistinct('g-w', 'v3', 60_000);
      expect([after.pv, after.uv]).toEqual([1, 1]);
    });
  });
};
