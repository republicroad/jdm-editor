import { createReporter, storyUrl, withPage } from './helpers.mjs';

/**
 * Request (input) node surface: simulator request panel with a bound
 * example source, and the TabRequest three-view tab via Configure.
 */

export async function runRequestNodeProbes() {
  const { check, report } = createReporter();
  await withPage(async (page) => {
    // 1. simulator request panel (bound example sources)
    await page.goto(storyUrl('decision-graph-simulator-request-panel--with-input-binding'), {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(5000);
    const reqLabel = await page
      .locator('span,div')
      .filter({ hasText: /^Request$/ })
      .count();
    check('request-panel: toolbar label', reqLabel >= 1, `count=${reqLabel}`);
    const monaco = await page.locator('.monaco-editor').count();
    check('request-panel: editor mounted', monaco >= 1, `count=${monaco}`);
    const binding = (await page.locator('.ant-select, [class*="select"]').count()) > 0;
    check('request-panel: source select present', binding);
    await page.screenshot({ path: 'node_modules/.cache/probe-request-panel.png' });

    // 2. full graph simulator: run + open the decision table node
    await page.goto(storyUrl('decision-graph--simulator'), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.react-flow', { timeout: 30000 });
    await page.waitForTimeout(2500);

    // mock the remote engine so the probe is deterministic/offline
    await page.route('**/api/simulate', (route) =>
      route.fulfill({
        json: {
          performance: '1ms',
          result: { shippingFee: 40 },
          trace: {
            '359173d8-0068-45f8-bb71-8240ad73201d': {
              id: '359173d8-0068-45f8-bb71-8240ad73201d',
              name: 'decisionTableNode 1',
              type: 'decisionTableNode',
              order: 1,
              performance: '0.5ms',
              input: { customer: { country: 'US' }, cart: { weight: 50 } },
              output: { shippingFee: 40 },
              traceData: [{ rule: { _id: 'qMpJEvcau6' }, indexes: [0, 1] }],
            },
          },
        },
      }),
    );

    const toolbar = page
      .locator('div.flex.items-center')
      .filter({ has: page.getByText('Request', { exact: true }) })
      .first();
    await toolbar.locator('button').last().click();
    await page.waitForTimeout(2000);
    const traceRow = await page.getByText('decisionTableNode 1').count();
    check('simulator: trace row appears after run', traceRow >= 1, `count=${traceRow}`);

    // 3. input node -> Configure -> TabRequest three tabs
    await page.locator('.react-flow__node').filter({ hasText: 'Request' }).first().click();
    await page.waitForTimeout(1000);
    await page
      .getByRole('button', { name: /Configure/i })
      .first()
      .click();
    await page.waitForTimeout(2000);
    for (const label of ['Definitions', 'Data', 'Schema']) {
      const tab = await page.locator('.ant-tabs-tab, [role="tab"]').filter({ hasText: label }).count();
      check(`TabRequest: ${label} tab`, tab >= 1, `count=${tab}`);
    }
    const addField = await page.getByText('Add field', { exact: true }).count();
    check('TabRequest: Add field button', addField >= 1, `count=${addField}`);
    const gridHeader = await page.getByText('Default value', { exact: true }).count();
    check('TabRequest: definitions grid header', gridHeader >= 1, `count=${gridHeader}`);
    await page.screenshot({ path: 'node_modules/.cache/probe-tab-request.png' });
  });
  return report();
}
