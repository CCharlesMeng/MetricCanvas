import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';

const ExcelJS: typeof import('../../../packages/engine/node_modules/exceljs') = createRequire(import.meta.url)('../../../packages/engine/node_modules/exceljs');

test('defaults to grouping and explicitly opts out across table, metric, chart, title and XLSX', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  await page.goto('/pages/number-default-grouping');
  await expect(page.getByText('默认千分位（合成数据）年份 2026', { exact: true })).toBeVisible();
  const rows = page.locator('table').first().locator('tbody tr');
  await expect(rows).toHaveCount(5);
  await expect(rows.first().locator('td')).toHaveText([
    '正数', '12,345.6789012345', '12,345.6789012345', '12,346', '12,345.68', '12,345.6789',
    '12,345.679', '+12,345.68', '12345.6789012345', '12346', '12345.68', '12345.6789', '+12345.68', '12345.68'
  ]);
  await expect(rows.nth(4).locator('td:not(:first-child)')).toHaveText(Array(13).fill('—'));
  await expect(page.locator('.metric-card .row-value')).toHaveText(['12,345.68', '12345.68', '12345.68']);
  const charts = page.locator('.bar-chart .echart');
  await expect(charts).toHaveCount(3);
  for (const [index, expected] of ['12,345.68', '12345.68', '12345.68'].entries()) {
    await expect(charts.nth(index)).toHaveAttribute('_echarts_instance_', /.+/);
    const text = await charts.nth(index).evaluate(async element => {
      const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => /\/echarts-runtime\.ts(?:\?|$)/.test(name));
      if (!url) throw Error('ECharts module not loaded');
      const option = (await import(url)).getInstanceByDom(element).getOption();
      const value = option.series[0].data[0].value ?? option.series[0].data[0];
      return [option.yAxis[0].axisLabel.formatter(value), option.series[0].label.formatter({ value }), option.series[0].tooltip.valueFormatter(value)];
    });
    expect(text).toEqual([expected, expected, expected]);
  }
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出', exact: true }).first().click();
  const download = await pending;
  const book = new ExcelJS.Workbook(); await book.xlsx.readFile((await download.path())!);
  const sheet = book.worksheets[0]!;
  for (let column = 2; column <= 14; column++) {
    expect(sheet.getCell(2, column).type).toBe(ExcelJS.ValueType.Number);
    expect(sheet.getCell(2, column).value).toBe(12345.6789012345);
  }
  expect(sheet.getCell(2, 5).numFmt).toBe('#,##0.##;-#,##0.##;0');
  expect(sheet.getCell(2, 11).numFmt).toBe('0.##;-0.##;0');
  expect(errors).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('number-grouping.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(rows.first().locator('td').nth(10)).toHaveText('12345.68');
  await page.screenshot({ path: testInfo.outputPath('number-grouping-narrow.png'), fullPage: true });
});

for (const id of ['report-layout-patterns-1026', 'service-operations-report-202609-qtlle05j']) {
  test(`stored report ${id} renders grouped values without changing its JSON`, async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/pages/${id}`);
    await expect(page.getByText('1,200', { exact: true }).first()).toBeVisible();
    await expect(page.locator('table').first()).toBeVisible();
    expect(errors).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`${id}.png`), fullPage: true });
  });
}
