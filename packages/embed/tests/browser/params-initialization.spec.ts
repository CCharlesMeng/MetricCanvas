import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const template = () => JSON.parse(readFileSync(new URL('../../../page/fixtures/contract-valid/dimension-params-page.json', import.meta.url),'utf8'));
for (const mode of ['classic','esm']) {
  test(`${mode} 参数初始化、部分共享、后续筛选和URL独立`, async ({page}) => {
    const raw = template(); raw.filters[0].display = 'tabs';
    await page.goto('/examples/inline.html');
    await page.evaluate(async ({raw,mode}) => {
      window.runtime.destroy();
      const moduleUrl = '/dist/metriccanvas-runtime.es.js';
      const mount = mode === 'classic' ? MetricCanvas.mount : (await import(moduleUrl)).mount;
      window.pageDocument = raw;
      window.queryCalls = [];
      window.queryEvents = [];
      window.runtime = mount('#dashboard', {
        document: raw, initialSearch:'regions=EU&regions=NA&heading=Instance',
        onEvent: (event: any) => window.queryEvents.push(event),
        dataGateway: {
          async fetchData(query: any) {
            window.queryCalls.push(query);
            const dims = query.body.dsl_list[0].filter?.dims ?? [];
            const region = query.filterValues.find((v: any) => v.queryField === 'region')?.values ?? dims.find((d: any) => d.dim_name === 'region')?.dim_value_list ?? [];
            return { rows:[{region:region.join('|') || 'ALL',gmv:1}],totalCount:1 };
          },
          async fetchDimensionValues() { return {kind:'values',candidates:['EU','NA','APAC'].map(value=>({value,label:value}))}; }
        }
      });
    }, {raw,mode});
    const sales = page.getByRole('table').nth(0);
    const shared = page.getByRole('table').nth(1);
    const unbound = page.getByRole('table').nth(2);
    await expect(page.getByRole('heading',{name:'Instance',exact:true})).toBeVisible();
    await expect(sales.getByText('EU|NA',{exact:true})).toBeVisible();
    await expect(shared.getByText('EU|NA',{exact:true})).toBeVisible();
    await expect(unbound.getByText('ALL',{exact:true})).toBeVisible();
    await page.evaluate(()=>history.replaceState(null,'','?regions=APAC'));
    await expect(sales.getByText('EU|NA',{exact:true})).toBeVisible();
    await page.getByRole('tab',{name:'APAC',exact:true}).click();
    await expect(sales.getByText('APAC',{exact:true})).toBeVisible();
    await expect(shared.getByText('EU|NA',{exact:true})).toBeVisible();
    await page.getByRole('tab',{name:'全部',exact:true}).click();
    await expect(sales.getByText('ALL',{exact:true})).toBeVisible();
    await expect(shared.getByText('EU|NA',{exact:true})).toBeVisible();
    expect(await page.evaluate(()=>window.pageDocument)).toEqual(raw);
    expect(await page.evaluate(()=>window.queryEvents.filter(e=>e.type==='ready').length)).toBe(1);
    expect(await page.evaluate(()=>window.queryEvents.filter(e=>e.type==='filter-change').length)).toBe(2);
  });
}
test('维度必需参数缺值阻止查数；默认、单值与可选缺值可呈现', async ({page}) => {
  const raw = template(); delete raw.params[0].default;
  await page.goto('/examples/inline.html');
  await page.evaluate(raw=>{
    window.runtime.destroy(); window.queryCalls=[];
    window.runtime = MetricCanvas.mount('#dashboard',{document:raw,dataGateway:{async fetchData(q){window.queryCalls.push(q);return {rows:[],totalCount:0};}}});
  },raw);
  await expect(page.getByText('regions',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>window.queryCalls.length)).toBe(0);
  await page.evaluate(raw=>window.runtime.update({document:raw,initialSearch:'regions=EU',dataGateway:{async fetchData(q){window.queryCalls.push(q);return {rows:[{region:'EU',gmv:1}],totalCount:1};}}}),raw);
  await expect(page.getByRole('table').nth(0).getByText('EU',{exact:true})).toBeVisible();
});
