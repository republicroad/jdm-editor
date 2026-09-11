import { chromium } from 'playwright';

/**
 * Drag-handle keyboard operability + landing-order correctness for the custom
 * function table: dnd-kit's KeyboardSensor gives handles role=button + a roving
 * focus, so keyboard users can pick up (Space/Enter), move (arrows) and drop.
 *
 * Landing-order assertions (roadmap §3.2 closure): with live reordering
 * (onDragOver → moveRows) each arrow move shifts the row deterministically, so
 * the final key order is exactly predictable per arrow sequence. The story is
 * reloaded between scenarios to keep them independent.
 */
const STORY_URL =
  'http://127.0.0.1:9010/iframe.html?id=custom-function-table--with-rows&viewMode=story';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];
  const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);

  const loadStory = async () => {
    await page.goto(STORY_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000);
  };
  const keyOrder = async () => {
    const out = [];
    for (const t of await page.locator('.expression-list-item__key [contenteditable="true"]').all()) {
      out.push(((await t.textContent()) ?? '').trim());
    }
    return out;
  };
  /** 拾取第 handleIndex 个把手，按 arrows 次 ArrowDown(-)/ArrowUp(+)，放下 */
  const keyboardMove = async (handleIndex, arrows) => {
    await page.evaluate((i) => document.querySelectorAll('.expression-list-item__drag')[i]?.focus(), handleIndex);
    await page.keyboard.press('Space');
    await page.waitForTimeout(250);
    for (let i = 0; i < Math.abs(arrows); i++) {
      await page.keyboard.press(arrows > 0 ? 'ArrowDown' : 'ArrowUp');
      await page.waitForTimeout(150);
    }
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
  };

  // ── 生命周期断言（沿用既有守护）──
  await loadStory();

  const handles = page.locator('.expression-list-item__drag');
  const count = await handles.count();
  check('drag handles rendered', count >= 3, `count=${count}`);

  if (count >= 3) {
    const first = handles.nth(0);
    const role = await first.getAttribute('role');
    check('handle exposed as button (dnd-kit attributes)', role === 'button', `role=${role}`);
    const roledesc = await first.getAttribute('aria-roledescription');
    check('handle carries a roledescription', Boolean(roledesc), roledesc ?? 'none');
    const tabIndex = await first.getAttribute('tabindex');
    check('handle is focusable (tabindex)', tabIndex === '0', `tabindex=${tabIndex}`);

    await page.evaluate(() => document.querySelectorAll('.expression-list-item__drag')[0]?.focus());
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const ariaPressed = await first.getAttribute('aria-pressed');
    check('Space starts a keyboard drag', ariaPressed === 'true', `aria-pressed=${ariaPressed}`);

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    check('Escape cancels cleanly', (await keyOrder()).length === count, (await keyOrder()).join('|'));
  }

  // ── 落点顺序断言（roadmap §3.2 闭环；每场景重载保证独立）──

  /** 轮询等待键顺序等于期望（拖放后 DOM/动画收敛需要时间） */
  const waitForOrder = async (expectedKeys, timeout = 8000) => {
    const t0 = Date.now();
    let last = [];
    while (Date.now() - t0 < timeout) {
      last = await keyOrder();
      if (JSON.stringify(last) === JSON.stringify(expectedKeys)) return last;
      await page.waitForTimeout(200);
    }
    return last;
  };

  const expectOrder = async (expectedKeys, label) => {
    const final = await waitForOrder(expectedKeys);
    check(
      `landing: ${label}`,
      JSON.stringify(final) === JSON.stringify(expectedKeys),
      `got [${final.join('|')}] want [${expectedKeys.join('|')}]`,
    );
  };

  // 场景 A：首行下移 1 步 → [r1, r0, r2]
  await loadStory();
  const keysA0 = await keyOrder();
  await keyboardMove(0, 1);
  await expectOrder([keysA0[1], keysA0[0], keysA0[2]], 'r0 ArrowDown ×1 → [r1, r0, r2]');

  // 场景 B：首行下移 2 步 → [r1, r2, r0]（多步累积；独立重载）
  await loadStory();
  const keysB0 = await keyOrder();
  await keyboardMove(0, 2);
  await expectOrder([keysB0[1], keysB0[2], keysB0[0]], 'r0 ArrowDown ×2 → [r1, r2, r0]');

  // 场景 C：末行上移 2 步 → 变首行（反向跨行）
  await loadStory();
  const keysC0 = await keyOrder();
  await keyboardMove(count - 1, -2);
  await expectOrder([keysC0[2], keysC0[0], keysC0[1]], 'last row ArrowUp ×2 → becomes first');

  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('NAV:', e.message.slice(0, 200));
  process.exit(1);
});
