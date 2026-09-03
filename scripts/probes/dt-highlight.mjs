import { createReporter, storyUrl, withPage } from './helpers.mjs';

/**
 * Decision table simulation highlight: the matched rule row must show the
 * success background THROUGH the CodeMirror editors (regression guard for
 * the ZEN_SKIN opaque-background fix) and the status dot icons must stay at
 * 12px so row text never wraps.
 */

const DT_ID = '359173d8-0068-45f8-bb71-8240ad73201d';
const MOCK = {
  performance: '1ms',
  result: { shippingFee: 40 },
  trace: {
    [DT_ID]: {
      id: DT_ID,
      name: 'decisionTableNode 1',
      type: 'decisionTableNode',
      order: 1,
      performance: '0.5ms',
      input: { customer: { country: 'US' }, cart: { weight: 50 } },
      output: { shippingFee: 40 },
      traceData: [{ rule: { _id: 'qMpJEvcau6' }, indexes: [0, 1] }],
    },
  },
};

export async function runDtHighlightProbes() {
  const { check, report } = createReporter();
  await withPage(async (page) => {
    await page.route('**/api/simulate', (route) => route.fulfill({ json: MOCK }));
    await page.goto(storyUrl('decision-graph--simulator'), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.react-flow', { timeout: 30000 });
    await page.waitForTimeout(2500);

    const toolbar = page
      .locator('div.flex.items-center')
      .filter({ has: page.getByText('Request', { exact: true }) })
      .first();
    await toolbar.locator('button').last().click();
    await page.waitForTimeout(2000);

    await page.locator('.react-flow__node').filter({ hasText: 'decisionTableNode 1' }).first().click();
    await page.waitForTimeout(800);
    await page
      .locator('.react-flow__node')
      .filter({ hasText: 'decisionTableNode 1' })
      .first()
      .getByRole('button', { name: /Edit Table/i })
      .first()
      .click();
    await page.waitForTimeout(2500);

    const rowInfo = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tr'));
      const info = { activeRows: 0, cmInActive: 0, cmTransparent: 0, others: [] };
      for (const tr of rows) {
        const trBg = getComputedStyle(tr).backgroundColor;
        if (trBg && trBg !== 'rgba(0, 0, 0, 0)') {
          info.activeRows += 1;
          const cms = tr.querySelectorAll('.cm-editor');
          info.cmInActive += cms.length;
          for (const cm of cms) {
            const bg = getComputedStyle(cm).backgroundColor;
            if (bg === 'rgba(0, 0, 0, 0)') info.cmTransparent += 1;
            else info.others.push(bg);
          }
        }
      }
      return info;
    });
    check('dt: matched rule row highlighted', rowInfo.activeRows >= 1, `activeRows=${rowInfo.activeRows}`);
    check('dt: matched row contains cm editors', rowInfo.cmInActive >= 2, `cm=${rowInfo.cmInActive}`);
    check(
      'dt: cm editors transparent inside highlighted row',
      rowInfo.cmInActive > 0 && rowInfo.cmTransparent === rowInfo.cmInActive,
      `transparent=${rowInfo.cmTransparent}/${rowInfo.cmInActive} others=${JSON.stringify(rowInfo.others)}`,
    );
    await page.screenshot({ path: 'node_modules/.cache/probe-dt-highlight.png' });

    // nodes panel status icons stay 12px
    await page.goto(storyUrl('decision-graph-simulator-nodes-panel--with-successful-trace'), {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForTimeout(2500);
    const svgSizes = [];
    const svgs = await page.locator('[data-role="name"] svg').all();
    for (const svg of svgs.slice(0, 4)) {
      const box = await svg.boundingBox();
      if (box) svgSizes.push(Math.round(box.width));
    }
    check(
      'nodes-panel: status icons <= 14px',
      svgSizes.length > 0 && svgSizes.every((s) => s <= 14),
      svgSizes.join(','),
    );
    const row = page.locator('[data-role="name"]').filter({ hasText: 'Shipping Fees' }).first();
    const rowBox = await row.boundingBox();
    check(
      'nodes-panel: trace row single-line (<=32px)',
      rowBox && rowBox.height <= 32,
      rowBox ? `${Math.round(rowBox.height)}px` : 'n/a',
    );
    await page.screenshot({ path: 'node_modules/.cache/probe-nodes-panel.png' });
  });
  return report();
}
