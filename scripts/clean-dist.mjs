/**
 * Removes declaration side-products that vite-plugin-dts@5 (unplugin-dts) emits
 * alongside the rolled-up entry files. Keeps all JS/CSS output (including
 * code-split chunks) so the published dist is self-contained.
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

/* Keep everything Vite/Rollup emits as functional output (JS, CSS, sourcemaps).
 * Only remove non-functional artifacts (e.g. unbundled .d.ts entry stubs from
 * vite-plugin-dts that are superseded by the bundled index.d.ts). */
const isOutput = (name) =>
  /\.js$/.test(name) || /\.js\.map$/.test(name) || /\.css$/.test(name) || /^index\.d\.ts(\.map)?$/.test(name);

for (const entry of readdirSync(dist)) {
  if (!isOutput(entry)) {
    rmSync(path.join(dist, entry), { recursive: true, force: true });
  }
}
console.log('[clean-dist] kept functional output, removed non-JS/CSS side-products');
