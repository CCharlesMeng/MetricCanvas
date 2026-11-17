import { expect, test, type Locator } from '@playwright/test';

async function axes(chart: Locator, horizontal = false) {
  return chart.evaluate(async (element, horizontal) => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => /\/echarts-runtime\.ts(?:\?|$)/.test(name));
    if (!url) throw Error('ECharts module not loaded');
    const echarts = await import(url);
    const option = echarts.getInstanceByDom(element).getOption();
    return (horizontal ? option.xAxis : option.yAxis).map((axis: { name: string; show: boolean; nameLocation: string; nameRotate: number; axisLabel: { formatter: string | ((value: number) => string) } }) => ({
      name: axis.name, show: axis.show, location: axis.nameLocation, rotate: axis.nameRotate,
      tick: typeof axis.axisLabel.formatter === 'string' ? axis.axisLabel.formatter.replace('{value}', '5000') : axis.axisLabel.formatter(5000)
    }));
  }, horizontal);
}

async function horizontalUnitFits(chart: Locator) {
  return chart.evaluate(async element => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => /\/echarts-runtime\.ts(?:\?|$)/.test(name));
    if (!url) throw Error('ECharts module not loaded');
    const echarts = await import(url);
    const instance = echarts.getInstanceByDom(element);
    const text = instance.getZr().storage.getDisplayList().find((item: { style?: { text?: string } }) => item.style?.text === 'GB/s');
    if (!text) return false;
    const rect = text.getBoundingRect().clone();
    rect.applyTransform(text.transform);
    return rect.x >= 0 && rect.x + rect.width <= element.clientWidth;
  });
}

async function unitAlignment(chart: Locator) {
  return chart.evaluate(async element => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => /\/echarts-runtime\.ts(?:\?|$)/.test(name));
    if (!url) throw Error('ECharts module not loaded');
    const echarts = await import(url);
    const instance = echarts.getInstanceByDom(element);
    const texts = instance.getZr().storage.getDisplayList().filter((item: { type: string }) => item.type === 'tspan');
    const bounds = (item: (typeof texts)[number]) => {
      const rect = item.getBoundingRect().clone();
      rect.applyTransform(item.transform);
      return rect;
    };
    const units = texts.filter((item: { style: { text: string } }) => item.style.text === '人').map(bounds).sort((a: { x: number }, b: { x: number }) => a.x - b.x);
    const ticks = texts.filter((item: { style: { text: string } }) => /^-?\d+(\.\d+)?$/.test(item.style.text)).map(bounds).sort((a: { x: number }, b: { x: number }) => a.x - b.x);
    return Math.max(Math.abs(units[0].x + units[0].width - ticks[0].x - ticks[0].width),
      Math.abs(units[1].x - ticks.at(-1).x));
  });
}

test('numeric axes share unit placement, scale, visibility and explicit override behavior', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => performance.setResourceTimingBufferSize(10000));
  await page.goto('/pages/chart-axis-unit');
  for (const [id, names, tick] of [
    ['duration', ['天'], '5000'], ['count', ['万人'], '0.5'],
    ['mixed', ['万元', undefined], '0.5'], ['bytes', ['GB/s'], '4.88'],
    ['baseline', ['人', '人'], '5000'], ['override', ['定制天数'], '5000 天']
  ] as const) {
    const chart = page.locator(`[data-component="charts/${id}"] .echart`);
    await expect(chart).toHaveAttribute('_echarts_instance_', /.+/);
    const state = await axes(chart, id === 'bytes');
    expect(state.map((axis: { name: string }) => axis.name)).toEqual(names);
    expect(state[0]).toMatchObject({ location: 'end', rotate: 0, tick });
  }
  const baseline = page.locator('[data-component="charts/baseline"] .echart');
  await expect.poll(() => unitAlignment(baseline)).toBeLessThan(0.5);
  const mixed = page.locator('[data-component="charts/mixed"] .echart');
  expect((await axes(mixed))[1].tick).toBe('5000%');
  await expect.poll(() => horizontalUnitFits(page.locator('[data-component="charts/bytes"] .echart'))).toBe(true);
  await page.screenshot({ path: info.outputPath('axis-units-desktop.png'), fullPage: true });
  await page.getByRole('checkbox', { name: '显示闭环率', exact: true }).uncheck();
  await expect.poll(async () => (await axes(mixed))[1].show).toBe(false);
  expect((await axes(mixed))[1].name).toBe('');
  await page.getByRole('checkbox', { name: '显示闭环率', exact: true }).check();
  await expect.poll(async () => (await axes(mixed))[1].show).not.toBe(false);
  expect((await axes(mixed))[1]).toMatchObject({ name: undefined, tick: '5000%' });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect.poll(() => horizontalUnitFits(page.locator('[data-component="charts/bytes"] .echart'))).toBe(true);
  await expect.poll(() => unitAlignment(baseline)).toBeLessThan(0.5);
  await page.screenshot({ path: info.outputPath('axis-units-mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});
