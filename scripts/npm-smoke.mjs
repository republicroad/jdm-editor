import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * npm-install smoke for the published artifact shape.
 *
 * Packs the local package, installs the tarball into a scratch
 * directory and asserts the published contract: entry files, exports
 * map, bundled declarations carrying the public API, and the schema
 * subpath resolving under plain Node ESM.
 *
 * Usage:
 *   pnpm test:npm-smoke                 (packs the LOCAL build; needs `pnpm build` first)
 *   pnpm test:npm-smoke 0.3.0           (installs the published version from the registry)
 * Not part of `pnpm verify` — run before/after releases.
 */

const registryVersion = process.argv[2] && /^\d+\.\d+\.\d+/.test(process.argv[2]) ? process.argv[2] : null;

const root = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const pkgDir = path.join(root, 'packages', 'jdm-editor');
const dist = path.join(pkgDir, 'dist');

if (!registryVersion && !existsSync(path.join(dist, 'index.js'))) {
  console.error(
    '[npm-smoke] dist not found — run `pnpm build` first (or pass a registry version, e.g. `pnpm test:npm-smoke 0.3.0`).',
  );
  process.exit(1);
}

const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
};

const scratch = path.join(os.tmpdir(), `jdm-npm-smoke-${Date.now()}`);
mkdirSync(scratch, { recursive: true });

try {
  let tarball = null;
  let installSpec = `@republicroad/jdm-editor@${registryVersion}`;

  if (registryVersion) {
    check(`registry version ${registryVersion} requested`, true, 'installing from registry');
  } else {
    // 1. pack the package
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
    tarball = path.join(pkgDir, tarballName);
    const sizeKb = Math.round(statSync(tarball).size / 1024);
    check('tarball packed', existsSync(tarball), `${tarballName} ${sizeKb}kB`);
    installSpec = tarball;
  }

  // 2. install it into the scratch dir (monaco-editor is a peerDependency —
  // hosts install it explicitly, so the smoke mirrors that contract)
  const install = spawnSync(
    'npm',
    [
      'install',
      installSpec,
      'monaco-editor@^0.52.2',
      '--no-audit',
      '--no-fund',
      '--ignore-scripts',
      '--registry=https://registry.npmjs.org',
    ],
    {
      cwd: scratch,
      encoding: 'utf8',
      shell: process.platform === 'win32',
    },
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

  const installedDir = path.join(scratch, 'node_modules', '@republicroad', 'jdm-editor');
  const installedPkg = JSON.parse(readFileSync(path.join(installedDir, 'package.json'), 'utf8'));

  // 3. published contract assertions
  check('name matches @republicroad/jdm-editor', installedPkg.name === '@republicroad/jdm-editor', installedPkg.name);
  check(
    'installed version matches expectation',
    !registryVersion || installedPkg.version === registryVersion,
    installedPkg.version,
  );
  check('publishConfig.access is public', installedPkg.publishConfig?.access === 'public');
  check(
    'monaco-editor declared as peer',
    Boolean(installedPkg.peerDependencies?.['monaco-editor']),
    installedPkg.peerDependencies?.['monaco-editor'] ?? 'absent',
  );

  for (const file of ['dist/index.js', 'dist/index.d.ts', 'dist/style.css', 'dist/schema.js', 'LICENSE', 'README.md']) {
    check(`artifact present: ${file}`, existsSync(path.join(installedDir, file)));
  }

  const exportKeys = Object.keys(installedPkg.exports ?? {});
  check(
    'exports map covers entry, schema and css',
    ['.', './dist/schema', './dist/style.css'].every((k) => exportKeys.includes(k)),
    exportKeys.join(', '),
  );

  const dts = readFileSync(path.join(installedDir, 'dist', 'index.d.ts'), 'utf8');
  const mustExport = [
    'TabRequest',
    'getRequestDefinitions',
    'useSimulatorAutoSync',
    'jsonSchemaToVariableType',
    'JdmConfigProvider',
    'useT',
  ];
  const missing = mustExport.filter((name) => !dts.includes(name));
  check(
    'bundled declarations carry the public API',
    missing.length === 0,
    missing.length ? `missing: ${missing.join(', ')}` : `${mustExport.length} symbols`,
  );

  // 4. schema subpath resolves under plain node ESM
  const req = createRequire(import.meta.url);
  const schemaPath = req.resolve(path.join(installedDir, 'dist', 'schema.js'));
  const schemaModule = await import(pathToFileURL(schemaPath).href);
  check(
    'schema subpath imports',
    typeof schemaModule === 'object' && Object.keys(schemaModule).length > 0,
    `${Object.keys(schemaModule).length} exports`,
  );
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
