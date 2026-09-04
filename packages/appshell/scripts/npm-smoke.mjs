import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * npm-install smoke for the published artifact shape of @republicroad/jdm-appshell.
 *
 * Packs the local package (npm pack applies publishConfig, swapping the dev
 * src entries for dist), installs the tarball into a scratch directory and
 * asserts the published contract: entry files, exports map, bundled
 * declarations carrying the public API, peer declarations, and the entry
 * resolving under plain Node ESM.
 *
 * Usage:
 *   bun run test:npm-smoke                 (packs the LOCAL build; needs `bun run build` first)
 *   bun run test:npm-smoke 0.1.0           (installs the published version from the registry)
 * Not part of the regular gate — run before/after releases.
 */

const registryVersion = process.argv[2] && /^\d+\.\d+\.\d+/.test(process.argv[2]) ? process.argv[2] : null;

const pkgDir = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dist = path.join(pkgDir, 'dist');

if (!registryVersion && !existsSync(path.join(dist, 'index.js'))) {
  console.error('[npm-smoke] dist not found — run `bun run build` first (or pass a registry version).');
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
};

const scratch = path.join(os.tmpdir(), `jdm-appshell-npm-smoke-${Date.now()}`);
mkdirSync(scratch, { recursive: true });

try {
  let installSpec = `@republicroad/jdm-appshell@${registryVersion}`;

  if (registryVersion) {
    check(`registry version ${registryVersion} requested`, true, 'installing from registry');
  } else {
    // 1. npm pack applies publishConfig (dev src entries -> dist); bun pm pack may not.
    const pack = spawnSync('npm', ['pack', '--json'], {
      cwd: pkgDir,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (pack.status !== 0) {
      console.error('[npm-smoke] npm pack failed:', pack.stderr);
      process.exit(1);
    }
    const tarballName = JSON.parse(pack.stdout)[0].filename;
    const tarball = path.join(pkgDir, tarballName);
    const sizeKb = Math.round(statSync(tarball).size / 1024);
    check('tarball packed', existsSync(tarball), `${tarballName} ${sizeKb}kB`);
    installSpec = tarball;
  }

  // 2. install into scratch — mirrors the host contract: peers installed explicitly
  //    (react / react-dom / kernel) plus monaco-editor for the kernel's loader.
  const install = spawnSync(
    'npm',
    [
      'install',
      installSpec,
      '@republicroad/jdm-editor@^0.3.0',
      'react@^18.3.1',
      'react-dom@^18.3.1',
      'monaco-editor@^0.52.2',
      '--no-audit',
      '--no-fund',
      '--ignore-scripts',
      '--registry=https://registry.npmjs.org',
    ],
    { cwd: scratch, encoding: 'utf8', shell: process.platform === 'win32' },
  );
  if (install.status !== 0) {
    console.error('[npm-smoke] install failed:', install.stderr?.slice(0, 400));
    process.exit(1);
  }
  check(
    'installs cleanly',
    true,
    `${install.stdout.split('\n').find((l) => l.includes('added')) ?? ''} (spec: ${installSpec})`,
  );

  const installedDir = path.join(scratch, 'node_modules', '@republicroad', 'jdm-appshell');
  const installedPkg = JSON.parse(readFileSync(path.join(installedDir, 'package.json'), 'utf8'));

  // 3. published contract assertions
  check(
    'name matches @republicroad/jdm-appshell',
    installedPkg.name === '@republicroad/jdm-appshell',
    installedPkg.name,
  );
  check(
    'installed version matches expectation',
    !registryVersion || installedPkg.version === registryVersion,
    installedPkg.version,
  );
  check('publishConfig.access is public', installedPkg.publishConfig?.access === 'public');
  // dev 态入口指向 src/index.ts；pack 时必须已被 publishConfig 换成 dist
  check('publishConfig swapped main to dist', installedPkg.main === './dist/index.js', installedPkg.main ?? 'absent');
  check(
    'publishConfig swapped types to dist',
    installedPkg.types === './dist/index.d.ts',
    installedPkg.types ?? 'absent',
  );
  check(
    'kernel peer declared >= 0.3.0',
    /^>=0\.3/.test(installedPkg.peerDependencies?.['@republicroad/jdm-editor'] ?? ''),
    installedPkg.peerDependencies?.['@republicroad/jdm-editor'] ?? 'absent',
  );

  for (const file of ['dist/index.js', 'dist/index.d.ts', 'dist/style.css', 'README.md', 'LICENSE']) {
    check(`artifact present: ${file}`, existsSync(path.join(installedDir, file)));
  }

  const exportKeys = Object.keys(installedPkg.exports ?? {});
  check(
    'exports map covers entry and css',
    ['.', './dist/style.css'].every((k) => exportKeys.includes(k)),
    exportKeys.join(', '),
  );

  // 多文件声明形态：聚合 dist/**/*.d.ts 全文检索公共 API（内核的单文件 bundle 形态不同）
  const dtsAll = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.d.ts')) dtsAll.push(readFileSync(p, 'utf8'));
    }
  };
  walk(path.join(installedDir, 'dist'));
  const dts = dtsAll.join('\n');
  const mustExport = [
    'EditorShellProvider',
    'useEditorShell',
    'useCustomNodes',
    'applyNodeOverrides',
    'ThemeContextProvider',
    'ThemePreference',
    'createSpecNode',
    'schemaToCustomNodes',
    'cryptoNode',
    'httpRequestNode',
    'queryListNode',
    'jsonPathNode',
    'templateNode',
    'currentDateNode',
    'KeyValueEditor',
    'LockedCornerBadge',
    'GraphPersistenceError',
    'createGraphsHttpAdapter',
  ];
  const missing = mustExport.filter((name) => !dts.includes(name));
  check(
    'bundled declarations carry the public API',
    missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : `${mustExport.length} symbols`,
  );

  // 4. entry resolves under plain Node ESM (contract = resolvable artifact;
  //    full-barrel evaluation is browser-targeted and checked as bonus only)
  const req = createRequire(path.join(scratch, 'package.json'));
  const entryPath = req.resolve('@republicroad/jdm-appshell');
  const normalized = entryPath.split(path.sep).join('/');
  check(
    'entry resolves from scratch require context',
    normalized.includes('node_modules/@republicroad/jdm-appshell/dist/'),
    entryPath,
  );

  try {
    const mod = await import(pathToFileURL(entryPath).href);
    const runtimeKeys = [
      'EditorShellProvider',
      'useEditorShell',
      'applyNodeOverrides',
      'ThemeContextProvider',
      'ThemePreference',
    ];
    const missingRuntime = runtimeKeys.filter((k) => !(k in mod));
    check(
      'full barrel evaluates under node + carries runtime exports',
      missingRuntime.length === 0,
      missingRuntime.length ? `missing: ${missingRuntime.join(', ')}` : `${Object.keys(mod).length} exports`,
    );
  } catch (err) {
    // 浏览器产物在 node 求值依赖内核全 barrel 的 node 兼容性——记 WARN 不 FAIL
    results.push(`WARN full-barrel node evaluation unavailable  -- ${String(err).slice(0, 160)}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
  for (const f of readdirSync(pkgDir).filter((f) => f.endsWith('.tgz'))) {
    rmSync(path.join(pkgDir, f), { force: true });
  }
}

console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n[npm-smoke] ${results.length - fails}/${results.length} checks passed`);
process.exit(fails ? 1 : 0);
