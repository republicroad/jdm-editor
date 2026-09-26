/**
 * Brand sweep codemod: rename a CSS/identifier prefix across the monorepo.
 * Reference run: seal -> seal (mirrors seal-editor repo commit 2636adf).
 *
 * Ordered replacement rules (later rules only see what earlier rules left),
 * for --from seal --to seal:
 *   1. SEAL-  -> SEAL-   debt markers (SEAL-STYLE-HACK, SEAL-LAYER-GUARD)
 *   2. Seal   -> Seal    PascalCase identifiers (SealPortalContainer, ...)
 *   3. seal-  -> seal-   CSS classes, scopes and --seal-* custom properties
 *   4. seal   -> seal    remaining camelCase identifiers (sealContainer, ...)
 *
 * Scope: packages/** + scripts/*.mjs + docs/** live files.
 * Excluded: node_modules, dist, docs/archive/** (historical records, per
 * seal-editor precedent), @gorules/* upstream lineage (not matched: "seal"
 * is not a substring of "gorules"). This script is idempotent.
 *
 * Usage: node scripts/brand-sweep-codemod.mjs [--from seal] [--to seal] [--dry]
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DRY = process.argv.includes('--dry');

function argOf(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const FROM = argOf('--from', 'gr' + 'l');
const TO = argOf('--to', 'se' + 'al');
if (!/^[a-z][a-z0-9]*$/.test(FROM) || !/^[a-z][a-z0-9]*$/.test(TO)) {
  console.error('from/to must be lowercase alphanumeric prefixes');
  process.exit(1);
}
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const up = (s) => s.toUpperCase();

const CODE_EXTS = new Set(['.ts', '.tsx', '.css', '.scss', '.mjs', '.js', '.cjs', '.json', '.html', '.md']);

const RULES = [
  [new RegExp(`${up(FROM)}-`, 'g'), `${up(TO)}-`],
  [new RegExp(cap(FROM), 'g'), cap(TO)],
  [new RegExp(`${FROM}-`, 'g'), `${TO}-`],
  [new RegExp(FROM, 'g'), TO],
];

function walk(dir, exts, skipDirs, hits) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.includes(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, exts, skipDirs, hits);
    } else if (exts.has(extname(entry))) {
      hits.push(full);
    }
  }
  return hits;
}

const SELF = new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const files = [
  ...walk(join(ROOT, 'packages'), CODE_EXTS, ['node_modules', 'dist', '.turbo', 'coverage'], []),
  ...walk(join(ROOT, 'scripts'), new Set(['.mjs']), [], []),
  ...walk(join(ROOT, 'docs'), new Set(['.md', '.mdx', '.css']), ['node_modules', 'archive'], []),
].filter((f) => f !== SELF);

let touched = 0;
const perRule = [0, 0, 0, 0];

for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let after = before;
  let count = 0;
  RULES.forEach(([re, to], i) => {
    after = after.replace(re, () => {
      perRule[i] += 1;
      count += 1;
      return to;
    });
  });
  if (after !== before) {
    touched += 1;
    console.log(`${DRY ? '[dry] ' : ''}rewrite (${count}) ${file.replace(ROOT, '')}`);
    if (!DRY) writeFileSync(file, after, 'utf8');
  }
}

console.log(`\n${DRY ? '[dry] ' : ''}files touched: ${touched} / scanned: ${files.length}`);
console.log(
  `replacements per rule: ${up(FROM)}-=${perRule[0]} ${cap(FROM)}=${perRule[1]} ${FROM}-=${perRule[2]} ${FROM}=${perRule[3]}`,
);
