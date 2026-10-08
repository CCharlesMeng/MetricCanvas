import { expect, test, type Page } from '@playwright/test';
import type { Component } from '@metriccanvas/page/internal';
import { configuredTitles, drawingCount, presentationFixtures, scalarPage } from './presentation-fixtures';

async function show(page: Page, document: unknown) {
  await page.evaluate(document => {
    window.runtime.destroy();
    window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: MetricCanvas.createDqeGateway() });
  }, document);
  await expect(page.locator('[data-page-layout-form]')).toHaveCount(1);
}

for (const width of [1440, 390]) for (const layout of ['report', 'dashboard'] as const) {
  for (const container of [undefined, 'plain', 'panel', 'card'] as const) {
    test(`${width} ${layout} ${container ?? 'default'}: all 53 declared component branches remain visible`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/examples/inline.html');
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.message));
      const failures: string[] = [];
      const fixtures = presentationFixtures();
      expect(fixtures).toHaveLength(53);
      for (const fixture of fixtures) {
        const document = { ...fixture.document, layout, sections: fixture.document.sections.map(section => ({ ...section, container })) };
        await show(page, document);
        for (const section of document.sections) for (const component of section.components) {
          const cell = page.locator(`[data-component="${section.id}/${component.id}"]`);
          await expect(cell, fixture.name).toBeVisible();
          for (const title of configuredTitles(component)) {
            if (!(await cell.getByText(title, { exact: false }).first().isVisible())) failures.push(`${fixture.name}: title ${title}`);
          }
        }
        // Maps load their basemap asynchronously. A positive chart height must include
        // a real canvas, not merely a title or a nonzero cell around an empty drawing area.
        const expectedDrawings = document.sections.flatMap(section => section.components).reduce((count, component) => count + drawingCount(component), 0);
        if (expectedDrawings) await page.locator('.echart canvas').first().waitFor();
        await expect(page.locator('.echart'), fixture.name).toHaveCount(expectedDrawings);
        const hiddenCharts = await page.locator('.echart').evaluateAll(charts => charts.flatMap(chart => {
          const rect = chart.getBoundingClientRect();
          const canvas = chart.querySelector('canvas')?.getBoundingClientRect();
          return rect.width < 30 || rect.height < 30 || !canvas || canvas.height < 30 ? [{ width: rect.width, height: rect.height }] : [];
        }));
        if (hiddenCharts.length) failures.push(`${fixture.name}: collapsed canvas ${JSON.stringify(hiddenCharts)}`);
        const hiddenTables = await page.locator('.table-widget .scroll').evaluateAll(tables => tables.filter(table => table.getBoundingClientRect().height < 20).length);
        if (hiddenTables) failures.push(`${fixture.name}: collapsed table body`);
      }
      expect(errors).toEqual([]);
      expect(failures).toEqual([]);
    });
  }
}

test('all header metadata, metric panels/progress and repeated configured items render', async ({ page }) => {
  await page.goto('/examples/inline.html');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const header: Component = { id: 'header', type: 'reportHeader', layout: { span: 12 }, props: {
    title: '配置标题', variant: 'projectDetail', subtitle: '配置副标题', generatedBy: '配置作者', badge: '配置徽标',
    asOf: { label: '配置时间', value: '2026-10-08' }, tags: ['标签一', '标签二', '标签三', '标签四']
  } };
  await show(page, scalarPage([header]));
  const missing: string[] = [];
  for (const text of ['配置副标题', '配置作者', '配置徽标', '配置时间', '2026-10-08', '标签三', '标签四']) {
    if (!(await page.getByText(text, { exact: true }).first().isVisible())) missing.push(text);
  }
  for (const variant of [undefined, 'summary', 'activityProgress', 'compactSummary', 'dualSummary', 'compactStrip', 'compactStack'] as const) {
    const metric: Component = { id: 'metric', type: 'metricCard', layout: { span: 12 }, data: { main: 'values' }, props: {
      variant, title: '主面板', rows: [{ label: '主指标', valueField: 'amount' }], secondaryTitle: '次面板',
      secondaryRows: [{ label: '次指标', valueField: 'amount' }], progress: { valueField: 'amount', label: '配置完成率' }
    } };
    await show(page, scalarPage([metric]));
    for (const text of ['次面板', '次指标', '配置完成率']) if (!(await page.getByText(text, { exact: true }).first().isVisible())) missing.push(`${variant ?? 'default'}: ${text}`);
  }
  const items: Component = { id: 'items', type: 'keyValuePanel', layout: { span: 12 }, data: { main: 'values' }, props: {
    items: [{ label: '重复标签', field: 'name' }, { label: '重复标签', field: 'amount' }]
  } };
  await show(page, scalarPage([items]));
  await expect(page.getByText('重复标签', { exact: true })).toHaveCount(2);
  expect(errors).toEqual([]);
  expect(missing).toEqual([]);
});

/** A scroll owner makes offscreen content reachable; hidden/clip without one does not. */
async function inaccessibleText(page: Page) {
  return page.locator('[data-component]').evaluateAll(cells => cells.flatMap(cell => {
    const failures: string[] = [];
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent?.trim()) continue;
      const element = node.parentElement!;
      if (element.closest('[aria-hidden="true"], .chart-semantics, .echart')) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      const rect = range.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      for (let parent: Element | null = element; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (['auto', 'scroll'].includes(style.overflowX) || ['auto', 'scroll'].includes(style.overflowY)) break;
        const box = parent.getBoundingClientRect();
        const horizontal = ['hidden', 'clip'].includes(style.overflowX) && (rect.left < box.left - 1 || rect.right > box.right + 1);
        const vertical = ['hidden', 'clip'].includes(style.overflowY) && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1);
        if (horizontal || vertical) { failures.push(`${cell.getAttribute('data-component')}: ${node.textContent!.slice(0, 35)}`); break; }
        if (parent === cell) break;
      }
    }
    return failures;
  }));
}

for (const width of [1440, 390]) {
  test(`${width}: long/multirow configured content remains reachable in compact containers`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/examples/inline.html');
    const failures: string[] = [];
    for (const variant of [undefined, 'counterStrip', 'detailSummary', 'detailNormMatrix'] as const) {
      const component: Component = { id: 'information', type: 'keyValuePanel', layout: { span: 12 }, data: { main: 'values' }, props: {
        variant, columns: 6, title: '完整信息标题', items: Array.from({ length: 20 }, (_, index) => ({
          label: `配置第${index + 1}项${'长标签'.repeat(8)}`, field: 'name'
        }))
      } };
      await show(page, scalarPage([component]));
      failures.push(...(await inaccessibleText(page)).map(failure => `${variant ?? 'default'}: ${failure}`));
    }
    const header: Component = { id: 'header', type: 'reportHeader', layout: { span: 12 }, props: {
      title: '长标题内容'.repeat(25), variant: 'projectDetail', tags: Array.from({ length: 12 }, (_, index) => `项目标签${index}${'长'.repeat(20)}`)
    } };
    await show(page, scalarPage([header]));
    const overlaps = await page.locator('.project-detail h1').evaluate(title => {
      const rect = title.getBoundingClientRect();
      const tags = title.parentElement!.querySelector('.tags')!.getBoundingClientRect();
      return rect.left < tags.right && rect.right > tags.left && rect.top < tags.bottom && rect.bottom > tags.top;
    });
    expect(overlaps).toBe(false);
    failures.push(...await inaccessibleText(page));
    expect(failures).toEqual([]);
  });
}

test('every table in a compact tab list remains reachable and duplicate links render', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/examples/inline.html');
  const tables = Array.from({ length: 6 }, (_, index): Extract<Component, { type: 'table' }> => ({
    id: `table-${index}`, type: 'table', layout: { span: 12 }, data: { main: 'values' },
    props: { title: `配置表格${index}`, columns: [{ field: 'name', title: '名称' }, { field: 'amount', title: '金额' }] }
  }));
  const tab: Component = { id: 'tabs', type: 'tabContainer', layout: { span: 12 }, props: {
    variant: 'compact', tabs: Array.from({ length: 10 }, (_, index) => ({ id: `tab-${index}`, label: `配置页签${index}`, components: tables.map(table => ({ ...table, id: `${table.id}-${index}` })) }))
  } };
  await show(page, scalarPage([tab]));
  const heights = await page.locator('.table-widget .scroll').evaluateAll(tables => tables.map(table => table.getBoundingClientRect().height));
  expect(heights.every(height => height >= 20), JSON.stringify(heights)).toBe(true);
  const lastTab = page.getByRole('tab', { name: '配置页签9', exact: true });
  await lastTab.scrollIntoViewIfNeeded();
  await expect(lastTab).toBeInViewport();
  await lastTab.click();
  await expect(lastTab).toHaveAttribute('aria-selected', 'true');
  expect(await page.locator('.tab-list').evaluate(list => getComputedStyle(list).overflowX)).toBe('auto');
  const links: Component = { id: 'links', type: 'text', layout: { span: 12 }, props: { links: [
    { label: '重复链接', href: 'https://example.com' }, { label: '重复链接', href: 'https://example.com' }
  ] } };
  await show(page, scalarPage([links]));
  await expect(page.getByRole('link', { name: '重复链接', exact: false })).toHaveCount(2);
});

test('configured gauge/ranking detail actions have a visible keyboard-accessible trigger', async ({ page }) => {
  await page.goto('/examples/inline.html');
  for (const type of ['gauge', 'rankingCard'] as const) {
    const actions = [{ on: 'click' as const, openDetail: { surface: 'modal' as const, fields: [{ label: '配置详情', field: 'name' }] } }];
    const component: Component = type === 'gauge'
      ? { id: 'action', type, layout: { span: 12 }, data: { main: 'values' }, props: { title: '仪表动作', valueField: 'amount', actions } }
      : { id: 'action', type, layout: { span: 12 }, data: { main: 'values' }, props: { title: '排行动作', nameField: 'name', valueField: 'amount', actions } };
    await show(page, scalarPage([component]));
    const trigger = page.locator('[data-component="main/action"] button').first();
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toContainText('配置详情');
    await expect(page.getByRole('dialog')).toContainText('配置取值');
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
});

test('forecast table without pagination keeps every configured row reachable', async ({ page }) => {
  await page.goto('/examples/inline.html');
  const table: Component = { id: 'forecast', type: 'table', layout: { span: 12 }, data: { main: 'values' }, props: {
    variant: 'forecastMatrix', pagination: { mode: 'none' }, columns: [{ field: 'name', title: '项目' }, { field: 'amount', title: '金额' }]
  } };
  const document = scalarPage([table]);
  Object.assign(document.dataSources.values!.source, { rows: Array.from({ length: 30 }, (_, index) => ({ name: `配置行${index}`, amount: index })) });
  await show(page, document);
  const scroll = page.locator('.forecast-matrix .scroll');
  expect(await scroll.evaluate(element => getComputedStyle(element).overflowY)).toBe('auto');
  await page.getByText('配置行29', { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText('配置行29', { exact: true })).toBeInViewport();
});

test('linked, selected, rate-bar and plain columns all retain configured secondary and badge fields', async ({ page }) => {
  await page.goto('/examples/inline.html');
  for (const kind of ['plain', 'linked', 'selected', 'rate'] as const) {
    const table: Component = { id: 'compound', type: 'table', layout: { span: 12 }, data: { main: 'values' }, props: {
      columns: [{ field: 'amount', secondaryField: 'name', badgeField: 'name',
        ...(kind === 'linked' ? { link: true, navigate: { href: 'https://example.com' } } : {}),
        ...(kind === 'rate' ? { visual: 'rateBar' as const } : {}),
        ...(kind === 'selected' ? { selection: { writes: { selected: { value: 'yes' } } } } : {}) }]
    } };
    const document = scalarPage([table], kind === 'selected' ? [{ id: 'selected', type: 'dimension', dimension: 'selected' }] : undefined);
    await show(page, document);
    await expect(page.locator('tbody .cell-primary-value, tbody .cell-value').first()).toContainText('65');
    await expect(page.locator('tbody small:not(.cell-badge)'), kind).toHaveText('配置取值');
    await expect(page.locator('tbody .cell-badge'), kind).toHaveText('配置取值');
  }
});

test('embedded and forecast cells wrap long configured values instead of clipping them', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/examples/inline.html');
  for (const variant of ['embedded', 'forecastMatrix'] as const) {
    const table: Component = { id: 'long-table', type: 'table', layout: { span: 12 }, data: { main: 'values' }, props: {
      variant, fit: 'container', pagination: { mode: 'none' }, columns: [{ field: 'name', title: '项目', width: 96 }, { field: 'amount', title: '金额', width: 96 }]
    } };
    const document = scalarPage([table]);
    Object.assign(document.dataSources.values!.source, { rows: [{ name: 'LongConfiguredContent'.repeat(10), amount: 65 }] });
    await show(page, document);
    expect(await inaccessibleText(page), variant).toEqual([]);
    expect(await page.locator('.cell-primary-value').first().evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
});

test('snapshot detail charts reuse normal layout, drawing space and configured spans', async ({ page }) => {
  await page.goto('/examples/inline.html');
  const component: Component = { id: 'ranking', type: 'rankingCard', layout: { span: 12 }, data: { main: 'values' }, props: {
    title: '详情入口', nameField: 'name', valueField: 'amount'
  } };
  const document = scalarPage([component]);
  Object.assign(document.sections[0]!.components[0]!.props, { actions: [{ on: 'click', openDetail: { surface: 'modal', view: 'charts' } }] });
  document.detailViews = [{ id: 'charts', mode: 'snapshot', components: [
    { id: 'line', type: 'lineChart', layout: { span: 12 }, data: { main: 'values' }, props: { title: '详情趋势', xField: 'name', series: [{ field: 'amount' }] } },
    { id: 'bar', type: 'barChart', layout: { span: 12 }, data: { main: 'values' }, props: { title: '详情对比', categoryField: 'name', series: [{ field: 'amount' }] } }
  ] }];
  await show(page, document);
  await page.getByRole('button', { name: '配置取值', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('详情趋势', { exact: true })).toBeVisible();
  await expect(dialog.getByText('详情对比', { exact: true })).toBeVisible();
  await expect(dialog.locator('.echart canvas')).toHaveCount(2);
  expect(await dialog.locator('.echart canvas').evaluateAll(canvases => canvases.every(canvas => canvas.getBoundingClientRect().height >= 200))).toBe(true);
  await dialog.getByText('详情对比', { exact: true }).scrollIntoViewIfNeeded();
  await expect(dialog.getByText('详情对比', { exact: true })).toBeInViewport();
});

for (const container of ['plain', 'card'] as const) test(`${container}: loading/empty/error/ready keep configured components identifiable`, async ({ page }) => {
  await page.goto('/examples/inline.html');
  const document = scalarPage([
    { id: 'trend', type: 'lineChart', layout: { span: 12 }, data: { main: 'values' }, props: { title: '趋势标题', xField: 'name', series: [{ field: 'amount' }] } },
    { id: 'ranking', type: 'rankingCard', layout: { span: 12 }, data: { main: 'values' }, props: { title: '排行标题', nameField: 'name', valueField: 'amount' } },
    { id: 'table', type: 'table', layout: { span: 12 }, data: { main: 'values' }, props: { title: '明细标题', columns: [{ field: 'name', title: '配置列头' }] } }
  ]);
  document.sections[0]!.container = container;
  const source = { fields: {
    name: { queryField: 'name', type: 'string', role: 'dimension' }, amount: { queryField: 'amount', type: 'number', role: 'measure' }
  }, source: { type: 'query', query: { language: 'dqe', body: { dsl_list: [{ output_dims: ['name'], output_metrics: ['amount'] }] } } } };
  const serializedDocument = JSON.stringify({ ...document, dataSources: { values: source } });
  for (const mode of ['loading', 'empty', 'error', 'ready'] as const) {
    await page.evaluate(({ serializedDocument, mode }) => {
      window.runtime.destroy();
      window.runtime = MetricCanvas.mount('#dashboard', { document: JSON.parse(serializedDocument), dataGateway: { fetchData: async () => {
        if (mode === 'loading') await new Promise(() => {});
        if (mode === 'error') throw Object.assign(new Error('查询连接不可用'), { code: 'DQE_TRANSPORT_ERROR' });
        return { rows: mode === 'ready' ? [{ name: '配置取值', amount: 65 }] : [], totalCount: mode === 'ready' ? 1 : 0 };
      } } });
    }, { serializedDocument, mode });
    for (const title of ['趋势标题', '排行标题', '明细标题']) await expect(page.getByText(title, { exact: true })).toBeVisible();
    if (mode === 'loading') {
      expect(await page.locator('.skeleton').evaluateAll(items => items.length === 3 && items.every(item => item.getBoundingClientRect().height >= 72))).toBe(true);
    } else if (mode === 'error') {
      await expect(page.getByRole('alert')).toHaveCount(3);
      await expect(page.getByRole('alert').first()).toContainText('DQE_TRANSPORT_ERROR');
    } else {
      await expect(page.getByText('配置列头', { exact: true })).toBeVisible();
      expect(await page.locator('.echart canvas').evaluateAll(canvases => canvases.length === 1 && canvases.every(canvas => canvas.getBoundingClientRect().height >= 30))).toBe(true);
      if (mode === 'ready') await expect(page.locator('.ranking-card')).toContainText('配置取值');
    }
  }
});
