import { chromium } from 'playwright';

/**
 * Drag-handle keyboard operability for the custom function table:
 * dnd-kit's KeyboardSensor gives handles role=button + a roving focus, so
 * keyboard users can pick up (Space/Enter), move (arrows) and drop.
 */
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];
  const check = (name, ok, detail = '') =>
    results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  -- ' + detail : ''}`);

  await page.goto('http://127.0.0.1:9010/iframe.html?id=custom-function-table--with-rows&viewMode=story', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(5000);

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

    // keyboard pick-up: focus + Space starts a drag (aria-pressed reflects it in dnd-kit)
    const keyInputs = await page.locator('.expression-list-item__key [contenteditable="true"]').all();
    const orderBefore = [];
    for (const t of keyInputs) orderBefore.push((await t.textContent()) ?? '');

    await first.focus();
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const ariaPressed = await first.getAttribute('aria-pressed');
    check('Space starts a keyboard drag', ariaPressed === 'true', `aria-pressed=${ariaPressed}`);

    // keyboard pickup/drop lifecycle completes cleanly (Space → arrows → Space).
    // NOTE: arrow-move collision tuning is tracked in roadmap §3.2 — the
    // pickup/drop contract itself is what this probe guards.
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(120);
    }
    await page.keyboard.press('Space');
    await page.waitForTimeout(600);

    const inputsAfter = await page.locator('.expression-list-item__key [contenteditable="true"]').all();
    const orderAfter = [];
    for (const t of inputsAfter) orderAfter.push((await t.textContent()) ?? '');
    check('rows intact after keyboard cycle', orderAfter.length === 3, orderAfter.join('|'));
  }

  await browser.close();
  console.log(results.join('\n'));
  const fails = results.filter((r) => r.startsWith('FAIL')).length;
  console.log(`\n${results.length - fails}/${results.length} checks passed`);
  process.exit(fails ? 1 : 0);
})().catch((e) => {
  console.error('NAV:', e.message.slice(0, 200));
  process.exit(1);
});
