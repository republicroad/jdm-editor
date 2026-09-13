import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * zen-udf 发布物冒烟（W2）：npm pack → 临时目录安装 tarball → Bun 跑最小执行脚本。
 * 验证的是「发布出去的 artifact」而非工作区源码——发布前的最后一道闸。
 *
 * Usage: node scripts/probes/zen-udf-npm-smoke.mjs   （依赖 bun + npm 网络可达）
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pkgDir = path.join(root, 'packages', 'zen-udf');

const pack = spawnSync('npm', ['pack', '--pack-destination', tmpdir()], {
  cwd: pkgDir,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (pack.status !== 0) {
  console.error('[zen-udf-smoke] npm pack failed:\n' + pack.stderr);
  process.exit(1);
}
const tarballName = pack.stdout.trim().split(/\r?\n/).pop();
const tarball = path.join(tmpdir(), tarballName);
console.log('[zen-udf-smoke] packed:', tarballName);

const workdir = mkdtempSync(path.join(tmpdir(), 'zen-udf-smoke-'));
writeFileSync(
  path.join(workdir, 'package.json'),
  JSON.stringify({ name: 'zen-udf-smoke', private: true, type: 'module' }, null, 2),
);

const install = spawnSync('bun', ['add', tarball], {
  cwd: workdir,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
if (install.status !== 0) {
  console.error('[zen-udf-smoke] bun add failed:\n' + install.stderr);
  rmSync(workdir, { recursive: true, force: true });
  process.exit(1);
}

const consumerScript = `
import { DecisionRuntime, createUdfRegistry, runWithExecContext } from '@republicroad/zen-udf';

const registry = createUdfRegistry({
  packs: [
    {
      namespace: 'smoke',
      tools: [
        {
          name: 'smoke_udf',
          parametersSchema: { properties: { x: { type: 'integer' } }, type: 'object' },
          returnsSchema: { type: 'object', properties: { doubled: { type: 'integer' } }, required: ['doubled'] },
          fn: (kwargs) => ({ doubled: (kwargs?.x ?? 0) * 2 }),
        },
      ],
    },
  ],
});

const runtime = new DecisionRuntime({ registry });
const graph = {
  id: 'smoke-graph',
  nodes: [
    { id: 'in', type: 'inputNode', name: 'Request' },
    { id: 'c1', type: 'customNode', name: 'custom', content: { kind: 'UDF', config: { expressions: [{ id: 'e1', key: 'out', value: 'smoke_udf;;x' }] } } },
    { id: 'out', type: 'outputNode', name: 'Response' },
  ],
  edges: [
    { id: 'ed1', sourceId: 'in', targetId: 'c1', type: 'edge' },
    { id: 'ed2', sourceId: 'c1', targetId: 'out', type: 'edge' },
  ],
};

await runWithExecContext({ tenantId: 'smoke-tenant' }, async () => {
  runtime.createDecisionWithCacheKey('m', graph, 'v1');
  const r1 = await runtime.evaluateAsync('m', { x: 21 }, { trace: true }, 'v1');
  const out = r1.result?.out;
  if (out?.doubled !== 42) throw new Error('expected doubled=42, got ' + JSON.stringify(r1.result));
  const traceEntry = r1.trace?.['c1']?.traceData?.udf?.[0];
  if (!traceEntry || traceEntry.name !== 'smoke_udf') throw new Error('missing udf trace: ' + JSON.stringify(traceEntry));
  console.log('SMOKE_OK doubled=42 trace=' + traceEntry.name);
});
`;
writeFileSync(path.join(workdir, 'smoke.ts'), consumerScript);

const run = spawnSync('bun', ['smoke.ts'], { cwd: workdir, encoding: 'utf8', shell: process.platform === 'win32' });
const output = run.stdout + run.stderr;
rmSync(workdir, { recursive: true, force: true });
rmSync(tarball, { force: true });

if (run.status === 0 && output.includes('SMOKE_OK doubled=42')) {
  console.log('[zen-udf-smoke] ✓ 发布物执行链路通过（UdfPack 注册 → customNode 执行 → traceData）');
  process.exit(0);
}
console.error('[zen-udf-smoke] ✗ smoke failed:\n' + output.slice(-2000));
process.exit(1);
