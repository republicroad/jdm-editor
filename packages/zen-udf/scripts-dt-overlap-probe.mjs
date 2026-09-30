// dt 域 vs 2.1.0 内建重叠探针（ADR-011 后续规划 0.11.x 项）：
// 逐工具判定「内建已覆盖 / 部分覆盖 / 唯一」——证据供时间函数盘点文档回写。
// 运行：bun scripts-dt-overlap-probe.mjs
import { evaluateExpressionSync } from '@gorules/zen-engine';

process.env.TZ = 'UTC';

const run = (expression) => {
  try {
    const value = evaluateExpressionSync(expression, {});
    return { ok: true, value };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error).slice(0, 90) };
  }
};

const cases = [
  // ── dt.convert 重叠面：tz 转换 + 挂钟格式化 ──
  ['convert/等价链', "d('2026-10-01T08:00:00+08:00').tz('America/New_York').format('%Y-%m-%dT%H:%M:%S')"],
  ['convert/DST 正确性（11 月冬令时）', "d('2026-11-01T12:00:00Z').tz('America/New_York').format('%Y-%m-%dT%H:%M:%S')"],
  ['convert/非法时区行为', "d('2026-10-01T08:00:00Z').tz('Nope/Nowhere')"],
  ['convert/非法时区+format', "d('2026-10-01T08:00:00Z').tz('Nope/Nowhere').format('%Y')"],
  ['convert/tz(日期字面量·本地绑定)', "d('2026-10-01').tz('Asia/Shanghai').format('%Y-%m-%dT%H:%M:%S')"],
  ['convert/构造器二参形态', "d('2026-10-01T08:00:00', 'America/New_York').format('%Y-%m-%dT%H:%M:%S')"],

  // ── dt.diff 重叠面：days/months 内建 vs business_days 唯一 ──
  ['diff/天（内建）', "d('2026-01-01').diff(d('2026-01-15'), 'd')"],
  ['diff/月（内建 M 单位）', "d('2026-01-15').diff(d('2026-03-01'), 'M')"],
  ['diff/月（月末钳制场景 1-31→3-1）', "d('2026-01-31').diff(d('2026-03-01'), 'M')"],
  ['diff/月（同月内）', "d('2026-03-01').diff(d('2026-03-28'), 'M')"],
  ['diff/月（跨年）', "d('2025-11-30').diff(d('2026-02-28'), 'M')"],
  ['diff/月（整月边界）', "d('2026-01-01').diff(d('2026-02-01'), 'M')"],
  ['diff/business_days（预期缺失）', "d('2026-01-01').diff(d('2026-01-15'), 'business_days')"],
  ['diff/负向（to < from）', "d('2026-01-15').diff(d('2026-01-01'), 'd')"],

  // ── dt.business_day 重叠面：内建只有 weekday 取值，无日历概念 ──
  ['business/weekday 取值（周末判定替代）', "d('2026-10-03').weekday()"],
  ['business/无 business 相关内建函数', "typeof(d('2026-10-03').businessDay)"],
];

for (const [label, expression] of cases) {
  const r = run(expression);
  const out = r.ok ? JSON.stringify(r.value) : `ERROR: ${r.error}`;
  console.log(`${label.padEnd(34)} ${expression}\n${' '.repeat(36)}→ ${out}\n`);
}

// ── dt 域同输入对照（与上方表达式一一对应的手工核对锚点）──
const { dtConvertTool, dtDiffTool } = await import('./src/contrib/datetime.ts');
console.log('── dt 域同输入对照 ──');
console.log(
  'dt_convert(2026-10-01T08:00+08 → NY) →',
  JSON.stringify(dtConvertTool.run({ datetime: '2026-10-01T08:00:00+08:00', to: 'America/New_York' })),
);
console.log(
  'dt_convert(非法时区)                →',
  JSON.stringify(dtConvertTool.run({ datetime: '2026-10-01T08:00:00Z', to: 'Nope/Nowhere' })),
);
console.log(
  'dt_diff(1-31 → 3-1, months)         →',
  JSON.stringify(dtDiffTool.run({ from: '2026-01-31', to: '2026-03-01', unit: 'months' })),
);
console.log(
  'dt_diff(2025-11-30 → 2026-02-28, months) →',
  JSON.stringify(dtDiffTool.run({ from: '2025-11-30', to: '2026-02-28', unit: 'months' })),
);
