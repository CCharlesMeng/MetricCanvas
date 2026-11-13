import { expect, test, type Locator } from '@playwright/test';
import { createRequire } from 'node:module';
import example from '../../../pages/capabilities/data/conditional-compute-demand.json' with { type: 'json' };
import { closeSelection, openSelection } from '../../../packages/embed/tests/browser/selection-actions';
const ExcelJS: typeof import('../../../packages/engine/node_modules/exceljs') = createRequire(import.meta.url)('../../../packages/engine/node_modules/exceljs');

interface Item { output_dims?: string[]; output_metrics?: string[]; filter?: { time?: {period?:string}; dims?: {dim_name:string;dim_value_list:string[]}[] } }
async function seriesNames(chart: Locator): Promise<string[]> {
  return chart.evaluate(async element => {
    const url = performance.getEntriesByType('resource').map(entry => entry.name).find(name => /\/(echarts-runtime\.ts|echarts_core\.js|echarts\.js)(?:\?|$)/.test(name));
    if (!url) throw Error('ECharts module not loaded');
    const echarts = await import(url);
    return (echarts.getInstanceByDom(element)?.getOption()?.series ?? []).map((series: {name:string}) => series.name);
  });
}

test('period joins follow visible consumers in charts, tables and Excel', async ({ page }, info) => {
  const requests: Item[] = [], errors: string[] = [];
  await page.addInitScript(() => performance.setResourceTimingBufferSize(5000));
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const items: Item[] = route.request().postDataJSON().dsl_list;
    requests.push(...items);
    await route.fulfill({json:{retCode:'CBC.0000',results:items.map(item => ({code:'SUCCESS',total_count:1,data:[{
      ...Object.fromEntries((item.output_dims ?? []).map(field => [field,'合成组织'])),
      ...Object.fromEntries((item.output_metrics ?? []).map(field => [field,10]))
    }]}))}});
  });
  await page.goto(`/pages/${example.id}`);
  const chart = page.getByRole('article').filter({has:page.getByRole('heading',{name:'期间变化与全局均值',exact:true})}).locator('.echart');
  await expect(chart).toHaveAttribute('_echarts_instance_',/.+/);
  await expect.poll(() => seriesNames(chart)).toEqual(['当前值','全局均值','月变化']);
  const period = page.locator('[data-period-filter]');
  for (const [button, mode, label] of [['季','quarter','季变化'],['年','year','年变化'],['月','month','月变化']]) {
    const before = requests.length;
    await period.getByRole('button',{name:button,exact:true}).click();
    await expect.poll(() => seriesNames(chart)).toEqual(['当前值','全局均值',label]);
    await expect(page.getByRole('columnheader',{name:label,exact:true})).toBeVisible();
    const changes = requests.slice(before).flatMap(item => item.output_metrics ?? []).filter(metric => metric.startsWith('change-'));
    expect([...new Set(changes)]).toEqual([`change-${mode}`]);
  }
  const beforeExport = requests.length;
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'导出',exact:true}).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile((await file.path())!);
  expect(workbook.worksheets[0].getRow(1).values).toEqual(expect.arrayContaining(['组织','当前值（合成单位）','月变化（合成单位）']));
  expect(workbook.worksheets[0].getRow(2).values).toEqual(expect.arrayContaining(['合成组织',10]));
  expect(requests.slice(beforeExport).flatMap(item => item.output_metrics ?? [])).not.toContain('change-quarter');
  expect(requests.slice(beforeExport).flatMap(item => item.output_metrics ?? [])).not.toContain('change-year');
  await page.waitForTimeout(500); // Capture after the chart's value transition, not its first animation frame.
  await page.screenshot({path:info.outputPath('conditional-compute-demand.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('visible dependency failures remain errors, while period changes and empty results recover', async ({ page }) => {
  const diagnostics: string[] = [], errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') diagnostics.push(message.text()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute', async route => {
    const items: Item[] = route.request().postDataJSON().dsl_list;
    if (items.some(item => item.output_metrics?.includes('change-month'))) {
      await route.fulfill({status:503,body:'synthetic dependency failure'});
      return;
    }
    await route.fulfill({json:{retCode:'CBC.0000',results:items.map(item => {
      const empty = item.output_metrics?.includes('amount') && item.filter?.dims?.some(filter => filter.dim_name === 'scope' && filter.dim_value_list.includes('B'));
      return {code:'SUCCESS',total_count:empty ? 0 : 1,data:empty ? [] : [{name:'合成组织',...Object.fromEntries((item.output_metrics ?? []).map(field => [field,10]))}]};
    })}});
  });
  await page.goto(`/pages/${example.id}`);
  const chart = page.locator('.bar-chart');
  await expect.poll(() => diagnostics.some(message => message.includes('依赖数据源执行或计算失败'))).toBe(true);
  await expect(chart).toHaveAttribute('data-month-count','0');
  await page.locator('[data-period-filter]').getByRole('button',{name:'季',exact:true}).click();
  await expect(chart).toHaveAttribute('data-month-count','1');
  const scope = page.getByRole('group',{name:'合成范围',exact:true});
  await openSelection(scope);
  await scope.getByRole('option',{name:'合成范围B',exact:true}).click();
  await closeSelection(scope);
  await expect(chart).toHaveAttribute('data-month-count','0');
  await openSelection(scope);
  await scope.getByRole('option',{name:'合成范围A',exact:true}).click();
  await closeSelection(scope);
  await expect(chart).toHaveAttribute('data-month-count','1');
  expect(errors).toEqual([]);
});
