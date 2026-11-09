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
