import { chromium } from 'playwright';

const BASE = process.env.PROBES_BASE || 'http://127.0.0.1:9015/jdm-editor/docs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + String(err).slice(0, 400)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text().slice(0, 400));
  });

  await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(8000);

  const html = await page.content();
  console.log('docs-live-demo:', html.includes('docs-live-demo'));
  console.log('react-flow:', (html.match(/react-flow/g) || []).length);
  console.log('body len:', await page.evaluate(() => document.body.innerText.length));
  console.log('--- errors ---');
  errors.slice(0, 6).forEach((e) => console.log(e));
  await page.screenshot({ path: 'docs-site-debug.png' });
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
