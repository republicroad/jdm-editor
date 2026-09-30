import { writeFileSync } from 'node:fs';

import { corpusFiles, kindOf, localZoneProbe, parseCsv, runCase } from './src/expression-regression.runner.ts';

// 台账再生：基于 runner 的官方语义 + 双通道时区比较，只把「真失败」入账；
// 已通过的行自动从台账剔除（防止已修差异滞留）。
// 再生 MUST 在校准环境跑（当前 +08:00）：条目按当次「求值层真实时区」打戳
// （calibratedZoneProbe——localZoneProbe 直接测 wasm/原生层渲染，免疫 JS 层
// TZ 覆写），测试侧据此门控台账适用性——跨环境（如 UTC CI）条目两向停用，
// 防「差异已修」误报与账外缺口语义漂移。

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
writeFileSync(
  'src/expression-regression.divergences.json',
  JSON.stringify({ calibratedZoneProbe: localZoneProbe(), divergences: ledger }, null, 2) + '\n',
);
console.log('ledger entries:', Object.keys(ledger).length);
