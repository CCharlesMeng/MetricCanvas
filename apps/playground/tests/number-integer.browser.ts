import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/number-precision-five.json', import.meta.url), 'utf8'));

test('number-0 rounds table values, field defaults, metrics and chart labels', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  await page.goto(`/pages/${fixture.id}`);
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(14);
  for (const [index, expected] of [
    [0, ['1234.4', '1234', '1234']], [1, ['-1234.5', '-1235', '-1235']],
    [2, ['1234.5', '1235', '1235']], [6, ['0.4', '0', '0']],
    [7, ['-0.4', '0', '0']], [13, ['--', '--', '--']]
  ] as const) {
    await expect(rows.nth(index).locator('td:nth-child(n+8)')).toHaveText([...expected]);
  }
  await expect(page.getByText('整数格式（合成数据）目标：13', { exact: true })).toBeVisible();
  await expect(page.locator('.row-value').last()).toHaveText('1234');
  await expect(page.locator('.bar-chart').last()).toBeVisible();
  const chart = page.locator('.bar-chart .echart').last();
  await expect(chart).toHaveAttribute('_echarts_instance_', /.+/);
  const labels = await chart.evaluate(async element => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => /\/echarts-runtime\.ts(?:\?|$)/.test(name));
    if (!url) throw Error('ECharts module not loaded');
    const instance = (await import(url)).getInstanceByDom(element);
    const option = instance.getOption();
    return option.series[0].data.slice(0, 4).map((item: { value: number }, dataIndex: number) => option.series[0].label.formatter({ value: item.value, dataIndex }));
  });
  expect(labels).toEqual(['1234', '-1235', '1235', '10']);
  expect(errors).toEqual([]);
});
