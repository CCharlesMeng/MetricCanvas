import { expect, test, type Locator } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const runtimeUrl = '/@fs' + fileURLToPath(new URL('../../../packages/engine/widgets/src/shared/echarts-runtime.ts', import.meta.url));

function chartState(chart: Locator, name?: string) {
  return chart.evaluate(async (element, { url, name }) => {
    const echarts = await import(url);
    const instance = echarts.getInstanceByDom(element);
    const option = instance.getOption();
    const symbol = option.series[1].data.find((item: { name: string }) => item.name === name);
    return {
      point: symbol?.value,
      areas: option.series[0].data.filter((item:{value?:unknown})=>typeof item.value === 'number' && Number.isFinite(item.value)),
      zoom: option.geo[0].zoom,
      center: option.geo[0].center,
      position: symbol ? instance.convertToPixel({ geoIndex: 0 }, symbol.value.slice(0, 2)) as [number, number] : undefined
    };
  }, { url: runtimeUrl, name });
}

async function clickPoint(chart: Locator, name: string) {
  await expect.poll(async () => (await chartState(chart, name)).position).toBeDefined();
  const [x, y] = (await chartState(chart, name)).position!;
  await chart.click({ position: { x, y } });
}

test('共享结果行驱动地图点，点击切换页头 Region 和列表', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/pages/ioc-region-map-demo');
  const header = page.locator('[data-filter-id="region"]');
  const trigger = header.getByRole('button', { name: '区域', exact: true });
  const global = page.locator('[data-component="global-overview/world-map"] [_echarts_instance_]');
  const overseas = page.locator('[data-component="regional-overview/regional-map"] [_echarts_instance_]');
  const table = page.getByRole('table');
  await expect(trigger).toHaveText('全球');
  await expect.poll(() => chartState(global,'欧洲地区部')).toMatchObject({point:[21,52.13,38.5]});
  const initial = await chartState(global, '拉美地区部');
  expect(initial.areas).toEqual(expect.arrayContaining([expect.objectContaining({name:'Brazil',value:44.1}),expect.objectContaining({name:'Argentina',value:44.1})]));
  await clickPoint(global, '欧洲地区部');
  await expect(trigger).toHaveText('欧洲地区部');
  await expect(table.getByText('法国代表处', { exact: true })).toBeVisible();
  await expect.poll(() => chartState(overseas)).toMatchObject({ center: [20.7129, 60.166], zoom: 6.4 });

  await clickPoint(overseas, '德国代表处');
  await expect(trigger).toHaveText('德国代表处');
  await expect(table.getByText('德国代表处', { exact: true })).toBeVisible();
  await expect(table.getByText('法国代表处', { exact: true })).toHaveCount(0);

  await trigger.click();
  await header.getByRole('tree').getByText('全球', { exact: true }).click();
  await expect(global).toBeVisible();
  await expect.poll(async () => (await chartState(global)).zoom).toBe(1);
  await expect(table.getByText('欧洲地区部', { exact: true })).toBeVisible();
});
