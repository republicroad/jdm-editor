import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Serves the built storybook (docs/) on :9010 and runs every probe against
 * it. Requires `pnpm --filter @republicroad/jdm-editor build:storybook` (or a
 * previous test:storybook run) to have produced docs/index.html.
 *
 * Usage: pnpm test:probes [probeName ...]
 * Not part of `pnpm verify` — run before releases or after UI-touching work.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'packages', 'jdm-editor', 'docs');
const PORT = process.env.PROBES_PORT ?? '9010';
const BASE = `http://127.0.0.1:${PORT}`;

const filterArgs = process.argv.slice(2);

if (!existsSync(path.join(docsDir, 'index.html'))) {
  console.error(
    '[probes] docs/index.html not found — run `pnpm --filter @republicroad/jdm-editor build:storybook` first.',
  );
  process.exit(1);
}

mkdirSync(path.join(root, 'node_modules', '.cache'), { recursive: true });

const httpServerBin = path.join(
  root,
  'packages',
  'jdm-editor',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'http-server.cmd' : 'http-server',
);

const server = spawn(httpServerBin, [docsDir, '-p', PORT, '--silent'], {
  shell: process.platform === 'win32',
  stdio: 'ignore',
});

async function waitForServer() {
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(`${BASE}/index.html`);
      if (res.ok) return true;
    } catch {
      /* retry */
    }
  }
  return false;
}

const allProbes = [
  ['request-node', 'request-node.mjs'],
  ['dt-highlight', 'dt-highlight.mjs'],
  ['a11y', 'icons-a11y.mjs'],
  ['cf-drag-keyboard', 'cf-drag-keyboard.mjs'],
];

const selected = filterArgs.length ? allProbes.filter(([name]) => filterArgs.some((f) => name.includes(f))) : allProbes;

if (selected.length === 0) {
  console.error(`[probes] no probe matches: ${filterArgs.join(', ')}`);
  process.exit(1);
}

try {
  const up = await waitForServer();
  if (!up) {
    console.error('[probes] static server did not come up');
    process.exit(1);
  }
  console.log(`[probes] serving ${BASE}\n`);

  let totalFails = 0;
  for (const [name, file] of selected) {
    console.log(`── probe: ${name} ─────────────────────────`);
    const res = spawnSync(process.execPath, [path.join(root, 'scripts', 'probes', file)], {
      encoding: 'utf8',
      env: { ...process.env, PROBES_BASE: BASE },
    });
    process.stdout.write(res.stdout ?? '');
    if (res.stderr) process.stderr.write(res.stderr.slice(0, 600));
    const passed = res.status === 0;
    if (!passed) totalFails += 1;
    console.log(`→ ${name}: ${passed ? 'PASS' : 'FAIL'}\n`);
  }

  console.log(`[probes] ${totalFails === 0 ? 'ALL PROBES PASSED' : `${totalFails}/${selected.length} probes FAILED`}`);
  process.exitCode = totalFails ? 1 : 0;
} finally {
  if (server.pid) {
    spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F'], { shell: true, stdio: 'ignore' });
  }
  rmSync(path.join(root, 'node_modules', '.cache'), { recursive: true, force: true });
}
