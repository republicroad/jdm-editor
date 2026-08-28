/*
 * Style-debt budget guard (roadmap §P4 / shadcn-theming-roadmap.zh-CN.md).
 *
 * Counts two families of styling debt inside @gorule/jdm-editor sources:
 *   1. `!important` declarations           — cascade-warfare artifacts
 *   2. raw hex colors OUTSIDE the token whitelist — palette leaks
 *
 * Both must never GROW. Exceeding the recorded budget fails the run;
 * burning debt down is encouraged — lower the constants when you do.
 *
 * Registry context: docs/shadcn-theming-roadmap.zh-CN.md Appendix A,
 * searchable source markers via `rg 'GRL-STYLE-HACK' src`.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../packages/jdm-editor/src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

/** Baselines recorded 2026-08 after Batch D phase-1 of the theming roadmap
 * (CM skin migrated to EditorView.theme; !important count nearly halved).
 * Hex budget zero: new palette literals must enter theme.tsx/tokens.css. */
const BUDGET = {
  important: 18,
  hex: 0,
};

/* Token/palette truth-sources and sandbox demos are exempt from hex counting.
 * zen.ts / diagnostic.tsx / function-debugger-log.tsx / ce-preview.tsx carry the
 * CodeMirror & Monaco syntax palettes — they join the derivation channel in P0. */
const HEX_WHITELIST =
  /theme\.tsx$|tokens\.css$|extensions[\\/]zen\.ts$|extensions[\\/]diagnostic\.tsx$|function-debugger-log\.tsx$|ce-preview\.tsx$|stories\.tsx$|theming[\\/]presets\.ts$|theming[\\/]compute\.ts$|theming[\\/]derive\.ts$|theming[\\/].*test\.tsx?$/;

const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) yield* walk(full);
    else if (/\.(css|tsx|ts)$/.test(entry)) yield full;
  }
}

let important = 0;
let hex = 0;
const hexHits = [];

for (const file of walk(SRC)) {
  let text = readFileSync(file, 'utf8');
  // Inline var(..., #fallback) defaults are consumed next to their definition
  // point and keep single-source truth in tokens.css / theme.tsx — not leaks.
  text = text.replace(/var\([^()]*\)/g, 'VAR()');
  // Comments may narrate past debt (GRL-STYLE-HACK banners) — never counted.
  text = text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|\s)\/\/[^\n]*/g, ' ');
  important += (text.match(/!important/g) ?? []).length;

  if (!HEX_WHITELIST.test(file)) {
    let m;
    while ((m = HEX_RE.exec(text))) {
      // skip %23-encoded svg data URIs remnants that decode into a literal '#'
      if (m[0].toLowerCase() === '#fff' || m[0].toLowerCase() === '#ffffff') {
        /* still counted — white literals outside tokens are debt too (HK-09) */
      }
      hex += 1;
      hexHits.push(`${file.replace(SRC, '')}: ${m[0]}`);
    }
  }
}

const overImportant = important > BUDGET.important;
const overHex = hex > BUDGET.hex;

console.log(`style-debt: !important ${important}/${BUDGET.important} · raw-hex(non-whitelist) ${hex}/${BUDGET.hex}`);

if (overImportant || overHex) {
  if (overHex) console.log(hexHits.join('\n'));
  console.error(
    `\nBUDGET EXCEEDED${overImportant ? ' [!important]' : ''}${overHex ? ' [hex]' : ''}.` +
      '\nNew debt requires an explicit GRL-STYLE-HACK marker + registry row; fix or raise the budget consciously.',
  );
  process.exit(1);
}
