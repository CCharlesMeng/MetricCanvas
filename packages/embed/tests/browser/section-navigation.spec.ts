import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';

test('two query-backed instances keep selection isolated and reuse data across group changes', async ({ page }) => {
  await page.goto('/pages/ioc-content-navigation');
  await page.evaluate(() => {
    const document = structuredClone(window.pageDocument);
    for (const field of Object.values(document.dataSources.rows.fields) as Array<Record<string, unknown>>) {
      field.queryField = field.role === 'dimension' ? 'name' : 'amount';
    }
    document.dataSources.rows.source = { type: 'query', resultScope: 'complete', query: { language: 'dqe',
      body: { dsl_list: [{ output_dims: ['name'], output_metrics: ['amount'], filter: { dims: [], metrics: [] }, order: {} }] } } };
    document.sections[1].components[0].props.columns[0].filterable = { mode: 'select' };
    window.runtime.destroy();
    window.queryCalls = [];
    const gateway = { async fetchData() {
      window.queryCalls.push({});
      return { rows: Array.from({ length: 25 }, (_, i) => ({ name: `客户${i + 1}`, amount: i + 1 })), totalCount: 25 };
    } };
    window.runtime = MetricCanvas.mount('#dashboard', { document, dataGateway: gateway });
    const second = window.document.createElement('main'); second.id = 'second'; window.document.body.append(second);
    window.queryRuntime = MetricCanvas.mount(second, { document, dataGateway: gateway });
  });
  const first = page.locator('#dashboard [data-metriccanvas-runtime]');
  const second = page.locator('#second [data-metriccanvas-runtime]');
  await expect(first.locator('[data-section-id="a"] tbody tr')).toHaveCount(10);
  await expect(second.locator('[data-section-id="a"] tbody tr')).toHaveCount(10);
  expect(await page.evaluate(() => window.queryCalls.length)).toBe(2);
  await page.evaluate(() => {
    const document = structuredClone(window.pageDocument);
    document.params = [{ id: 'entry-group', type: 'string', default: 'b' }];
    document.sectionGroupParam = 'entry-group';
    window.queryRuntime.update({ document });
  });
  await expect(second.locator('[data-section-id="b"]')).toBeVisible();
  await expect(first.locator('[data-section-id="a"]')).toBeVisible();
  const a = first.locator('[data-section-id="a"]');
  await a.locator('summary[title="表头筛选"]').click();
  await a.getByRole('checkbox', { name: '客户21', exact: true }).check();
  await first.locator('[data-section-group="b"]').click();
  await expect(second.locator('[data-section-id="a"]')).toBeHidden();
  await expect(second.locator('[data-section-id="b"]')).toBeVisible();
  await first.locator('[data-section-group="a"]').click();
  await expect(a.getByRole('checkbox', { name: '客户21', exact: true })).toBeChecked();
  await expect(a.locator('tbody tr')).toHaveCount(1);
  await first.locator('[data-section-anchor="b"]').click();
  await expect(first.locator('[data-section-id="b"]')).toBeFocused();
  await expect(second.locator('[data-section-id="b"]')).toBeVisible();
  expect(await page.evaluate(() => window.queryCalls.length)).toBe(2);
});

test('content groups retain table state; search resets hidden tables; anchors remain within the instance', async ({ page }) => {
  let queries = 0;
  page.on('request', request => { if (request.method() === 'POST') queries++; });
  await page.goto('/pages/ioc-content-navigation');
  const host = page.locator('[data-metriccanvas-runtime]');
  const a = host.locator('[data-section-id="a"]');
  const b = host.locator('[data-section-id="b"]');
  await expect(a).toBeVisible();
  await expect(b).toBeHidden();
  await a.locator('.sort-toggle').click();
  await a.getByRole('button', { name: '下一页' }).click();
  await expect(a).toContainText('第 2 页');
  await host.locator('[data-section-group="b"]').click();
  await b.getByRole('button', { name: '下一页' }).click();
  await host.locator('[data-section-group="a"]').click();
  await expect(a).toContainText('第 2 页');
  await expect(a.locator('[aria-label="排序:asc"]')).toBeVisible();
  await host.locator('input[type="search"]').fill('客户21');
  await expect(a).toContainText('客户21');
  await expect(a.locator('.total')).toHaveText(/总条数：\s*1/);
  const before = await page.evaluate(() => ({ url: location.href, history: history.length }));
  await host.locator('[data-section-anchor="b"]').focus();
  await page.keyboard.press('Enter');
  await expect(b).toBeVisible();
  await expect(a).toBeHidden();
  await expect(b).toBeFocused();
  await expect(b).toContainText('客户21');
  await expect(b.locator('.total')).toHaveText(/总条数：\s*1/);
  expect(await page.evaluate(() => ({ url: location.href, history: history.length }))).toEqual(before);
  expect(queries).toBe(0);
  await page.setViewportSize({ width: 375, height: 800 });
  expect(await host.locator('.section-navigation').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.evaluate(() => {
    const document = structuredClone(window.pageDocument);
    for (const group of document.sectionGroups) group.label += '较长标签验证内容导航换行且不遮挡其他入口';
    window.runtime.update({ document });
  });
  const buttons = host.locator('.section-navigation button');
  await expect(buttons).toHaveCount(3);
  const geometry = await buttons.evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
      clipped: element.scrollWidth > element.clientWidth || element.scrollHeight > element.clientHeight };
  }));
  expect(geometry.every(box => !box.clipped && box.x >= 0 && box.right <= 375)).toBe(true);
  for (let i = 0; i < geometry.length; i++) for (let j = i + 1; j < geometry.length; j++) {
    const a = geometry[i], b = geometry[j];
    expect(a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y).toBe(true);
  }
  const factsPath = test.info().outputPath('navigation-facts.json');
  writeFileSync(factsPath, JSON.stringify({ viewport: { width: 375, height: 800 }, geometry,
    browser: page.context().browser()?.version(),
    runtime: await host.locator('.section-navigation').evaluate(element => ({ dpr: window.devicePixelRatio,
      font: getComputedStyle(element).font, labels: Array.from(element.querySelectorAll('button')).map(button => button.textContent),
      scrollWidth: element.scrollWidth, clientWidth: element.clientWidth,
      gap: getComputedStyle(element).gap, flexWrap: getComputedStyle(element).flexWrap })) }, null, 2));
  await test.info().attach('navigation-facts', { path: factsPath, contentType: 'application/json' });
  await page.goto('/examples/inline.html');
  await expect(host.locator('.section-navigation')).toHaveCount(0);
  await expect(host.locator('[data-section-id="main"]')).toBeVisible();
});
