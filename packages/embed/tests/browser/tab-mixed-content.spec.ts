import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const reportFixture = JSON.parse(await readFile(new URL('../../../../pages/capabilities/layout/tab-mixed-content-report.json', import.meta.url), 'utf8'));
const fixture = JSON.parse(await readFile(new URL('../../../../pages/capabilities/layout/tab-mixed-content.json', import.meta.url), 'utf8'));

for (const variant of ['compact', 'analysisStack']) test(`legacy ${variant}: full-width tables and retained hidden panels`, async ({ page }) => {
  await page.goto('/pages/tab-mixed-content');
  await expect(page.getByRole('tab', { name: '概览' })).toBeVisible();
  const legacy = structuredClone(fixture);
  legacy.schemaVersion = '6.31';
  const table = legacy.sections[0].components[0].props.tabs[1].components.find((item: any) => item.type === 'table');
  legacy.sections[0].components[0].props = { variant, tabs: ['a', 'b'].map(id => ({ id, label: `旧表${id}`, component: { ...table, id: `legacy-${id}`, layout: { span: 6 } } })) };
  // Remove unused chart controls from this table-only legacy page.
  legacy.filters = [];
  for (const data of Object.values(legacy.dataSources) as any[]) if (data.source.type === 'query') delete data.source.query.filterBindings;
  await page.evaluate(document => window.runtime.update({ document, dataGateway: MetricCanvas.createDqeGateway() }), legacy);
  await expect(page.getByRole('tab', { name: '旧表a' })).toBeVisible();
  await page.getByRole('tab', { name: '旧表b' }).click();
  await expect(page.locator('[data-tab-panel=a]')).toBeHidden();
  await expect(page.locator('[data-tab-panel=b]')).toBeVisible();
  await expect(page.locator('[data-tab-panel] .section-grid')).toHaveCount(0);
  const widths = await page.locator('[data-tab-panel=b]').evaluate(panel => ({ panel: panel.clientWidth - parseFloat(getComputedStyle(panel).paddingLeft) - parseFloat(getComputedStyle(panel).paddingRight), table: panel.querySelector('.table-widget')!.getBoundingClientRect().width }));
  expect(Math.abs(widths.panel - widths.table)).toBeLessThan(1);
});

for (const width of [1440, 390]) test(`${width}: mixed Tabs load on demand, keep content and restore URL`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 1000 });
  const requests: any[] = [], errors: string[] = [];
  page.on('request', request => { if (request.url().endsWith('/dsl/execute')) requests.push(...request.postDataJSON().dsl_list); });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/pages/tab-mixed-content?revision=keep');
  await expect(page.locator('.chart-semantics').first()).toContainText('国内');
  await expect.poll(() => requests.length).toBe(1);
  await expect(page.locator('[data-tab-panel=details]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /打开原图表演示/ })).toHaveAttribute('href', '/pages/chart-local-filter-page');
  const cardFrame = async (selector: string) => page.locator(selector).evaluate(element => {
    const style = getComputedStyle(element);
    return [style.borderTopWidth, style.borderTopStyle, style.borderTopColor, style.borderTopLeftRadius];
  });
  await expect.poll(() => cardFrame('[data-component-type=metricCard] > .widget-content > .metric-card')).toEqual(['1px', 'solid', 'rgba(0, 0, 0, 0.1)', '16px']);
  await expect.poll(() => cardFrame('.composite-card')).toEqual(['1px', 'solid', 'rgba(0, 0, 0, 0.1)', '16px']);
  expect((await cardFrame('.composite-card .metric-card'))[0]).toBe('0px');
  for (const card of await page.locator('[data-tab-panel=overview] .metric-card, [data-tab-panel=overview] .composite-card').all()) {
    expect((await card.boundingBox())!.height).toBeLessThan(180);
  }
  await page.screenshot({ path: info.outputPath(`tabs-overview-${width}.png`), fullPage: true });
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole('tab', { name: '明细', exact: true }).click();
  await expect(page.getByRole('tab', { name: '明细' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-tab-panel=details] canvas').first()).toBeVisible();
  await expect.poll(() => requests.length).toBe(2);
  await expect(page).toHaveURL(/tab.analysis=details/);
  expect(new URL(page.url()).searchParams.get('revision')).toBe('keep');
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  const input = page.getByRole('searchbox', { name: '表格搜索' });
  await input.fill('客户21'); await input.press('Enter');
  await expect(page.locator('tbody')).toContainText('客户21');
  await page.getByRole('tab', { name: '概览', exact: true }).click();
  await expect(page.locator('[data-tab-panel=details]')).toBeHidden();
  await page.getByRole('tab', { name: '明细', exact: true }).click();
  await expect(input).toHaveValue('客户21');
  expect(requests).toHaveLength(2);
  await page.getByRole('tab', { name: '概览', exact: true }).click();
  await page.getByRole('checkbox', { name: '仅国内', exact: true }).check();
  await expect.poll(() => requests.length).toBe(3);
  await page.getByRole('tab', { name: '明细', exact: true }).click();
  // The retained overseas local choice conflicts with the public domestic condition.
  await expect(page.locator('[data-tab-panel=details] .filter-group [aria-pressed=true]')).toContainText('海外');
  await expect(page.locator('[data-tab-panel=details]')).toContainText('收入趋势');
  expect(requests.filter(item => item.output_metrics.includes('chart_demo_revenue'))).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('tab', { name: '明细', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('checkbox', { name: '仅国内', exact: true })).toBeChecked();
  expect(await page.locator('body').evaluate(element => element.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: info.outputPath(`tabs-${width}.png`), fullPage: true });
});

test('AI generation continues across switching; Report export does not generate unseen summaries', async ({ page }, info) => {
  test.setTimeout(60_000);
  await page.goto('/pages/tab-mixed-content');
  await page.evaluate(document => {
    window.aiSummaryRequests = [];
    window.runtime.update({ document, dataGateway: MetricCanvas.createDqeGateway(), aiSummary: {
      generate: async (question, contextInfo) => {
        window.aiSummaryRequests.push({ question, contextInfo });
        await new Promise(resolve => setTimeout(resolve, 800));
        return '合成总结保留成功';
      }
    } });
  }, reportFixture);
  await page.getByRole('tab', { name: '明细', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.aiSummaryRequests.length)).toBe(1);
  await page.getByRole('tab', { name: '概览', exact: true }).click();
  await expect(page.locator('[data-tab-panel=details]')).toContainText('合成总结保留成功');
  await page.getByRole('tab', { name: '明细', exact: true }).click();
  await expect(page.getByText('合成总结保留成功')).toBeVisible();
  expect(await page.evaluate(() => window.aiSummaryRequests.length)).toBe(1);
  await page.screenshot({ path: info.outputPath('tabs-summary-retained.png'), fullPage: true });
  await page.evaluate(document => { window.runtime.destroy(); window.runtime = MetricCanvas.mount('#dashboard', {
    document, dataGateway: MetricCanvas.createDqeGateway(), aiSummary: { generate: async (question, contextInfo) => {
      window.aiSummaryRequests.push({ question, contextInfo });
      return '不应调用';
    } }
  }); }, reportFixture);
  await expect(page.getByRole('button', { name: '导出混合内容' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出混合内容' }).click();
  await (await download).saveAs(info.outputPath('mixed-tabs-report.png'));
  expect(await page.evaluate(() => window.aiSummaryRequests.length)).toBe(1);
});

test('metric frames follow white containers and keep composite children flat', async ({ page }) => {
  await page.goto('/pages/tab-mixed-content');
  await expect(page.getByRole('tab', { name: '概览' })).toBeVisible();
  for (const container of ['plain', 'card', 'panel']) {
    for (const variant of [undefined, 'compactSummary', 'dualSummary']) {
      const document = structuredClone(fixture);
      const metric = structuredClone(document.sections[0].components[0].props.tabs[0].components[0]);
      metric.props.variant = variant;
      if (variant === 'dualSummary') { metric.props.secondaryTitle = '对比'; metric.props.secondaryRows = metric.props.rows; }
      document.sections = [{ id: 'frames', title: '指标卡边界', container, components: [metric] }];
      await page.evaluate(document => window.runtime.update({ document, dataGateway: MetricCanvas.createDqeGateway() }), document);
      const frames = page.locator(variant ? '.metric-panel' : '.metric-card');
      await expect(frames.first()).toBeVisible();
      for (const frame of await frames.all()) {
        const style = await frame.evaluate(element => { const css = getComputedStyle(element); return { width: css.borderTopWidth, color: css.borderTopColor, radius: css.borderTopLeftRadius }; });
        expect(style.width).toBe(container === 'plain' ? '0px' : '1px');
        if (container !== 'plain') expect(style).toEqual({ width: '1px', color: 'rgba(0, 0, 0, 0.1)', radius: '16px' });
      }
    }
  }
});
