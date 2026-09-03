import { chromium } from 'playwright';

/**
 * Shared harness for the probe suite. Probes are smoke checks against a
 * SERVED storybook build (static docs/) — they are not unit tests and need
 * a real browser. Default base: http://127.0.0.1:9010 (see run-probes.mjs).
 */

export const BASE = process.env.PROBES_BASE ?? 'http://127.0.0.1:9010';

export const storyUrl = (id) => `${BASE}/iframe.html?id=${id}&viewMode=story`;

export function createReporter() {
  const results = [];
  return {
    check(name, ok, detail = '') {
      results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);
    },
    report() {
      console.log(results.join('\n'));
      const fails = results.filter((r) => r.startsWith('FAIL')).length;
      console.log(`\n${results.length - fails}/${results.length} checks passed`);
      return fails;
    },
  };
}

export async function withPage(fn) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(20000);
  try {
    await fn(page);
  } finally {
    await browser.close();
  }
}
