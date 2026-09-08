/**
 * Dual-host consumer smoke for @republicroad/jdm-editor.
 *
 * Proves the published artifact works when consumed the way real hosts do:
 *   pnpm add <tarball>   (+ its dependencies & peers)
 * built with Vite and rendered under BOTH supported React majors (18 / 19),
 * per the library's peer contract `react >= 18`.
 *
 * Usage:  pnpm test:consumer            (requires `pnpm build` first)
 * Flags:  --keep   keep temp workspace for debugging
 */
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

const KEEP = process.argv.includes('--keep');
const REPO_ROOT = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const LIB_DIR = path.join(REPO_ROOT, 'packages', 'jdm-editor');
const DIST_DIR = path.join(LIB_DIR, 'dist');

if (!existsSync(path.join(DIST_DIR, 'index.js'))) {
  console.error('[smoke] dist missing — run `pnpm build` first.');
  process.exit(1);
}

const HOSTS = [
  { label: 'react18', react: '18.3.1', typesMajor: '^18' },
  { label: 'react19', react: '19.2.8', typesMajor: '^19' },
];

const require = createRequire(REPO_ROOT + '/package.json');
const { chromium } = require('playwright');

// Resolve the invoking pnpm so nested installs reuse it even when the shim
// is not on PATH of the spawned shell.
const pnpmInvocation = (() => {
  const execpath = process.env.npm_execpath;
  if (execpath && /pnpm/.test(execpath)) {
    return { cmd: process.execPath, prefix: [execpath] };
  }
  return { cmd: 'pnpm', prefix: [] };
})();

const run = (cmd, args, cwd) =>
  execFileSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // shell only needed for PATH-resolved shims; direct node.exe invocations must not
    // go through a shell or unquoted "Program Files" paths break.
    shell: cmd === 'pnpm',
  });

const runPnpm = (args, cwd) => {
  try {
    return run(pnpmInvocation.cmd, [...pnpmInvocation.prefix, ...args], cwd);
  } catch (e) {
    const out = [e.stdout, e.stderr]
      .filter(Boolean)
      .map((b) => b.toString())
      .join('\n');
    console.error(`[smoke] pnpm ${args.join(' ')} failed:\n${out.slice(-2000)}`);
    throw e;
  }
};

const freePort = () =>
  new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
  });

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
};

const serve = async (dir) => {
  const port = await freePort();
  const server = createServer(async (req, res) => {
    try {
      let p = req.url.split('?')[0];
      if (p.endsWith('/')) p += 'index.html';
      const body = readFileSync(path.join(dir, p));
      res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${port}/`, close: () => new Promise((r) => server.close(r)) };
};

const INDEX_HTML = `<!doctype html><html><head><meta charset="utf-8"/></head>
<body style="margin:0"><div id="app" style="height:100vh"></div><script type="module" src="./main.js"></script></body></html>`;

const MAIN_JS = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { DecisionGraph } from '@republicroad/jdm-editor';
import '@republicroad/jdm-editor/dist/style.css';

createRoot(document.getElementById('app')).render(
  React.createElement(DecisionGraph, { value: { nodes: [], edges: [] }, onChange: () => {} }),
);`;

// roadmap 3.1: single-surface measuring host — imports ONLY DecisionTable to
// quantify the per-surface payload of the tree-shaken host bundle.
const TABLE_MAIN_JS = `import React from 'react';
import { createRoot } from 'react-dom/client';
import { DecisionTable } from '@republicroad/jdm-editor';
import '@republicroad/jdm-editor/dist/style.css';

createRoot(document.getElementById('app')).render(
  React.createElement(DecisionTable, {
    tableHeight: '100%',
    value: undefined,
    onChange: () => {},
  }),
);`;

const results = [];
const workspace = mkdtempSync(path.join(os.tmpdir(), 'jdm-consumer-smoke-'));

try {
  const browser = await chromium.launch();

  // Pack the kernel into a tarball so `catalog:` specifiers are substituted with
  // real versions before the consumer sees them.
  const kernelPkg = JSON.parse(readFileSync(path.join(LIB_DIR, 'package.json'), 'utf8'));
  runPnpm(['pack'], LIB_DIR);
  const kernelTarball = path.join(LIB_DIR, `republicroad-jdm-editor-${kernelPkg.version}.tgz`);

  for (const host of HOSTS) {
    const dir = path.join(workspace, host.label);
    mkdirSync(dir, { recursive: true });
    const pkg = { name: host.label, private: true, type: 'module' };
    writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
    writeFileSync(path.join(dir, 'index.html'), INDEX_HTML);
    writeFileSync(path.join(dir, 'main.js'), host.main ?? MAIN_JS);

    console.log(`[smoke] ${host.label}: installing react ${host.react} + library…`);
    runPnpm(['add', `react@${host.react}`, `react-dom@${host.react}`], dir);
    runPnpm(['add', '-D', 'vite'], dir);
    runPnpm(['add', kernelTarball], dir);

    console.log(`[smoke] ${host.label}: building host app…`);
    runPnpm(['exec', 'vite', 'build'], dir);

    const server = await serve(path.join(dir, 'dist'));
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 160));
    });

    await page.goto(server.url, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(5000);
    const state = await page.evaluate(() => ({
      reactFlow: !!document.querySelector('.react-flow'),
      svgs: document.querySelectorAll('svg').length,
    }));
    await page.close();
    await server.close();

    const ok = state.reactFlow && state.svgs > 0 && errors.length === 0;
    results.push({ host: host.label, ok, ...state, errors: errors.slice(0, 3) });
    console.log(
      `[smoke] ${host.label}: ${ok ? 'PASS' : 'FAIL'} ${JSON.stringify(state)}${errors.length ? ` errors=${JSON.stringify(errors.slice(0, 3))}` : ''}`,
    );
  }

  // Single-surface measuring host (roadmap 3.1): build a DecisionTable-only
  // host and report the emitted bundle bytes — quantifies per-surface payload
  // after tree shaking. No browser pass needed; a successful build suffices.
  {
    const label = MEASURE_HOST.label;
    const dir = path.join(workspace, label);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, 'package.json'),
      JSON.stringify({ name: label, private: true, type: 'module' }, null, 2),
    );
    writeFileSync(path.join(dir, 'index.html'), INDEX_HTML);
    writeFileSync(path.join(dir, 'main.js'), TABLE_MAIN_JS);

    console.log(`[smoke] ${label}: installing react ${MEASURE_HOST.react} + library…`);
    runPnpm(['add', `react@${MEASURE_HOST.react}`, `react-dom@${MEASURE_HOST.react}`], dir);
    runPnpm(['add', '-D', 'vite'], dir);
    runPnpm(['add', kernelTarball], dir);

    console.log(`[smoke] ${label}: building host app…`);
    runPnpm(['exec', 'vite', 'build'], dir);

    const assets = readdirSync(path.join(dir, 'dist'))
      .filter((f) => /\.js$/.test(f))
      .map((f) => ({ file: f, bytes: statSync(path.join(dir, 'dist', f)).size }))
      .sort((a, b) => b.bytes - a.bytes);
    const totalJs = assets.reduce((n, a) => n + a.bytes, 0);
    console.log(`[smoke] ${label}: PASS ${JSON.stringify({ totalJsBytes: totalJs, assets })}`);
    results.push({ host: label, ok: true, totalJsBytes: totalJs });
  }

  await browser.close();
} finally {
  if (KEEP) {
    console.log(`[smoke] workspace kept at ${workspace}`);
  } else {
    rmSync(workspace, { recursive: true, force: true });
  }
}

if (results.some((r) => !r.ok)) {
  console.error('[smoke] FAILED');
  process.exit(1);
}
console.log('[smoke] all hosts PASS');
