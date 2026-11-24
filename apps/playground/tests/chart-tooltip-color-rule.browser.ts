import { expect, test, type Locator } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const route = '/pages/chart-tooltip-color-rule';
const runtimeUrl = '/@fs' + fileURLToPath(new URL('../../../packages/engine/widgets/src/shared/echarts-runtime.ts', import.meta.url));
const green = 'rgb(82, 196, 26)';
const red = 'rgb(245, 34, 45)';

async function hoverMonth(chart: Locator, month: string) {
  const plot = chart.locator('[_echarts_instance_]');
  const x = await plot.evaluate(async (element, { url, month }) => {
    const echarts = await import(url);
    const instance = echarts.getInstanceByDom(element);
    return instance.convertToPixel({ xAxisIndex: 0 }, month) as number;
  }, { url: runtimeUrl, month });
  await plot.hover({ position: { x: x + 1, y: 105 } });
  const tooltip = chart.getByRole('tooltip');
  await expect(tooltip).toContainText(month);
  return tooltip;
}

function value(tooltip: Locator, label: string) {
  return tooltip.locator(':scope > div').filter({ hasText: label }).locator('[data-tooltip-value]');
}

test('bar tooltip keeps color rules with series when rendering order changes', async ({ page }) => {
  await page.goto(route);
  const chart = page.locator('[data-component="charts/bar"]');
  const january = await hoverMonth(chart, '1 月');
  await expect(value(january, '同比')).toHaveText('+8.5%');
  await expect(value(january, '同比')).toHaveCSS('color', green);
  await expect(value(january, '环比')).toHaveText('-3.2%');
  await expect(value(january, '环比')).toHaveCSS('color', green);
  const february = await hoverMonth(chart, '2 月');
  await expect(value(february, '同比')).toHaveCSS('color', red);
  await expect(value(february, '环比')).toHaveCSS('color', red);
});

test('line tooltip follows signed rounding, fixed zero and custom missing text', async ({ page }) => {
  await page.goto(route);
  const chart = page.locator('[data-component="charts/line"]');
  const january = await hoverMonth(chart, '1 月');
  await expect(value(january, '占比变化')).toHaveText('0P');
  await expect(value(january, '占比变化')).not.toHaveCSS('color', green);
  const march = await hoverMonth(chart, '3 月');
  await expect(value(march, '同比')).toHaveText('0%');
  await expect(value(march, '同比')).not.toHaveCSS('color', red);
  await expect(value(march, '同比')).not.toHaveCSS('color', green);
  await expect(value(march, '环比')).toHaveText('0%');
  await expect(value(march, '环比')).toHaveCSS('color', red);
  const april = await hoverMonth(chart, '4 月');
  await expect(value(april, '同比')).toHaveText('暂无同比');
  await expect(value(april, '同比')).not.toHaveCSS('color', red);
});

test('mixed tooltip colors the line value alongside the bar value and its unit', async ({ page }) => {
  await page.goto(route);
  const chart = page.locator('[data-component="charts/mixed"]');
  const january = await hoverMonth(chart, '1 月');
  await expect(value(january, '客户数')).toHaveText('20 家');
  await expect(value(january, '客户数')).not.toHaveCSS('color', green);
  await expect(value(january, '同比')).toHaveText('+8.5%');
  await expect(value(january, '同比')).toHaveCSS('color', green);
});
