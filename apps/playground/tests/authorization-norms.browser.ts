import {expect,test,type Page} from '@playwright/test';

type QueryItem={output_dims?:string[];output_metrics?:string[];filter?:{dims?:Array<{dim_name:string;dim_value_list:string[]}>}};
const endpoint='**/rest/cdi/cdinl2databuilderservice/v1/dsl/execute';
const target='/pages/region-authorization-norms';

async function responses(page:Page,state:'ready'|'empty'|'error'='ready') {
 const items:QueryItem[]=[];
 await page.route(endpoint,async route=>{
  const queries:QueryItem[]=route.request().postDataJSON().dsl_list;
  items.push(...queries);
  await route.fulfill({json:{retCode:'CBC.0000',results:queries.map(query=>({
   code:state==='error'?'NO_PERMISSION':'SUCCESS',
   data:state==='ready'?Array.from({length:12},(_,index)=>Object.fromEntries([
    ...(query.output_dims??[]).map(field=>[field,`${field}示例 ${index+1}`]),
    ...(query.output_metrics??[]).map(field=>[field,0.5])
   ])):[],total_count:state==='ready'?12:0
  }))}});
 });
 return items;
}

test('business page queries on first load and keeps search outside Region scrolling',async({page},info)=>{
 const items=await responses(page);
 await page.setViewportSize({width:1280,height:500});
 await page.goto(target);
 const table=page.locator('[data-component$="/region-dept-norms-table"]');
 await expect(table.getByText('地区部示例 1',{exact:true})).toBeVisible();
 await expect.poll(()=>items.length).toBe(5);
 expect(items.every(query=>!query.filter?.dims?.some(dim=>['geo_pc_code','地区部','代表处'].includes(dim.dim_name)))).toBe(true);
 await page.getByRole('button',{name:'区域',exact:true}).click();
 const popup=page.getByRole('dialog',{name:'区域候选'}),search=page.getByRole('textbox',{name:'搜索区域'});
 await search.fill('代表处');
 const tree=page.getByRole('tree',{name:'区域选项'});
 expect(await popup.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeLessThanOrEqual(1);
 expect(await tree.evaluate(el=>el.scrollHeight-el.clientHeight)).toBeGreaterThan(0);
 const before=await search.boundingBox();
 await tree.hover();await page.mouse.wheel(0,500);
 await expect.poll(()=>tree.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 expect((await search.boundingBox())!.y).toBe(before!.y);
 await page.screenshot({path:info.outputPath('region-single-scroll.png')});
 await search.fill('全球');
 await popup.getByRole('button',{name:'全球',exact:true}).click();
 await expect(popup).toHaveCount(0);
 const count=items.length;
 await page.getByRole('button',{name:'区域',exact:true}).click();
 await search.fill('上海代表处');
 await popup.getByRole('button',{name:'上海代表处',exact:true}).click();
 await expect.poll(()=>items.length).toBeGreaterThan(count);
 expect(items.slice(count).every(query=>query.filter?.dims?.some(dim=>dim.dim_name==='代表处'&&dim.dim_value_list.includes('上海代表处')))).toBe(true);
});

for(const state of ['empty','error'] as const)test(`first load completes with ${state} business responses`,async({page})=>{
 const items=await responses(page,state);
 await page.goto(target);
 await expect.poll(()=>items.length).toBe(5);
 const table=page.locator('[data-component$="/region-dept-norms-table"]');
 await expect(table.getByText('正在加载…',{exact:true})).toHaveCount(0);
 await expect(table.getByText('暂无数据',{exact:true})).toBeVisible();
});

test('both global tables display the missing-value remark with their export controls', async ({ page }) => {
 await responses(page);
 await page.setViewportSize({ width: 1280, height: 900 });
 await page.goto(target);
 const header = page.locator('[data-ioc-header]');
 await expect(header).toHaveCount(1);
 await expect(header.getByRole('heading', { name: '行权规范情况' })).toBeVisible();
 await expect(header.getByRole('button', { name: '区域', exact: true })).toContainText('全球');
 const remark = '— 代表本周期没有合同单/商务单';
 for (const [id, title, sample] of [
  ['region-dept-norms-table', '地区部行权规范情况', '地区部示例 1'],
  ['rep-office-norms-table', '代表处行权规范情况', '代表处示例 1']
 ]) {
  const table = page.locator(`[data-component$="/${id}"]`);
  await expect(table.getByText(sample, { exact: true })).toBeVisible();
  await expect(table.getByRole('button', { name: '导出', exact: true })).toBeEnabled();
  const subtitle = table.getByText(remark, { exact: true });
  await expect(subtitle).toHaveCSS('font-size', '12px');
  const titleBox = (await table.getByRole('heading', { name: title }).boundingBox())!;
  const remarkBox = (await subtitle.boundingBox())!;
  expect(remarkBox.x - titleBox.x - titleBox.width).toBeCloseTo(16, 1);
 }

 await header.getByRole('button', { name: '区域', exact: true }).click();
 const popup = page.getByRole('dialog', { name: '区域候选' });
 await popup.getByRole('textbox', { name: '搜索区域' }).fill('上海代表处');
 await popup.getByRole('button', { name: '上海代表处', exact: true }).click();
 await expect(page.getByRole('heading', { name: '地区部行权规范情况' })).toHaveCount(0);
 await expect(page.getByText(remark, { exact: true })).toHaveCount(1);
});
