import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { corpusFiles, kindOf, parseCsv, runCase } from './expression-regression.runner.ts';

process.env.TZ = 'UTC';

// 求值与比较语义在 runner 模块（台账再生脚本共用同一实现，单一事实源）

const DIVERGENCES: Record<string, string> = JSON.parse(
  readFileSync(join(import.meta.dir, 'expression-regression.divergences.json'), 'utf8'),
).divergences;

for (const file of corpusFiles) {
  const kind = kindOf(file);
  const { rows, skipped } = parseCsv(file);

  describe(`zen-expression 回归语料（${file}：${rows.length} 例，跳过非 3 字段行 ${skipped}）`, () => {
    for (const row of rows) {
      test(`${row.expression}  ←  ${row.input || '(empty)'}`, () => {
        const { pass, detail } = runCase(kind, row);
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
