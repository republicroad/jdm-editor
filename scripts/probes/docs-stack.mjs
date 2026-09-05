import { chromium } from 'playwright';

const BASE = process.env.PROBES_BASE || 'http://localhost:3003/jdm-editor/docs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (err) => {
    const stack = (err.stack || String(err)).split('\n').slice(0, 6).join('\n');
    errors.push(stack);
  });

  await page.goto(`${BASE}/index.html?t=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(6000);
  console.log('--- page errors (full stack) ---');
  errors.forEach((e) => console.log(e + '\n'));
  await browser.close();
})().catch((e) => {
  console.error(e.message.slice(0, 200));
  process.exit(1);
});
