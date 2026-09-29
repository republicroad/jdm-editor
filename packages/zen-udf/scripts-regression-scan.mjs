import { writeFileSync } from 'node:fs';

import { corpusFiles, kindOf, parseCsv, runCase } from './src/expression-regression.runner.ts';

// 台账再生：基于 runner 的官方语义 + 双通道时区比较，只把「真失败」入账；
// 已通过的行自动从台账剔除（防止已修差异滞留）。

const ledger = {};
for (const file of corpusFiles) {
  const kind = kindOf(file);
  const { rows } = parseCsv(file);
  for (const row of rows) {
    const { pass, detail } = runCase(kind, row);
    if (!pass) {
      ledger[row.expression] ??= detail.slice(0, 60);
    }
  }
}
writeFileSync('src/expression-regression.divergences.json', JSON.stringify({ divergences: ledger }, null, 2) + '\n');
console.log('ledger entries:', Object.keys(ledger).length);
