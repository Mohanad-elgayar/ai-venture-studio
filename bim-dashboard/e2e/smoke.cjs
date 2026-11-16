/**
 * End-to-end smoke test. Start the app first (npm run dev or npm run preview), then:
 *   BASE_URL=http://localhost:5173 node e2e/smoke.cjs
 *   BASE_URL=file:///abs/path/release/BIM-Coordination-Center.html node e2e/smoke.cjs   (single-file build)
 * Exercises navigation, filters, matrix drill-down, clash editing, permissions, import, exports and reports.
 */
const { chromium } = require('playwright');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:5173';
const OUT = process.env.OUT_DIR || path.join(__dirname, '..', 'test-results');
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); };
const num = (s) => Number(String(s).replace(/[^0-9.]/g, ''));

(async () => {
  require('fs').mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const url = (r) => (BASE.endsWith('.html') ? `${BASE}#${r}` : `${BASE}/#${r}`); // supports the single-file build via file://
  const go = async (r) => { await page.goto(url(r)); await page.waitForTimeout(700); };
  const kpi = async (label) => num(await page.locator('div.card, button.card').filter({ hasText: new RegExp(`^${label}`, 'i') }).first().locator('div.text-\\[26px\\]').innerText());

  // 1. navigation
  await go('/');
  for (const [link, title] of [['Clash Matrix', 'Clash Matrix'], ['Clash Management', 'Clash Management'], ['Model Coordination', 'Model Coordination'], ['BIM Deliverables', 'BIM Deliverables Tracker'], ['Compliance & Quality', 'BIM Compliance & Quality'], ['Progress & Performance', 'BIM Progress & Performance'], ['Risks & Issues', 'Risk & Issue Dashboard'], ['Reports & Export', 'Reports & Export'], ['Data Import', 'Data Import'], ['Project & Access', 'Project & Access'], ['Executive Overview', 'Executive BIM Overview']]) {
    await page.getByRole('link', { name: link }).click();
    await page.waitForTimeout(500);
    check(`nav: ${link}`, (await page.locator('h1').innerText()) === title);
  }

  // 2. KPI baseline
  const open0 = await kpi('Open clashes'), closed0 = await kpi('Closed clashes'), total0 = await kpi('Total clashes');
  check('KPIs: open + closed = total', open0 + closed0 === total0, `${open0} + ${closed0} = ${total0}`);

  // 3. matrix totals vs KPI and drill-down
  await go('/matrix');
  const openTab = await page.getByRole('tab', { name: /^Open/ }).innerText();
  check('matrix open view total equals KPI', num(openTab) === open0, openTab);
  const cell = page.locator('table[aria-label="Discipline clash matrix"] button[aria-label*=" vs "]:not([disabled])').first();
  const cellLabel = await cell.getAttribute('aria-label');
  const cellCount = num(cellLabel.split(':')[1]);
  await cell.click();
  await page.waitForTimeout(500);
  const drawerText = await page.locator('aside[role=dialog]').innerText();
  check('matrix cell opens clash list with matching count', drawerText.includes(`${cellCount} clashes`), cellLabel);
  // search inside drawer
  const firstId = (await page.locator('aside[role=dialog] table tbody tr td').first().innerText()).trim();
  await page.locator('aside[role=dialog] input[aria-label="Search table"]').fill(firstId);
  await page.waitForTimeout(300);
  check('drawer search filters rows', (await page.locator('aside[role=dialog] table tbody tr').count()) === 1, firstId);

  // 4. edit clash status -> KPIs update
  await page.locator('aside[role=dialog] table tbody tr').first().click();
  await page.waitForTimeout(300);
  const dlg = page.locator('div[role=dialog]');
  await dlg.locator('label:has-text("Status") select').selectOption('Resolved');
  await dlg.locator('button:has-text("Save changes")').click();
  await page.waitForTimeout(300);
  check('validation: resolving requires resolution notes', await dlg.getByText('Resolution notes are required').isVisible());
  await dlg.locator('label:has-text("Resolution notes") textarea').fill('E2E: re-routed below beam');
  await dlg.locator('label:has-text("Add comment") input').fill('E2E comment');
  await dlg.locator('button:has-text("Save changes")').click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await go('/');
  const open1 = await kpi('Open clashes'), closed1 = await kpi('Closed clashes');
  check('status change updates KPIs', open1 === open0 - 1 && closed1 === closed0 + 1, `open ${open0}->${open1}, closed ${closed0}->${closed1}`);
  await go(`/clashes?id=${firstId}`);
  await page.getByRole('tab', { name: /History/ }).click();
  const hist = await page.locator('div[role=dialog]').innerText();
  check('clash history records status change and comment', hist.includes('Status Change') && hist.includes('E2E comment'));
  await page.keyboard.press('Escape');

  // 5. global filters
  await go('/');
  await page.locator('button:has-text("Building:")').click();
  await page.getByRole('option', { name: /^T1/ }).click();
  await page.keyboard.press('Escape'); await page.mouse.click(1500, 160);
  await page.waitForTimeout(500);
  const openT1 = await kpi('Open clashes');
  check('building filter reduces open clashes', openT1 < open1 && openT1 > 0, `${openT1}`);
  await go('/matrix');
  check('matrix respects global filter', num(await page.getByRole('tab', { name: /^Open/ }).innerText()) === openT1);
  await go('/clashes');
  check('register respects global filter', num(await page.getByRole('tab', { name: /^Open/ }).innerText()) === openT1);
  await page.getByRole('button', { name: /Reset filters/ }).click();
  await page.waitForTimeout(300);

  // 6. create + delete clash
  await go('/clashes');
  await page.getByRole('button', { name: 'New clash' }).click();
  const d2 = page.locator('div[role=dialog]');
  const newId = await d2.locator('label:has-text("Clash ID") input').inputValue();
  await d2.locator('label:has-text("Clash description") input').fill('E2E created clash');
  await d2.locator('label:has-text("Assigned to") select').selectOption({ index: 2 });
  await d2.locator('button:has-text("Create clash")').click();
  await page.waitForTimeout(500);
  await page.locator('input[aria-label="Search table"]').fill(newId);
  await page.waitForTimeout(300);
  check('new clash appears in register', (await page.locator('table tbody tr').first().innerText()).includes(newId), newId);
  await page.locator('table tbody tr').first().click();
  await page.locator('div[role=dialog]').getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await page.waitForTimeout(500);
  check('clash deleted', (await page.locator('table tbody tr').count()) === 0);

  // 7. exports
  const dl = async (fn) => { const [d] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), fn()]); const p = path.join(OUT, d.suggestedFilename()); await d.saveAs(p); return { name: d.suggestedFilename(), size: require('fs').statSync(p).size }; };
  await page.locator('input[aria-label="Search table"]').fill('');
  let f = await dl(() => page.getByRole('button', { name: 'CSV' }).click());
  check('register CSV export', f.name.endsWith('.csv') && f.size > 1000, `${f.name} ${f.size}B`);
  f = await dl(() => page.getByRole('button', { name: 'Excel' }).click());
  check('register Excel export', f.name.endsWith('.xlsx') && f.size > 5000, `${f.name} ${f.size}B`);
  await go('/matrix');
  f = await dl(() => page.getByRole('button', { name: 'Excel' }).click());
  check('matrix Excel export', f.size > 5000, f.name);
  await go('/reports');
  for (const t of ['Executive BIM Report', 'Clash Matrix Report', 'Weekly BIM Progress Report', 'Monthly BIM Performance Report']) {
    await page.getByRole('button', { name: new RegExp(t) }).click();
    f = await dl(() => page.getByRole('button', { name: 'Download PDF report' }).click());
    check(`PDF: ${t}`, f.name.endsWith('.pdf') && f.size > 8000, `${f.name} ${f.size}B`);
  }
  f = await dl(() => page.getByRole('button', { name: 'Excel report pack' }).click());
  check('Excel report pack', f.size > 8000, f.name);
  const [popup] = await Promise.all([page.waitForEvent('popup'), page.getByRole('button', { name: 'Open print-friendly report' }).click()]);
  await popup.waitForTimeout(1500);
  const pt = await popup.locator('body').innerText();
  check('print-friendly report renders', pt.includes('KPI summary') && pt.includes('Key observations') && pt.includes('Action items') && pt.includes('Prepared by'));
  await popup.screenshot({ path: path.join(OUT, 'print-report.png'), fullPage: true });
  await popup.close();

  // 8. import CSV (with deliberate errors) and Navisworks XML
  const before = (await page.goto(url('/')), await page.waitForTimeout(600), await kpi('Total clashes'));
  await go('/import');
  await page.setInputFiles('input[type=file]', path.join(__dirname, '..', 'public', 'samples', 'sample-clash-register.csv'));
  await page.waitForTimeout(800);
  check('import: mapping step shown', await page.getByText('Map columns').first().isVisible());
  await page.getByRole('button', { name: /Validate/ }).click();
  await page.waitForTimeout(500);
  const vtxt = await page.locator('main').innerText();
  check('import: validation detects 2 errors / 3 new', /New records\s*3/i.test(vtxt) && /Errors \(excluded\)\s*2/i.test(vtxt));
  await page.getByRole('button', { name: /Import 3 valid records/ }).click();
  await page.waitForTimeout(600);
  check('import: success', await page.getByText('3 records imported').isVisible());
  await page.getByRole('button', { name: 'Import another file' }).click();
  await page.setInputFiles('input[type=file]', path.join(__dirname, '..', 'public', 'samples', 'sample-navisworks-clash-report.xml'));
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Validate/ }).click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /Import 4 valid records/ }).click();
  await page.waitForTimeout(600);
  check('import: Navisworks XML 4 records', await page.getByText('4 records imported').isVisible());
  // re-import same file: duplicates skipped
  await page.getByRole('button', { name: 'Import another file' }).click();
  await page.setInputFiles('input[type=file]', path.join(__dirname, '..', 'public', 'samples', 'sample-navisworks-clash-report.xml'));
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /Validate/ }).click();
  await page.waitForTimeout(500);
  check('import: re-import skips duplicates', /Skipped \(duplicates\)\s*4/i.test(await page.locator('main').innerText()));
  await go('/');
  const after = await kpi('Total clashes');
  check('import updates KPI totals', after === before + 7, `${before} -> ${after}`);

  // 9. permissions
  await page.locator('select[aria-label="Acting as user"]').selectOption({ label: 'Client Representative (Demo) · Viewer' });
  await go('/clashes');
  check('viewer: no New clash button', (await page.getByRole('button', { name: 'New clash' }).count()) === 0);
  await page.locator('table tbody tr').first().click();
  check('viewer: clash is read-only', await page.getByText(/Read-only — your role/).isVisible());
  await page.keyboard.press('Escape');
  await go('/import');
  check('viewer: import blocked', await page.getByText(/Your role cannot import data/).isVisible());
  await page.locator('select[aria-label="Acting as user"]').selectOption({ label: 'Rahul Mehta (Demo) · Discipline Lead' });
  await go('/clashes');
  await page.locator('table tbody tr').first().click();
  check('discipline lead: limited edit notice or read-only', await page.getByText(/can update status|Read-only/).first().isVisible());
  await page.keyboard.press('Escape');
  await page.locator('select[aria-label="Acting as user"]').selectOption({ label: 'Lina Haddad (Demo) · BIM Manager' });

  // 10. period selector changes as-of
  await go('/');
  const opts = await page.locator('select[aria-label="Reporting period"] option').allTextContents();
  await page.locator('select[aria-label="Reporting period"]').selectOption({ label: opts.find((o) => /^Week/.test(o) && opts.indexOf(o) > 6) });
  await page.waitForTimeout(600);
  check('earlier reporting period shows fewer total clashes', (await kpi('Total clashes')) < after);
  await page.locator('select[aria-label="Reporting period"]').selectOption('live');

  // 11. theme + sidebar + responsive
  await page.getByRole('button', { name: 'Toggle light/dark mode' }).click();
  await page.waitForTimeout(300);
  check('light mode toggles', await page.evaluate(() => document.documentElement.classList.contains('light')));
  await page.screenshot({ path: path.join(OUT, 'overview-light.png') });
  await page.getByRole('button', { name: 'Toggle light/dark mode' }).click();
  await page.getByRole('button', { name: /Collapse sidebar/ }).click();
  await page.waitForTimeout(300);
  check('sidebar collapses', (await page.locator('aside').first().boundingBox()).width < 80);
  await page.getByRole('button', { name: /Expand sidebar/ }).click();
  for (const [w, h, name] of [[1366, 768, 'laptop'], [820, 1180, 'tablet']]) {
    await page.setViewportSize({ width: w, height: h });
    for (const r of ['/', '/matrix']) {
      await go(r);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      check(`responsive ${name} ${r}: no page-level horizontal overflow`, !overflow);
      await page.screenshot({ path: path.join(OUT, `${name}${r === '/' ? '-overview' : r.replace('/', '-')}.png`) });
    }
  }
  check('no runtime errors in console', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
