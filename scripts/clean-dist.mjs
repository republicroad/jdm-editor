/**
 * Removes declaration side-products that vite-plugin-dts@5 (unplugin-dts) emits
 * alongside the rolled-up entry files. Only artifacts referenced by package.json
 * `files`/exports survive.
 *
 * Usage: node clean-dist.mjs [distDir]   (defaults to <repo>/packages/jdm-editor/dist)
 */
import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const dist = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(repoRoot, 'packages', 'jdm-editor', 'dist');

if (!existsSync(dist)) {
  console.error('[clean-dist] dist not found:', dist);
  process.exit(1);
}

const KEEP = new Set([
  'index.js', 'index.js.map', 'index.d.ts', 'index.d.ts.map',
  'schema.js', 'schema.js.map', 'schema.d.ts', 'schema.d.ts.map',
  'style.css',
]);

for (const entry of readdirSync(dist)) {
  if (!KEEP.has(entry)) {
    rmSync(path.join(dist, entry), { recursive: true, force: true });
  }
}
console.log('[clean-dist] kept:', [...KEEP].join(', '));
