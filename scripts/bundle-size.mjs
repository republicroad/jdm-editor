import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dist = path.join(root, 'packages', 'jdm-editor', 'dist');
const budgetsPath = path.join(root, 'scripts', 'size-budgets.json');

if (!existsSync(dist)) {
  console.error('[size] packages/jdm-editor/dist not found — run `pnpm build` first.');
  process.exit(1);
}

const budgets = JSON.parse(readFileSync(budgetsPath, 'utf8'));
let fail = false;

for (const [file, budget] of Object.entries(budgets)) {
  const filePath = path.join(dist, file);
  if (!existsSync(filePath)) {
    console.log(`✓ ${file}  (absent from dist, allowed)`);
    continue;
  }

  const contents = readFileSync(filePath);
  const raw = contents.length;
  const gz = gzipSync(contents).length;

  const overRaw = raw > budget.raw;
  const overGzip = budget.gzip !== undefined && gz > budget.gzip;
  const ok = !overRaw && !overGzip;
  fail ||= !ok;

  const limit = `raw ≤ ${(budget.raw / 1024).toFixed(0)}kB${budget.gzip !== undefined ? `, gzip ≤ ${(budget.gzip / 1024).toFixed(0)}kB` : ''}`;
  console.log(
    `${ok ? '✓' : '✗'} ${file.padEnd(12)} raw ${(raw / 1024).toFixed(1)}kB, gzip ${(gz / 1024).toFixed(1)}kB   ( ${limit} )`,
  );
}

if (fail) {
  console.error('\n[size] bundle exceeds budget — investigate before merging.');
  process.exit(1);
}

console.log('\n[size] all artifacts within budget.');
