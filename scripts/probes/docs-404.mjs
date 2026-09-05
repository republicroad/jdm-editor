import { chromium } from 'playwright';

const BASE = process.env.PROBES_BASE || 'http://127.0.0.1:9011/docs';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const failed = [];
  page.on('response', (res) => {
    if (res.status() >= 400) failed.push(`${res.status()} ${res.url().slice(-90)}`);
  });

  await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);
  failed.forEach((f) => console.log('404:', f));
  console.log('---');
  console.log('url:', page.url());
  await browser.close();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
