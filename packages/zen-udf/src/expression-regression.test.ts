import { evaluateExpressionSync, evaluateUnaryExpressionSync } from '@gorules/zen-engine';
import JSON5 from 'json5';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// zen-expression 语言回归语料：源自 gorules/zen Rust 仓 core/expression/tests/data
// （基线 61862ab，"chore(release): publish (#526)"），逐字 vendor。本测试验证 JS 侧
// 引擎（@gorules/zen-engine wasm/napi 绑定）与 Rust 语义的对齐；语言变更同步流程：
// 重拷三份 csv + 按新基线更新本注释。
//
// 解析语义对齐官方 harness（isolate.rs test_csv_standard）：
// - RFC 风格引号字段（"..." 包裹，"" 转义）；
// - 首行为 header（官方 has_headers 吃掉）；
// - 字段数 ≠ 3 的行官方经 flexible 错误静默跳过（如 interval-iterator 的 2 字段行）；
// - serde_json Value 相等 = 键序不敏感；
// - date 语料假定 UTC 环境（官方进程内 set_var("TZ","UTC")）。Windows 上 napi 绑定
//   经 OS 取时区（TZ env 无效），裸日期会绑定为本地 midnight——故 ISO 日期时间串
//   增加「墙钟等值」回退比较（zone 语义差异放行，日/时/分/秒算错仍拦截）。

process.env.TZ = 'UTC';

const DATA_DIR = join(import.meta.dir, 'expression-regression');

type Row = { line: number; expression: string; input: string; output: string };

/** RFC 风格 ';' 分割：双引号包裹字段（"" 转义），非引号字段内引号按字面量 */
const splitCsvLine = (raw: string): string[] => {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"' && current.length === 0) {
      inQuotes = true;
      continue;
    }
    if (ch === ';') {
      fields.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  fields.push(current);
  return fields;
};

const parseCsv = (file: string): { rows: Row[]; skipped: number } => {
  const rows: Row[] = [];
  let skipped = 0;
  const lines = readFileSync(join(DATA_DIR, file), 'utf8').split(/\r?\n/);
  lines.forEach((raw, index) => {
    if (index === 0 && raw.startsWith('expression (string)')) {
      return; // header（官方 has_headers）
    }
    const fields = splitCsvLine(raw);
    if (fields.length !== 3) {
      skipped++; // 官方 flexible 错误静默跳过（如 interval-iterator 2 字段行）
      return;
    }
    const [expression = '', input = '', output = ''] = fields;
    if (expression.trim().startsWith('#')) {
      return;
    }
    rows.push({ line: index + 1, expression: expression.trim(), input: input.trim(), output: output.trim() });
  });
  return { rows, skipped };
};

/** 键序不敏感深比较 + 数值容差 */
const looseEqual = (a: unknown, b: unknown): boolean => {
  if (typeof a === 'number' && typeof b === 'number') {
    return Object.is(a, b) || Math.abs(a - b) < 1e-9;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => looseEqual(item, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).sort();
    const kb = Object.keys(b).sort();
    return (
      ka.length === kb.length &&
      ka.every(
        (k, i) => k === kb[i] && looseEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
      )
    );
  }
  return a === b;
};

const ISO_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const ISO_ZONED = /(?:Z|[+-]\d{2}:?\d{2})$/;
/**
 * ISO 日期时间串的时区容错比较（双通道，任一成立即等）：
 * ① 时刻相等——带 zone 的串按绝对时间比（引擎把 Z 输入换算为本地 +08 表示时放行）；
 * ② 墙钟相等——裸日期绑定的 zone 语义随环境（Windows napi 走 OS 时区，TZ env 无效），
 *    按 zone 前分量比（日/时/分/秒算错仍拦截）。
 */
const instantOf = (value: unknown): number | null => {
  if (typeof value !== 'string' || !ISO_DATETIME.test(value) || !ISO_ZONED.test(value)) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};
const wallClockOf = (value: unknown): string | null => {
  if (typeof value !== 'string' || !ISO_DATETIME.test(value)) {
    return null;
  }
  return value.slice(0, 19).replace('T', ' ');
};

const compare = (actual: unknown, expected: unknown): boolean => {
  if (looseEqual(actual, expected)) {
    return true;
  }
  // 双通道「任一相等即等」：瞬时通道失败时仍可落墙钟通道（裸日期绑定的 zone 差异）
  const aInstant = instantOf(actual);
  const eInstant = typeof expected === 'string' ? instantOf(expected) : null;
  if (aInstant !== null && eInstant !== null && aInstant === eInstant) {
    return true;
  }
  const aWall = wallClockOf(actual);
  const eWall = typeof expected === 'string' ? wallClockOf(expected) : null;
  if (aWall !== null && eWall !== null && aWall === eWall) {
    return true;
  }
  return false;
};

const runCase = (file: string, kind: 'standard' | 'unary', row: Row): { pass: boolean; detail: string } => {
  try {
    const input = row.input ? JSON5.parse(row.input) : {};
    const actual =
      kind === 'unary'
        ? evaluateUnaryExpressionSync(row.expression, input)
        : evaluateExpressionSync(row.expression, input);
    const expected = JSON5.parse(row.output);
    if (compare(actual, expected)) {
      return { pass: true, detail: '' };
    }
    return {
      pass: false,
      detail: `got=${JSON.stringify(actual) ?? String(actual)} want=${row.output}`,
    };
  } catch (error) {
    return { pass: false, detail: `threw: ${(error as Error).message.slice(0, 140)}` };
  }
};

/**
 * 分歧台账：JS 绑定（@gorules/zen-engine@2.0.2）落后 Rust 基线（61862ab）的
 * 已知特性缺口，按表达式键控。三条契约：
 * ① 失败 + 在台账 = 预期版本差异，放行；
 * ② 失败 + 不在台账 = 新回归，硬拦（台账外不允许任何静默失败）；
 * ③ 通过 + 在台账 = 差异已修，硬拦提示清账（防台账腐化）。
 * 台账再生成：bun scripts-regression-scan.mjs（从当轮真实失败反提）。
 */
const DIVERGENCES: Record<string, string> = JSON.parse(
  readFileSync(join(import.meta.dir, 'expression-regression.divergences.json'), 'utf8'),
).divergences;

for (const file of ['standard.csv', 'date.csv', 'unary.csv'] as const) {
  const kind = file === 'unary.csv' ? 'unary' : 'standard';
  const { rows, skipped } = parseCsv(file);

  describe(`zen-expression 回归语料（${file}：${rows.length} 例，跳过非 3 字段行 ${skipped}）`, () => {
    for (const row of rows) {
      test(`${row.expression}  ←  ${row.input || '(empty)'}`, () => {
        const { pass, detail } = runCase(file, kind, row);
        const knownDivergence = DIVERGENCES[row.expression];
        if (pass) {
          expect(knownDivergence, `${file}:${row.line} 差异已修——请从台账清除: ${row.expression}`).toBeUndefined();
          return;
        }
        expect(
          knownDivergence,
          `${file}:${row.line} 台账外新回归 [${detail}]；若为版本缺口请入 expression-regression.divergences.json`,
        ).toBeDefined();
      });
    }
  });
}
