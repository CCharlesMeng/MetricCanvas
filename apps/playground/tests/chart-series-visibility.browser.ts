import { expect, test, type Locator } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { closeSelection, openSelection } from '../../../packages/embed/tests/browser/selection-actions';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/chart/chart-series-visibility.json', import.meta.url), 'utf8'));

async function chartState(chart: Locator) {
  return chart.evaluate(async element => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => /\/echarts\.js(?:\?|$)/.test(name));
    if (!url) throw Error('ECharts module not loaded');
    const echarts = await import(url);
    const instance = echarts.getInstanceByDom(element);
    const option = instance.getOption();
    return {
      series: option.series.map((item: { name: string; type: string; data: unknown[]; itemStyle?: object; lineStyle?: object }) => ({
        name: item.name, type: item.type, data: item.data, itemStyle: item.itemStyle, lineStyle: item.lineStyle
      })),
      legend: option.legend[0]?.data,
      axes: option.yAxis.map((axis: { show: boolean; name: string }) => ({ show: axis.show, name: axis.name }))
    };
  });
}

test('top filters remove and restore the actual series, legend, tooltip and unused axis', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`/pages/${fixture.id}`);
  const mixed = page.locator('[data-component="charts/mixed"] .echart');
  const single = page.locator('[data-component="charts/rate-only"] .echart');
  await expect(mixed).toHaveAttribute('_echarts_instance_', /.+/);
  const before = await chartState(mixed);
  expect(before.series.map((series: { name: string }) => series.name)).toEqual(['销售额', '目标额', '达成率']);
  await mixed.hover({ position: { x: 150, y: 100 } });
  await expect(mixed.getByText('达成率', { exact: true })).toBeVisible();
  await page.mouse.move(0, 0);
  await page.screenshot({ path: info.outputPath('series-visible.png'), fullPage: true });

  const checkbox = page.getByRole('checkbox', { name: '显示达成率', exact: true });
  await checkbox.uncheck();
  await expect.poll(async () => (await chartState(mixed)).series.length).toBe(2);
  const hidden = await chartState(mixed);
  expect(hidden.legend).toEqual(['销售额', '目标额']);
  expect(hidden.axes[1]).toEqual({ show: false, name: '' });
  expect(hidden.series).toEqual(before.series.slice(0, 2));
  expect((await chartState(single)).series).toEqual([]);
  await expect(page.getByText('单系列对照：隐藏后保留标题', { exact: true })).toBeVisible();
  await mixed.hover({ position: { x: 150, y: 100 } });
  await expect(mixed.getByText('销售额', { exact: true })).toBeVisible();
  await expect(mixed.getByText('达成率', { exact: true })).toHaveCount(0);
  await page.mouse.move(0, 0);
  await page.screenshot({ path: info.outputPath('series-hidden.png'), fullPage: true });

  await checkbox.check();
  await expect.poll(async () => (await chartState(mixed)).series.length).toBe(3);
  const scope = page.locator('[data-filter-id="scope"]');
  await openSelection(scope);
  await scope.getByRole('option', { name: '全球', exact: true }).click();
  await closeSelection(scope);
  await expect.poll(async () => (await chartState(mixed)).series.length).toBe(2);
  await openSelection(scope);
  await scope.getByRole('option', { name: '代表处', exact: true }).click();
  await closeSelection(scope);
  await expect.poll(async () => (await chartState(mixed)).series.length).toBe(3);
  expect((await chartState(mixed)).series).toEqual(before.series);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('series-narrow.png'), fullPage: true });
  expect(errors).toEqual([]);
});
