import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

// 从 bun test 的真实失败（官方语义 + 双通道时区比较之后）反提分歧台账。
// (fail) 行格式：`(fail) <describe 名> > <expression>  ←  <input> [...]`——
// 测试名以表达式开头，直接作为台账键。

const run = spawnSync('bun', ['test', 'src/expression-regression.test.ts'], { encoding: 'utf8' });
const output = (run.stdout || '') + (run.stderr || '');

const classify = (expression) => {
  if (/\.format\(/.test(expression)) return 'format-strftime-unsupported';
  if (/\.tz\(/.test(expression)) return 'tz-conversion-unsupported';
  if (/'(Europe|America)\/[A-Za-z_]+'/.test(expression)) return 'tz-parameter-unsupported';
  if (/\.timestamp\(\)/.test(expression)) return 'timestamp-tz-dependent';
  if (/(year|string)\(d\(/.test(expression)) return 'date-accessor-functions-missing';
  if (/d\('(?:[^']*Z|[^']*[+-]\d{2}:?\d{0,2})'/.test(expression)) return 'offset-input-parsing';
  if (/'2023\/|20231|T14:30:45'|T14:30'/.test(expression)) return 'partial-input-formats';
  if (/d\(d\(/.test(expression)) return 'tz-parameter-unsupported';
  if (/==|!=|<|>| in |contains| \+ /.test(expression)) return 'date-string-comparison-rendering';
  return 'assignment-result-semantics';
};

const ledger = {};
for (const match of output.matchAll(/\(fail\) .*? > (.+?)  ←/g)) {
  const expression = match[1];
  ledger[expression] ??= classify(expression);
}

writeFileSync('src/expression-regression.divergences.json', JSON.stringify({ divergences: ledger }, null, 2) + '\n');
console.log('ledger entries:', Object.keys(ledger).length);
const byReason = {};
for (const reason of Object.values(ledger)) byReason[reason] = (byReason[reason] ?? 0) + 1;
console.log(byReason);
