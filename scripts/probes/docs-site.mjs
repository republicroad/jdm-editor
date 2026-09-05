import { chromium } from 'playwright';

const BASE = process.env.PROBES_BASE || 'http://127.0.0.1:9010/docs';
const baseOrigin = new URL(BASE).origin;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];
  const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);

  let foreignRequests = [];
  let failedResponses = [];
  let wasmStatus = null;
  const consoleErrors = [];

  page.on('request', (req) => {
    const u = new URL(req.url());
    const isLocalForeign = (u.hostname === '127.0.0.1' || u.hostname === 'localhost') && u.origin !== baseOrigin;
    if (isLocalForeign) foreignRequests.push(req.url());
  });
  page.on('response', (res) => {
    const u = res.url();
    if (u.includes('zen_engine_wasm_bg.wasm')) wasmStatus = res.status();
    if (res.status() >= 400) failedResponses.push(`${res.status()} ${u.slice(0, 140)}`);
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err).slice(0, 300)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300));
  });

  await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(8000);

  const flow = await page.locator('.react-flow').count();
  const lazyLoaded = await page.evaluate(() => Boolean(document.querySelector('[data-testid="docs-live-demo"]')));
  check('lazy demo chunk mounted (testId present)', lazyLoaded, `react-flow=${flow}`);
  check('live DecisionGraph mounts inside demo', flow >= 1, `count=${flow}`);
  check('theme island present', await page.evaluate(() => Boolean(document.querySelector('[class*="grl"]'))));
  check('nav/sidebar rendered', await page.evaluate(() => (document.body.innerText || '').includes('Architecture')));
  check('no foreign localhost probes', foreignRequests.length === 0, foreignRequests.join(',').slice(0, 140));
  check('no failed resources', failedResponses.length === 0, failedResponses.join(' | ').slice(0, 200));
  check('wasm OK (200 or not fetched)', wasmStatus === null || wasmStatus === 200, `status=${wasmStatus}`);
  if (consoleErrors.length) check('console errors', false, consoleErrors.slice(0, 3).join(' | ').slice(0, 300));

  await page.screenshot({ path: 'node_modules/.cache/probe-docs-site.png' });
  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('NAV:', e.message.slice(0, 300));
  process.exit(1);
});
