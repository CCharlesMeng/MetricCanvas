import {expect,test,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const rows=(page:Page)=>page.locator('tbody tr:not(:has(.empty-row))');
async function spreadsheet(page:Page):Promise<string> {
 const pending=page.waitForEvent('download');await page.getByRole('button',{name:'导出',exact:true}).click();
 const file=await (await pending).path();const ExcelJS=require('exceljs'),book=new ExcelJS.Workbook();
 await book.xlsx.load(readFileSync(file!));const values:unknown[]=[];
 book.eachSheet((sheet:any)=>sheet.eachRow((row:any)=>values.push(row.values)));return JSON.stringify(values);
}
test('global Region preserves month and customer on screen and XLSX, including key-office override',async({page},info)=>{
 await page.goto('/pages/key-office-priority-demo?region.level=geo&region='+encodeURIComponent('全球')+'&mtime=2026-04&customer-category='+encodeURIComponent('战略'));
 await expect(rows(page)).toHaveCount(2);await expect(rows(page)).toContainText(['上海代表处','广州代表处']);
 await expect(page.locator('[data-filter-id="region"]')).toContainText('全球');
 const exported=await spreadsheet(page);expect(exported).toContain('上海代表处');expect(exported).toContain('广州代表处');expect(exported).not.toContain('南京代表处');expect(exported).not.toContain('深圳代表处');
 const requests=await page.evaluate(()=>(window as any).keyOfficeRequests.filter((entry:any)=>entry.kind==='query'));
 expect(requests.length).toBeGreaterThan(0);
 for(const {request} of requests){expect(request.filterValues).toEqual(expect.arrayContaining([{target:'dimension',queryField:'客户级别',values:['战略']},{target:'dimension',queryField:'数据月份',values:['202604']}]));expect(request.filterValues.some((predicate:any)=>['全球编码','地区部','代表处'].includes(predicate.queryField))).toBe(false);}
 const checkbox=page.getByRole('checkbox',{name:'仅看重点国代'});await checkbox.check();await expect(rows(page)).toHaveCount(1);await expect(rows(page)).toContainText('上海代表处');
 await checkbox.uncheck();await expect(rows(page)).toHaveCount(2);
 await page.screenshot({path:info.outputPath('global-month-customer.png')});
});
test('native HTTP query and complete XLSX omit only global Region',async({page},info)=>{
 // The business page has no export button; enable the existing optional table toolbar for this acceptance probe.
 await page.route('**/pages/ioc-opportunity-list.json',async route=>{const response=await route.fetch(),document=await response.json();for(const section of document.sections)for(const component of section.components)if(component.type==='table')component.props.toolbar={export:{format:'xlsx'}};await route.fulfill({response,json:document});});
 const items:any[]=[];
 page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/dsl/execute')){const body=request.postDataJSON();items.push(...(body.dsl_list??[]));}});
 await page.goto('/pages/ioc-opportunity-list?region.level=geo&region='+encodeURIComponent('全球')+'&mtime=2026-04');
 await expect(rows(page)).toHaveCount(5);
 const exported=await spreadsheet(page);
 const fixture=JSON.parse(readFileSync('../../tools/dqe-sim/fixtures/ioc-opportunity-list.json','utf8'));
 for(const row of fixture.rows)expect(exported).toContain(row.opportunity_code);
 const business=items.filter(item=>item.output_dims?.includes('opportunity_code'));
 expect(business.length).toBeGreaterThan(1);
 for(const item of business){expect(item.filter.dims.some((entry:any)=>['geo_pc_code','地区部','代表处'].includes(entry.dim_name))).toBe(false);expect(item.filter.dims).toContainEqual({dim_name:'mtime',dim_value_list:['202604']});}
 await page.screenshot({path:info.outputPath('global-native-http.png')});
});
test('China and Asia-Pacific geo nodes still send their selected predicates',async({page})=>{
 const items:any[]=[];page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/dsl/execute'))items.push(...request.postDataJSON().dsl_list);});
 for(const [value,total] of [['R99',9],['TBD-APAC',1]] as const){
  items.length=0;await page.goto('/pages/ioc-opportunity-list?region.level=geo&region='+value+'&mtime=2026-04');
  await expect(rows(page)).toHaveCount(Math.min(total,5));
  const business=items.filter(item=>item.output_dims?.includes('opportunity_code'));expect(business.length).toBeGreaterThan(0);
  for(const item of business)expect(item.filter.dims).toContainEqual({dim_name:'geo_pc_code',dim_value_list:[value]});
 }
});
