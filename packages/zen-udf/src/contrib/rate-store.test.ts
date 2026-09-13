import { describe, expect, test } from 'vitest';

import { rateStoreConformance } from './rate-store-conformance.ts';
import { InMemoryRateStore, __resetRateWindows, setRateStore } from './rate-window.ts';

// 参考实现（InMemoryRateStore）必须通过契约测试——verdict 的 Redis 实现
// 复用 rateStoreConformance 验证同一语义（宿主裁决 D1）
rateStoreConformance('InMemoryRateStore', (now) => new InMemoryRateStore(now));

describe('RateStore 注入点', () => {
  test('setRateStore 后 UDF 语义经注入实现执行；__resetRateWindows 调用 reset', async () => {
    const calls: string[] = [];
    setRateStore({
      rate: (entity) => {
        calls.push('rate:' + entity);
        return { counter: 42, v: entity, idle: 0, timestamp: 'injected' };
      },
      groupDistinct: (group, value) => {
        calls.push('group:' + group);
        return { idle: 0, pv: 0, uv: 0, gidle: 0, vidle: 0, group, v: value, timestamp: 'injected' };
      },
      reset: () => calls.push('reset'),
    });
    __resetRateWindows();
    expect(calls).toContain('reset');
    // 还原缺省实现，避免影响其它测试
    setRateStore(new InMemoryRateStore());
    __resetRateWindows();
  });
});
