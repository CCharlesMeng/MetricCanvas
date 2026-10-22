import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

// Compare CSS with a consistent text rasterizer on Linux, including sticky layers.
// Chromium documents this switch in content/public/common/content_switches.cc.
test.use({ launchOptions: { args: ['--disable-lcd-text'] } });

const fixture = () => JSON.parse(readFileSync(new URL('../../../../pages/capabilities/table/table-tiny-os.json', import.meta.url), 'utf8'));
async function mount(page: Page, document = fixture()) {
  await page.goto('/examples/inline.html');
  await page.evaluate(document => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', { document });
  }, document);
}
const recordFacts = (info: TestInfo, id: string, actual: unknown) => writeFileSync(info.outputPath(`${id}.json`), JSON.stringify({ id, actual }, null, 2));
const table = (page: Page, id: string) => page.locator(`[data-component="${id}/${id}-table"] .table-widget`);

test('ordinary, forecastMatrix and embedded match frozen OS grid values; compact stays on its old skin', async ({ page }, testInfo) => {
  await mount(page);
  const gridFacts: Record<string, unknown> = {};
  for (const id of ['ordinary', 'forecast', 'embedded']) {
    const widget = table(page, id);
    await expect(widget).toHaveClass(/os-theme/);
    const header = widget.locator('th').first();
    const body = widget.locator('tbody td').first();
    gridFacts[id] = await widget.evaluate(root => {
      const th = root.querySelector('th')!, td = root.querySelector('tbody td')!;
      const header = getComputedStyle(th), body = getComputedStyle(td), divider = getComputedStyle(th, '::before');
      const sort = getComputedStyle(root.querySelector('.sort-hint svg')!);
      return { font: { fontSize: body.fontSize, lineHeight: body.lineHeight, color: body.color, fontFamily: body.fontFamily },
        header: { height: header.height, padding: header.padding, backgroundColor: header.backgroundColor, color: header.color, fontWeight: header.fontWeight },
        separator: { width: divider.width, height: divider.height, color: divider.backgroundColor, bodyRight: body.borderRightWidth, bodyBottom: body.borderBottom },
        body: { height: body.height, padding: body.padding }, sort: { width: sort.width, fill: sort.fill, path: root.querySelector('.sort-hint svg path')!.getAttribute('d') } };
    });
    await expect(header).toHaveCSS('height', '40px');
    await expect(header).toHaveCSS('background-color', 'rgb(245, 245, 245)');
    await expect(header).toHaveCSS('font-weight', '600');
    await expect(header).toHaveCSS('padding', '4px 16px');
    await expect(body).toHaveCSS('height', '48px');
    await expect(body).toHaveCSS('padding', '12px 16px');
    await expect(body).toHaveCSS('line-height', '21px');
    await expect(body).toHaveCSS('border-right-width', '0px');
    await expect(body).toHaveCSS('border-bottom-color', 'rgb(240, 240, 240)');
    await expect(widget.locator('.sort-hint svg').first()).toHaveCSS('width', '16px');
    expect(await header.evaluate(e => {
      const s = getComputedStyle(e, '::before');
      return [s.width, s.height, s.backgroundColor];
    })).toEqual(['1px', '16px', 'rgb(219, 219, 219)']);
  }
  recordFacts(testInfo, 'grid-values', gridFacts);
  const compact = table(page, 'compact');
  await expect(compact).not.toHaveClass(/os-theme/);
  await expect(compact.locator('th').first()).toHaveCSS('font-weight', '500');
  await expect(compact.locator('th').first()).toHaveCSS('padding', '5px 8px');
  await expect(compact.locator('tbody td').first()).toHaveCSS('height', '42px');
  await expect(compact.locator('.sort-hint').first()).toHaveText('⇅');
  await expect(compact.locator('.sort-hint svg')).toHaveCount(0);
  await table(page, 'ordinary').screenshot({ path: testInfo.outputPath('ordinary-os.png') });
  await compact.screenshot({ path: testInfo.outputPath('compact-preserved.png') });
});

test('sort, search, empty state and pagination retain table-local behavior', async ({ page }, testInfo) => {
  await mount(page);
  const widget = table(page, 'ordinary');
  await widget.getByRole('button', { name: '金额（元）', exact: true }).click();
  await widget.getByRole('button', { name: '金额（元）', exact: false }).click();
  await expect(widget.locator('tbody td').first()).toHaveText('客户25');
  await expect(widget.locator('.sort-state svg')).toHaveCSS('fill', 'rgb(25, 25, 25)');
  recordFacts(testInfo, 'sort-active', await widget.locator('.sort-state svg').evaluate(e => ({ width: getComputedStyle(e).width, fill: getComputedStyle(e).fill, path: e.querySelector('path')!.getAttribute('d') })));
  await expect(table(page, 'embedded').locator('tbody td').first()).toHaveText('客户01');
  await widget.getByRole('searchbox').fill('客户12');
  await widget.getByRole('searchbox').press('Enter');
  await expect(widget.locator('tbody tr')).toHaveCount(1);
  await expect(widget.locator('tbody td').first()).toHaveText('客户12');
  await widget.getByRole('searchbox').fill('不存在');
  await widget.getByRole('searchbox').press('Enter');
  await expect(widget.locator('.empty-state')).toHaveText('暂无数据');
  await expect(widget.locator('.empty-state')).toHaveCSS('display', 'flex');
  await expect(widget.locator('.empty-state')).toHaveCSS('padding', '60px 0px');
  recordFacts(testInfo, 'empty-state', await widget.locator('.empty-state').evaluate(e => {
    const s = getComputedStyle(e); return { display: s.display, minHeight: s.minHeight, padding: s.padding, alignItems: s.alignItems, justifyContent: s.justifyContent };
  }));
  await widget.getByRole('button', { name: '清空表格搜索' }).click();
  await widget.getByRole('button', { name: '下一页', exact: true }).click();
  await expect(widget.getByRole('button', { name: '2', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(widget.locator('tbody td').first()).toHaveText('客户20');
});

test('number and date filters keep submitted state and popovers clear without clipping', async ({ page }, testInfo) => {
  await mount(page);
  const widget = table(page, 'ordinary');
  const amount = widget.locator('th[data-column-field="value"]');
  await amount.locator('summary').click();
  const menu = amount.locator('.menu');
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS('min-width', '270px');
  recordFacts(testInfo, 'filter-menu', await amount.evaluate(e => {
    const menu = getComputedStyle(e.querySelector('.menu')!), icon = getComputedStyle(e.querySelector('summary svg')!);
    return { minWidth: menu.minWidth, boxShadow: menu.boxShadow, iconWidth: icon.width, iconFill: icon.fill };
  }));
  await menu.getByLabel('数值下限').fill('2400');
  await menu.getByLabel('数值下限').press('Tab');
  await expect(widget.locator('tbody tr')).toHaveCount(2);
  await expect(amount.locator('summary')).toHaveClass(/active/);
  await menu.getByRole('button', { name: '清除筛选' }).click();
  await expect(widget.locator('tbody tr')).toHaveCount(5);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  const date = widget.locator('th[data-column-field="created"]');
  await date.locator('summary').click();
  const future = '2099-01-01';
  await date.locator('input[type=date]').first().fill(future);
  await date.locator('input[type=date]').first().press('Tab');
  await expect(date.getByRole('status')).toContainText('日期不得晚于');
  await expect(widget.locator('tbody tr')).toHaveCount(5);
  await widget.screenshot({ path: testInfo.outputPath('date-filter-os.png') });
});

test('fit columns use rendered widths for both fixed sides and wrapped header rows stay separated', async ({ page }, testInfo) => {
  const document = fixture();
  const multi = document.sections[4].components[0];
  multi.props.columns[1].children[0].children[0].fixed = 'left';
  multi.props.columns[1].children[1].fixed = 'right';
  document.sections = [document.sections[4]];
  await page.setViewportSize({ width: 1280, height: 900 });
  await mount(page, document);
  const widget = table(page, 'multi');
  const scroll = widget.locator('.scroll');
  await scroll.evaluate(e => { (e as HTMLElement).style.maxHeight = '260px'; });
  await scroll.evaluate(e => { e.scrollLeft = 160; e.scrollTop = 150; });
  await expect.poll(() => widget.locator('th[data-column-field="value"]').evaluate(e => parseFloat(getComputedStyle(e).left))).toBeGreaterThan(0);
  const geometry = await widget.evaluate(root => {
    const first = root.querySelector<HTMLElement>('th[data-column-field="name"]')!;
    const second = root.querySelector<HTMLElement>('th[data-column-field="value"]')!;
    const last = root.querySelector<HTMLElement>('th[data-column-field="status"]')!;
    const beforeLast = root.querySelector<HTMLElement>('th[data-column-field="note"]')!;
    const rows = Array.from(root.querySelectorAll('thead tr'));
    const tops = rows.map(row => parseFloat((row as HTMLElement).style.getPropertyValue('--table-header-top')));
    return { firstWidth: first.getBoundingClientRect().width, secondLeft: parseFloat(getComputedStyle(second).left),
      lastWidth: last.getBoundingClientRect().width, beforeLastRight: parseFloat(getComputedStyle(beforeLast).right),
      tops, heights: rows.map(row => row.getBoundingClientRect().height) };
  });
  recordFacts(testInfo, 'fixed-geometry', geometry);
  expect(geometry.secondLeft).toBeCloseTo(geometry.firstWidth, 1);
  expect(geometry.beforeLastRight).toBeCloseTo(geometry.lastWidth, 1);
  expect(geometry.tops[1]).toBeCloseTo(geometry.heights[0], 1);
  expect(geometry.tops[2]).toBeCloseTo(geometry.heights[0] + geometry.heights[1], 1);
  // Now keep the original fixture's one fixed column per side for narrow scrolling.
  delete multi.props.columns[1].children[0].children[0].fixed;
  delete multi.props.columns[1].children[1].fixed;
  await page.evaluate(document => window.runtime.update({ document }), document);
  await page.setViewportSize({ width: 390, height: 900 });
  await scroll.evaluate(e => { e.scrollLeft = 160; e.scrollTop = 150; });
  await expect(widget).not.toHaveClass(/fixed-overflow/);
  await expect(widget).toHaveClass(/scrolled-left/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(widget.locator('th.fixed-left-boundary').first()).toHaveCSS('box-shadow', 'none');
  await expect.poll(() => widget.locator('th.fixed-left-boundary').first().evaluate(e => getComputedStyle(e, '::after').boxShadow)).toBe('rgba(0, 0, 0, 0.15) 10px 0px 8px -8px inset');
  recordFacts(testInfo, 'fixed-shadow', await widget.locator('th.fixed-left-boundary').first().evaluate(e => {
    const s = getComputedStyle(e, '::after'); return { width: s.width, boxShadow: s.boxShadow };
  }));
  recordFacts(testInfo, 'page-overflow', await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth })));
  await widget.screenshot({ path: testInfo.outputPath('narrow-fixed-multi-header.png') });
});

test('oversized fixed banks remain reachable without overlapping at narrow widths', async ({ page }, testInfo) => {
  const document = fixture();
  const multi = document.sections[4].components[0];
  multi.props.columns[1].children[0].children[0].fixed = 'left';
  multi.props.columns[1].children[1].fixed = 'right';
  document.sections = [document.sections[4]];
  await page.setViewportSize({ width: 390, height: 900 });
  await mount(page, document);
  const widget = table(page, 'multi');
  await expect(widget).toHaveClass(/fixed-overflow/);
  const scroll = widget.locator('.scroll');
  await scroll.evaluate(e => { e.scrollLeft = 160; });
  const facts = await widget.evaluate(root => {
    const body = Array.from(root.querySelectorAll('tbody tr:first-child td'));
    const cells = body.map(e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right }; });
    const container = root.querySelector('.scroll')!;
    const viewport = container.getBoundingClientRect();
    const center = cells[2];
    return { gaps: cells.slice(1).map((cell, i) => cell.left - cells[i].right), centerVisibleWidth: Math.min(center.right, viewport.right) - Math.max(center.left, viewport.left),
      pinnedLefts: Array.from(root.querySelectorAll('th.fixed')).map(e => getComputedStyle(e).left), shadow: getComputedStyle(root.querySelector('.fixed-left-boundary')!, '::after').display };
  });
  facts.gaps.forEach(gap => expect(gap).toBeGreaterThanOrEqual(-0.1));
  expect(facts.centerVisibleWidth).toBeGreaterThan(0);
  expect(facts.pinnedLefts.every(value => value === 'auto')).toBe(true);
  expect(facts.shadow).toBe('none');
  recordFacts(testInfo, 'fixed-overflow-geometry', facts);
  await widget.screenshot({ path: testInfo.outputPath('narrow-fixed-overflow.png') });
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(widget).not.toHaveClass(/fixed-overflow/);
  await expect.poll(() => widget.locator('th[data-column-field="value"]').evaluate(e => parseFloat(getComputedStyle(e).left))).toBeGreaterThan(0);
});

test('explicit business colors on links survive the OS default link color', async ({ page }) => {
  const document = fixture();
  document.sections = [document.sections[0]];
  document.sections[0].components[0].props.columns[1].link = true;
  document.sections[0].components[0].props.columns[1].navigate = { href: '/pages/table-tiny-os' };
  document.sections[0].components[0].props.columns[1].colorRule = { mode: 'fixed', color: 'red' };
  await mount(page, document);
  const cell = table(page, 'ordinary').locator('tbody td[data-column-field="value"]').first();
  const cellColor = await cell.evaluate(e => getComputedStyle(e).color);
  await expect(cell.locator('.link-cell')).toHaveCSS('color', cellColor);
  expect(cellColor).not.toBe('rgb(25, 25, 25)');
});

test('fixed offsets refresh after same-sized data windows redistribute automatic column widths', async ({ page }) => {
  const document = fixture();
  document.sections = [document.sections[0]];
  const columns = document.sections[0].components[0].props.columns;
  columns.forEach((column: { width?: number }) => delete column.width);
  columns[1].fixed = 'left';
  await mount(page, document);
  const widget = table(page, 'ordinary');
  const first = widget.locator('th[data-column-field="name"]');
  const second = widget.locator('th[data-column-field="value"]');
  const oldWidth = await first.evaluate(e => e.getBoundingClientRect().width);
  document.dataSources.records.source.rows.forEach((row: { name: string }) => row.name = '非常长的客户名称用于改变自动列宽分配' + row.name);
  await page.evaluate(document => window.runtime.update({ document }), document);
  await expect.poll(() => first.evaluate(e => e.getBoundingClientRect().width)).not.toBe(oldWidth);
  await expect.poll(async () => {
    const width = await first.evaluate(e => e.getBoundingClientRect().width);
    const left = await second.evaluate(e => parseFloat(getComputedStyle(e).left));
    return Math.abs(width - left);
  }).toBeLessThan(0.2);
});

test('static report export preserves column separators without sticky offsets or scrolling shadows', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const document = fixture();
  document.layout = 'report';
  document.sections = [document.sections[0]];
  document.sections[0].components.unshift({ id: 'export-header', type: 'reportHeader', layout: { span: 12 }, props: {
    title: '表格样式导出', exportButtons: [{ format: 'png', scale: 1 }]
  } });
  await mount(page, document);
  await page.evaluate(() => {
    const OriginalWorker = Worker;
    window.Worker = class extends OriginalWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        const view = globalThis.document.querySelector<HTMLIFrameElement>('[data-report-export-frame]')?.contentDocument;
        const widget = view?.querySelector<HTMLElement>('.table-widget.os-theme');
        const th = widget?.querySelector<HTMLElement>('th');
        if (widget && th) globalThis.document.documentElement.dataset.tableExportFacts = JSON.stringify({
          staticExport: widget.classList.contains('static-export'), position: getComputedStyle(th).position,
          top: getComputedStyle(th).top, separator: getComputedStyle(th, '::before').height,
          rows: widget.querySelectorAll('tbody tr').length,
          measuredTop: th.parentElement?.style.getPropertyValue('--table-header-top'),
          shadow: getComputedStyle(th, '::after').boxShadow
        });
      }
    };
  });
  const event = page.waitForEvent('download', { timeout: 80_000 });
  await page.getByRole('button', { name: '导出图片', exact: true }).click();
  const download = await event;
  await download.saveAs(testInfo.outputPath('os-table-export.png'));
  const facts = await page.evaluate(() => JSON.parse(document.documentElement.dataset.tableExportFacts!));
  recordFacts(testInfo, 'export-values', facts);
  expect(facts).toEqual({ staticExport: true, position: 'relative', top: '0px', separator: '16px', rows: 25, measuredTop: '', shadow: 'none' });
  await expect(page.locator('[data-report-export-frame]')).toHaveCount(0);
});

test('grid pixels equal the frozen official CSS reference with identical content, widths and browser', async ({ page, context }, testInfo) => {
  const reference = JSON.parse(readFileSync(new URL('../fixtures/tiny-os-grid-reference.json', import.meta.url), 'utf8'));
  const css = readFileSync(new URL('../fixtures/tiny-os-grid.css', import.meta.url), 'utf8');
  const refPage = await context.newPage();
  const headings = reference.columns.map((title: string, index: number) => `<th class="tiny-grid-header__column"><div class="tiny-grid-cell"><div class="tiny-grid-cell-text">${title}</div></div>${index < 3 ? '<div class="tiny-grid-resizable is__line"></div>' : ''}</th>`).join('');
  const body = reference.rows.map((row: string[]) => `<tr class="tiny-grid-body__row">${row.map(value => `<td class="tiny-grid-body__column"><div class="tiny-grid-cell">${value}</div></td>`).join('')}</tr>`).join('');
  await refPage.setContent(`<style>*{box-sizing:border-box}body{margin:0}table{font:inherit;color:inherit}.tiny-grid{font-family:Helvetica,Arial,PingFangSC-Regular,'Hiragino Sans GB','Microsoft YaHei',微软雅黑,'Microsoft JhengHei';width:520px;line-height:14px}</style><style>${css}</style><div class="tiny-grid__wrapper tiny-grid view_default tiny-grid__animat"><div class="tiny-grid__body-wrapper body__wrapper block"><table class="tiny-grid__body" cellspacing="0" cellpadding="0" border="0" style="width:520px"><colgroup>${'<col width="130">'.repeat(4)}</colgroup><thead><tr class="tiny-grid-header__row">${headings}</tr></thead><tbody>${body}</tbody></table></div></div>`);
  for (const variant of [undefined, 'forecastMatrix', 'embedded']) {
    await refPage.locator('th, td').evaluateAll((cells, centered) => cells.forEach(cell => cell.classList.toggle('col__center', centered)), variant === 'forecastMatrix');
    const expected = await refPage.locator('table').screenshot();
    writeFileSync(testInfo.outputPath(`${variant ?? 'ordinary'}-official-grid.png`), expected);
    const document = fixture();
    document.dataSources.records.fields = Object.fromEntries(reference.fields.map((field: string) => [field, { type: 'string', role: 'dimension' }]));
    document.dataSources.records.source.rows = reference.rows.map((row: string[]) => Object.fromEntries(reference.fields.map((field: string, i: number) => [field, row[i]])));
    const component = document.sections[0].components[0];
    component.props = { variant, columns: reference.fields.map((field: string, i: number) => ({ field, title: reference.columns[i], width: 130 })), pagination: { mode: 'none' } };
    document.sections = [document.sections[0]];
    await mount(page, document);
    const widget = table(page, 'ordinary');
    await widget.locator('.scroll').evaluate(e => Object.assign((e as HTMLElement).style, { position: 'fixed', left: '0', top: '0', width: '520px', zIndex: '10000' }));
    const actual = await widget.locator('table').screenshot();
    writeFileSync(testInfo.outputPath(`${variant ?? 'ordinary'}-grid.png`), actual);
    expect(actual.equals(expected), `${variant ?? 'ordinary'} grid must equal frozen official CSS pixels`).toBe(true);
  }
  await refPage.close();
});
