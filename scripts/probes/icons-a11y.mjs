import { createReporter, storyUrl, withPage } from './helpers.mjs';

/**
 * Icon sizing + a11y contracts: reui icons render at their utility sizes
 * (10-12px, never the 24px svg default), the superscript info pattern is in
 * place, and simulator request source items are keyboard operable.
 */

export async function runIconA11yProbes() {
  const { check, report } = createReporter();
  await withPage(async (page) => {
    // superscript info icon on the request panel toolbar
    await page.goto(storyUrl('decision-graph-simulator-request-panel--with-input-binding'), {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(5000);
    const infoSvg = page.locator('span.align-super svg').first();
    const infoCount = await page.locator('span.align-super svg').count();
    const infoBox = infoCount ? await infoSvg.boundingBox() : null;
    check('info icon present (align-super pattern)', infoCount >= 1, `count=${infoCount}`);
    check('info icon <= 12px', infoBox && infoBox.width <= 12, infoBox ? `${Math.round(infoBox.width)}px` : 'n/a');

    // keyboard operability of source items
    const sourceItems = page.locator('[role="button"][aria-pressed]').filter({ hasText: 'US Light' });
    const srcCount = await sourceItems.count();
    const tabIndex = srcCount ? await sourceItems.first().getAttribute('tabindex') : null;
    check('source item is a focusable button', srcCount >= 1 && tabIndex === '0', `tabindex=${tabIndex}`);
    await page.locator('[role="button"][aria-pressed]').first().focus();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const pressedCount = await page.locator('[role="button"][aria-pressed="true"]').count();
    check('Enter selects the focused source', pressedCount >= 1);
    await page.screenshot({ path: 'node_modules/.cache/probe-icons-a11y.png' });

    // TabRequest schema tab info icon
    await page.goto(storyUrl('decision-graph--simulator'), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.react-flow', { timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.locator('.react-flow__node').filter({ hasText: 'Request' }).first().click();
    await page.waitForTimeout(1000);
    await page
      .getByRole('button', { name: /Configure/i })
      .first()
      .click();
    await page.waitForTimeout(2000);
    const schemaInfo = page
      .locator('.ant-tabs-tab, [role="tab"]')
      .filter({ hasText: 'Schema' })
      .locator('span.align-super svg');
    const schemaInfoCount = await schemaInfo.count();
    const sBox = schemaInfoCount ? await schemaInfo.first().boundingBox() : null;
    check('TabRequest Schema tab info icon', schemaInfoCount >= 1, `count=${schemaInfoCount}`);
    check('TabRequest Schema tab icon <= 12px', sBox && sBox.width <= 12, sBox ? `${Math.round(sBox.width)}px` : 'n/a');
  });
  return report();
}
