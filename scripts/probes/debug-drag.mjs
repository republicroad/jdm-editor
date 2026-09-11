import { chromium } from 'playwright';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + String(e).slice(0, 300)));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300));
});
await page.goto('http://127.0.0.1:9010/iframe.html?id=custom-function-table--with-rows&viewMode=story', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForTimeout(5000);

const rows = () => page.locator('.expression-list-item').count();
console.log('rows before:', await rows());

const handle = page.locator('.expression-list-item__drag').first();
await handle.focus();
await page.keyboard.press('Space');
await page.waitForTimeout(300);
console.log('after pickup: rows =', await rows(), '| errors =', errors.length);

await page.keyboard.press('ArrowDown');
await page.waitForTimeout(400);
console.log('after ArrowDown: rows =', await rows(), '| errors =', errors.length, '|', errors[0] ?? '');

await page.keyboard.press('Space');
await page.waitForTimeout(800);
console.log('after drop: rows =', await rows(), '| errors =', errors.length, '|', errors[errors.length - 1] ?? '');
console.log('keys:', (await page.locator('.expression-list-item__key [contenteditable="true"]').all()).length);

await browser.close();
