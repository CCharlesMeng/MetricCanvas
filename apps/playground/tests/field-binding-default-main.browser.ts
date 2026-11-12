import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = JSON.parse(readFileSync(new URL('../../../pages/capabilities/data/number-precision-five.json', import.meta.url), 'utf8'));

test('object bindings use main across single and multi-source tables, cards and charts', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const labels: string[] = [];
    Object.assign(window, { bindingChartLabels: labels });
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (...args) {
      labels.push(args[0]);
      return fillText.apply(this, args);
    };
  });
  await page.goto(`/pages/${fixture.id}`);
  const tables = page.locator('table').filter({ hasText: '省略槽名' });
  await expect(tables).toHaveCount(2);
  for (const [index, expected] of [
    ['正数', '+1.23', '+1.23'], ['负数', '-1.23', '-1.23'], ['舍入零', '0', '0'], ['缺失', '--', '--']
  ].entries()) {
    await expect(tables.nth(0).locator('tbody tr').nth(index).locator('td')).toHaveText(expected);
  }
  await expect(tables.nth(1).locator('tbody tr').nth(0).locator('td')).toHaveText(['正数', '+1.23', '+50']);
  await expect(tables.nth(1).locator('tbody tr').nth(3).locator('td')).toHaveText(['缺失', '--', '+53']);
  await expect(page.locator('.metric-card').filter({ hasText: '指标卡共享默认槽' })).toContainText('+1.23');
  await expect(page.locator('.bar-chart').filter({ hasText: '图表共享默认槽' })).toBeVisible();
  for (const label of ['+1.23', '-1.23', '0']) {
    await expect.poll(() => page.evaluate(() => Reflect.get(window, 'bindingChartLabels'))).toContain(label);
  }
  await page.screenshot({ path: testInfo.outputPath('wide.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(tables.nth(0)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('narrow.png'), fullPage: true });
  expect(errors).toEqual([]);
});
