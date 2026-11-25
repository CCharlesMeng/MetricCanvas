import { expect, test, type Locator, type Route } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const charts = '/@fs' + fileURLToPath(new URL('../../../packages/engine/widgets/src/shared/echarts-runtime.ts', import.meta.url));
const region = '欧洲地区部';
const mapDisplayName = '欧洲';
const metrics: Record<string, number> = {
  '净商务折扣（原价）': 36.4,
  '净商务折扣（原价）年变化': -1.2,
  '净付费金额': 1_250_000,
  '净付费金额年同比': 8.4,
  '框架执行率': 74.6,
  '区域结算价毛利率(付费口径)': 18.5,
  '测算销毛率': 13.5
};
interface DqeItem { output_dims?: string[]; output_metrics?: string[] }

function delayFor(item: DqeItem): 'discount' | 'margin' | undefined {
  if (!item.output_dims?.includes('地区部')) return;
  const fields = item.output_metrics ?? [];
  if (fields.includes('净商务折扣（原价）')) return 'discount';
  if (fields.includes('区域结算价毛利率(付费口径)') || fields.includes('测算销毛率')) return 'margin';
}

function syntheticResult(item: DqeItem) {
  const dimensions = (item.output_dims ?? []).map(field => [field, field === '代表处' ? '德国代表处' : region]);
  const measures = (item.output_metrics ?? []).map(field => [field, metrics[field] ?? 10]);
  return { code: 'SUCCESS', data: [Object.fromEntries([...dimensions, ...measures])], total_count: 1 };
}

function mapPoint(chart: Locator) {
  return chart.evaluate(async (element, { url, name }) => {
    const echarts = await import(url);
    const instance = echarts.getInstanceByDom(element);
    const option = instance?.getOption();
    const series = option?.series?.[1];
    const row = series?.data.find((item: { name: string }) => item.name === name);
    if (!row) return;
    const point = instance.convertToPixel({ geoIndex: 0 }, row.value.slice(0, 2)) as [number, number];
    return {
      label: series.label.formatter({name}),
      metricLabel: series.label.rich?.metric,
      value: row.value[2] as number | null,
      coloredAreas: option.series[0].data.filter((item: { value?: number }) => Number.isFinite(item.value)).length,
      x: point[0],
      y: point[1] + (series.symbolOffset?.[1] ?? 0)
    };
  }, {url: charts, name: region});
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return {promise, resolve};
}

test('合同商务地图先显示点位，再显示折扣和同一组织的四行提示', async ({ page }, info) => {
  test.setTimeout(45_000);
  const discount = deferred();
  const margin = deferred();
  const gates = {discount, margin};
  const pending = new Set<string>();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  async function respond(route: Route) {
    const items: DqeItem[] = route.request().postDataJSON().dsl_list;
    for (const item of items) {
      const delay = delayFor(item);
      if (!delay) continue;
      pending.add(delay);
      await gates[delay].promise;
      pending.delete(delay);
    }
    await route.fulfill({ json: {retCode: 'CBC.0000', results: items.map(syntheticResult)} });
  }
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', respond);
  try {
    await page.setViewportSize({width: 1600, height: 950});
    await page.goto('/pages/contract-business-overview?mapLabels=short');
    const chart = page.locator('[data-component="overview-content/world-map"] [_echarts_instance_]');
    const table = page.locator('[data-component="overview-content/global-overview-table"]');
    const card = page.locator('[data-component="overview-content/discount-card-overview"]');
    await expect(chart).toBeVisible({timeout: 15_000});
    await expect.poll(() => mapPoint(chart)).toMatchObject({label: mapDisplayName, value: null, coloredAreas: 0});
    expect(pending).toEqual(new Set(['discount', 'margin']));
    await expect(table.getByText(region, {exact: true})).toBeVisible();
    const heading = page.locator('[data-map-tooltip-heading]');
    const rows = page.locator('[data-map-tooltip-row]');
    await hoverPoint(chart);
    await expect(heading).toHaveText(mapDisplayName);
    await expect(rows.nth(2)).toHaveText(/框架执行率\s+74\.6%/);
    await expect(rows.first()).toHaveText(/净商务折扣\s+—\s*同比\s+—/);

    discount.resolve();
    await expect.poll(() => mapPoint(chart)).toMatchObject({
      label: `${mapDisplayName} {metric|36.4%}`, value: 36.4, metricLabel: {fontWeight: 'bold', color: '#000'}
    });
    await expect(card.locator('.change-label')).toHaveText('同比');
    await expect(card.locator('.change-value')).toHaveText('-1.2P');
    await expect(card.locator('.change-value')).toHaveCSS('color', 'rgb(245, 34, 45)');
    await expect(card.locator('.row-value')).toHaveCSS('color', 'rgb(0, 0, 0)');
    await expect(card.locator('.row-value')).toHaveCSS('font-weight', '700');
    expect(pending.has('margin')).toBe(true);
    await page.mouse.move(5, 5);
    await hoverPoint(chart);
    await expect(heading).toHaveText(mapDisplayName);
    await expect(heading).toHaveCSS('font-size', '18px');
    await expect(heading.locator('..')).toHaveCSS('border-top-width', '0px');
    await expect(rows).toHaveText([
      /净商务折扣\s+36\.4%\s*同比\s+-1\.2/,
      /净付费金额\s+.*同比\s+\+?8\.4%/,
      /框架执行率\s+74\.6%/,
      /测算销毛与核算销毛偏差\s+—/
    ]);
    await expect(rows.first().locator('b')).toHaveCount(2);
    await expect(rows.first().locator('b').nth(0)).toHaveCSS('color', 'rgb(0, 0, 0)');
    await expect(rows.first().locator('b').nth(0)).toHaveCSS('font-weight', '700');
    await expect(rows.first().locator('b').nth(1)).toHaveCSS('color', 'rgb(245, 34, 45)');
    await expect(rows.nth(1).locator('b').nth(1)).toHaveCSS('color', 'rgb(82, 196, 26)');

    margin.resolve();
    await expect(table.getByText('+5P', {exact: true})).toBeVisible();
    await page.mouse.move(5, 5);
    await hoverPoint(chart);
    await expect(rows.last()).toHaveText(/测算销毛与核算销毛偏差\s+\+5P/);
    await expect(rows.last().locator('b')).toHaveCSS('color', 'rgb(82, 196, 26)');
    await page.screenshot({path: info.outputPath('contract-overview-map-tooltip.png')});
    expect(errors).toEqual([]);
  } finally {
    discount.resolve();
    margin.resolve();
  }
});

async function hoverPoint(chart: Locator) {
  const point = (await mapPoint(chart))!;
  await chart.hover({position: {x: point.x, y: point.y}});
}
