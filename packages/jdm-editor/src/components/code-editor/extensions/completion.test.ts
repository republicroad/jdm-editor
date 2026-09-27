import { describe, expect, it } from 'vitest';

import { getCompletions, setUdfCompletions } from './completion';

const rosterTool = {
  name: 'roster',
  title: '查询名单',
  description: '在服务端名单中查询某个值',
  parameters: {
    properties: {
      roster: { type: 'string', description: '名单名称' },
      value: { type: 'string', description: '待查询的值' },
    },
    required: ['roster', 'value'],
  },
};

describe('setUdfCompletions (WS2 批 1 A2)', () => {
  it('merges registry tools into the completion list as function entries', () => {
    setUdfCompletions([rosterTool]);

    const all = getCompletions();
    const udf = all.find((c) => c.label === 'roster');

    expect(udf).toBeDefined();
    expect(udf?.type).toBe('function');
    expect(udf?.kind).toBe('function');
    expect(udf?.detail).toBe('roster(roster, value)');
    expect(udf?.info).toContain('查询名单');
    expect(udf?.info).toContain('roster (string) — 名单名称');
    // 提升权重：自有函数排在内置建议之前
    expect(udf?.boost).toBeGreaterThan(0);
  });

  it('supports zero-parameter tools and clears on empty injection', () => {
    setUdfCompletions([{ name: 'current_date', title: '当前日期', parameters: { properties: {} } }]);
    expect(getCompletions().find((c) => c.label === 'current_date')?.info).toContain('无参数');

    setUdfCompletions([]);
    expect(getCompletions().some((c) => c.label === 'current_date')).toBe(false);
  });
});

describe('setUdfCompletions (WS2 批 2 A4)', () => {
  it('flags deprecated tools in the completion info', () => {
    setUdfCompletions([
      {
        name: 'legacy_hash',
        title: '旧版摘要',
        description: '旧版摘要实现',
        deprecated: { since: '0.6.0', note: '请改用 crypto 函数' },
      },
    ]);
    const udf = getCompletions().find((c) => c.label === 'legacy_hash');
    expect(udf).toBeDefined();
    expect(udf?.info).toContain('⚠️ 已弃用（自 0.6.0 起）: 请改用 crypto 函数');
  });
});
