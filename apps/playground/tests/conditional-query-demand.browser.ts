import { expect, test, type Locator } from '@playwright/test';
import example from '../../../pages/capabilities/data/conditional-query-demand.json' with { type: 'json' };
import { closeSelection, openSelection } from '../../../packages/embed/tests/browser/selection-actions';

interface Item { output_dims?: string[]; output_metrics?: string[]; filter?: { dims?: {dim_name:string;dim_value_list:string[]}[] } }
async function seriesNames(chart: Locator) {
  return chart.evaluate(async element => {
    const resources = performance.getEntriesByType('resource').map(entry => entry.name);
    const url = resources.find(name => /\/(echarts-runtime\.ts|echarts_core\.js|echarts\.js)(?:\?|$)/.test(name));
    if (!url) throw Error(`ECharts module not loaded: ${resources.filter(name => name.includes('echarts')).join(',')}`);
    const echarts = await import(url);
    const option = echarts.getInstanceByDom(element)?.getOption();
    return (option?.series ?? []).map((series: {name?:string}) => series.name);
  });
}

test('table and chart visibility control real request outputs and recover current filters', async ({ page }, info) => {
  const requests: Item[] = [], errors: string[] = [];
  await page.addInitScript(() => performance.setResourceTimingBufferSize(5000));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const items: Item[] = route.request().postDataJSON().dsl_list;
    requests.push(...items);
    await route.fulfill({json:{retCode:'CBC.0000',results:items.map(item => ({code:'SUCCESS',total_count:1,data:[{
      name:'合成对象',...Object.fromEntries((item.output_metrics ?? []).map(field => [field,10]))
    }]}))}});
  });
  await page.goto(`/pages/${example.id}`);
  const table = page.getByRole('article').filter({has:page.getByRole('heading',{name:'列独占补充查询',exact:true})});
  const chart = page.getByRole('article').filter({has:page.getByRole('heading',{name:'系列共用查询',exact:true})}).locator('.echart');
  await expect(table.getByRole('columnheader',{name:'评分',exact:true})).toBeVisible();
  await expect(table.getByRole('cell',{name:'合成对象',exact:true})).toBeVisible();
  await expect.poll(() => requests.some(item => item.output_metrics?.includes('score'))).toBe(true);
  await expect(chart).toHaveAttribute('_echarts_instance_',/.+/);
  await expect.poll(() => seriesNames(chart)).toEqual(['销售额','达成率']);
  const checkbox = page.getByRole('checkbox',{name:'显示明细',exact:true});
  const beforeHide = requests.length;
  await checkbox.uncheck();
  await expect(table.getByRole('columnheader',{name:'评分',exact:true})).toHaveCount(0);
  await expect.poll(() => seriesNames(chart)).toEqual(['销售额']);
  await expect.poll(() => requests.length).toBeGreaterThan(beforeHide);
  expect(requests.slice(beforeHide).every(item => !item.output_metrics?.includes('score') && !item.output_metrics?.includes('rate'))).toBe(true);
  const beforeScope = requests.length;
  const scope = page.getByRole('group',{name:'合成范围',exact:true});
  await openSelection(scope);
  await scope.getByRole('option',{name:'合成范围B',exact:true}).click();
  await closeSelection(scope);
  await expect.poll(() => requests.length).toBeGreaterThan(beforeScope);
  expect(requests.slice(beforeScope).every(item => !item.output_metrics?.includes('score') && !item.output_metrics?.includes('rate'))).toBe(true);
  const beforeRestore = requests.length;
  await checkbox.check();
  await expect.poll(() => seriesNames(chart)).toEqual(['销售额','达成率']);
  await expect.poll(() => requests.slice(beforeRestore).some(item => item.output_metrics?.includes('score'))).toBe(true);
  for (const item of requests.slice(beforeRestore)) expect(item.filter?.dims).toEqual(expect.arrayContaining([expect.objectContaining({dim_name:'scope',dim_value_list:['B']})]));
  await page.screenshot({path:info.outputPath('conditional-query-restored.png'),fullPage:true});
  expect(errors).toEqual([]);
});
