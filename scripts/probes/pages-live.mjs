import { chromium } from 'playwright';

const BASE = process.env.PROBES_BASE || 'http://127.0.0.1:9010';
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

  // 1. ExpressionBuilder story (stayed pending on the previous deploy)
  await page.goto(`${BASE}/iframe.html?id=expressionbuilder--string-type&viewMode=story&t=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(8000);
  check(
    'expressionbuilder: content rendered',
    (await page.evaluate(() => (document.body.innerText || '').length)) > 20,
  );
  check(
    'expressionbuilder: no failed resources',
    failedResponses.length === 0,
    failedResponses.join(' | ').slice(0, 200),
  );
  check(
    'expressionbuilder: no foreign localhost probes',
    foreignRequests.length === 0,
    foreignRequests.join(',').slice(0, 140),
  );
  check('expressionbuilder: wasm OK', wasmStatus === 200 || wasmStatus === null, `status=${wasmStatus}`);
  await page.screenshot({ path: 'node_modules/.cache/live-expressionbuilder.png' });
  console.log('[partial: expressionbuilder done]');

  // 2. simulator story
  foreignRequests = [];
  failedResponses = [];
  await page.goto(`${BASE}/iframe.html?id=decision-graph--simulator&viewMode=story&t=${Date.now()}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  const canvasReady = await page
    .waitForSelector('.react-flow', { timeout: 60000 })
    .then(() => true)
    .catch(() => false);
  await page.waitForTimeout(3000);
  console.log('[simulator] failed resources:', JSON.stringify(failedResponses.slice(0, 5)));
  console.log('[simulator] foreign requests:', JSON.stringify(foreignRequests.slice(0, 3)));
  const canvas = await page.locator('.react-flow').count();
  check('simulator: canvas renders', canvasReady && canvas >= 1, `canvas=${canvas}`);
  check('simulator: no failed resources', failedResponses.length === 0, failedResponses.join(' | ').slice(0, 200));
  check(
    'simulator: no foreign localhost probes',
    foreignRequests.length === 0,
    foreignRequests.join(',').slice(0, 140),
  );
  await page.screenshot({ path: 'node_modules/.cache/pages-simulator.png' });

  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('NAV:', e.message.slice(0, 300));
  process.exit(1);
});
