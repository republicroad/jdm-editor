#!/usr/bin/env node
/**
 * 契约兼容级门禁（CONTRACT §8 兼容级立法，1.6.0 调研增量⑤/Confluent 同族）：
 * 当前 HEAD 的公共导出面 vs npm 上一已发版的导出面——逐名比对。
 * 移除/改名（上一版有、当前无）= BREAKING：package.json major 未升即 fail。
 * additive（新增导出）= BACKWARD，放行并在报告中列出。
 *
 * 用法：node scripts-contract-compat.mjs [previousVersion]
 *   previousVersion 缺省 = npm dist-tags.latest（跳过 = 当前版时输出 no-op）。
 * 源码发布（ADR-005）前提：tarball 内即 src/*.ts，export 语句可直接解析。
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const shell = process.platform === 'win32' ? true : undefined;
const pkgDir = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
const current = manifest.version;

const latest = execFileSync('npm', ['view', manifest.name, 'version'], { encoding: 'utf8', shell }).trim();
const previous = process.argv[2] ?? latest;
if (previous === current) {
  console.log(`[compat] ${manifest.name}@${current} 已发布（当前 HEAD 即 latest）——无 diff 对象，通过`);
  process.exit(0);
}

/** 从 index.ts 抽导出名：`export {...}` 块 + 行内 export 声明。 */
const surfaceOf = (indexSource) => {
  // 剥注释（首个真实案例：deprecated 别名导出块的 JSDoc 行被当伪名字——1.8.0 实测）。
  // 行过滤零正则：JSDoc 行首恒为 '*' 或 '/*'；行尾注释在导出块中不存在。
  const src = indexSource
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      return !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('//');
    })
    .join('\n');
  const names = new Set();
  for (const m of src.matchAll(/export\s*(?:type)?\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part
        .trim()
        .split(/\s+as\s+/)
        .pop()
        ?.trim();
      if (name) names.add(name);
    }
  }
  for (const m of src.matchAll(
    /export\s+(?:async\s+)?(?:const|function|class|let|var|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    names.add(m[1]);
  }
  return names;
};

const currentSource = readFileSync(join(pkgDir, 'src', 'index.ts'), 'utf8');
const currentNames = surfaceOf(currentSource);

const { mkdtempSync, rmSync, readdirSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const work = mkdtempSync(join(tmpdir(), 'compat-'));
execFileSync('npm', ['pack', `${manifest.name}@${previous}`, '--pack-destination', work], {
  cwd: pkgDir,
  encoding: 'utf8',
  shell,
});
const tgz = readdirSync(work).find((f) => f.endsWith('.tgz'));
execFileSync('tar', ['-xzf', tgz, 'package/src/index.ts'], { cwd: work, shell });
const previousNames = surfaceOf(readFileSync(join(work, 'package', 'src', 'index.ts'), 'utf8'));
rmSync(work, { recursive: true, force: true });

const removed = [...previousNames].filter((n) => !currentNames.has(n));
const added = [...currentNames].filter((n) => !previousNames.has(n));

console.log(`[compat] ${manifest.name}: ${previous} -> ${current}`);
console.log(
  `[compat] surface: ${previousNames.size} -> ${currentNames.size} (additive ${added.length}, removed ${removed.length})`,
);
for (const n of added.sort()) console.log(`[compat]   + ${n}`);
for (const n of removed.sort()) console.log(`[compat]   - ${n}`);

if (removed.length > 0) {
  const prevMajor = Number.parseInt(previous.split('.')[0] ?? '0', 10);
  const curMajor = Number.parseInt(current.split('.')[0] ?? '0', 10);
  if (curMajor <= prevMajor) {
    console.error(
      `[compat] BREAKING：导出移除/改名 ${removed.join(', ')} 而 major 未升（${prevMajor} -> ${curMajor}）——CONTRACT §8 兼容级门禁`,
    );
    process.exit(1);
  }
  console.log('[compat] BREAKING 已随 major 升级——通过');
}
console.log('[compat] 通过');
