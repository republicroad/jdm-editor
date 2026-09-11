import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 200)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200));
});
await page.goto('http://127.0.0.1:9010/iframe.html?id=custom-function-table--with-rows&viewMode=story', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
for (const ms of [8000, 16000, 24000, 32000, 40000]) {
  await page.waitForTimeout(8000);
  const drag = page.locator('.expression-list-item__drag').first();
  const count = await page.locator('.expression-list-item__drag').count();
  let vis = null;
  let box = null;
  if (count > 0) {
    vis = await drag.isVisible().catch((e) => 'err:' + String(e).slice(0, 40));
    box = await drag.boundingBox().catch(() => 'bbox-err');
  }
  console.log(`T+${ms}: count=${count} visible=${vis} box=${JSON.stringify(box)}`);
}
console.log('ERRORS:', JSON.stringify(errors.slice(0, 5)));
await page.screenshot({ path: 'C:/Users/xiaoan440G10/AppData/Local/Temp/sb-debug.png' });
await browser.close();
