import { chromium } from 'playwright';

const BASE = process.env.PROBES_BASE || 'http://127.0.0.1:3000/docs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push('PAGEERROR: ' + String(err).slice(0, 500)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text().slice(0, 400));
  });

  await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(8000);
  console.log('url:', page.url());
  console.log('body len:', await page.evaluate(() => document.body.innerText.length));
  const flow = await page.locator('.react-flow').count();
  console.log('react-flow:', flow);
  console.log('--- errors ---');
  errors.slice(0, 6).forEach((e) => console.log(e));
  await page.screenshot({ path: 'dev-docs-debug.png' });
  await browser.close();
})().catch((e) => {
  console.error(e.message.slice(0, 200));
  process.exit(1);
});
