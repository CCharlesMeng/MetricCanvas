import {expect,test,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../engine/package.json', import.meta.url));
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
test('opportunity export follows host permission changes and preserves the global Region query',async({page},info)=>{
 const items:any[]=[];
 page.on('request',request=>{if(request.method()==='POST'&&request.url().endsWith('/dsl/execute')){const body=request.postDataJSON();items.push(...(body.dsl_list??[]));}});
 const query = '&region.level=geo&region='+encodeURIComponent('全球')+'&mtime=2026-04';
 await page.goto('/examples/navigation.html?page=ioc-opportunity-list' + query);
 await expect(rows(page)).toHaveCount(5);
 const permission = page.getByLabel('模拟宿主导出权限');
 const action = page.getByRole('button', {name:'导出', exact:true});
 await expect(permission).toHaveValue('等待权限');
 await expect(action).toHaveCount(0);
 for (const choice of ['禁止导出', '缺少权限位', '权限读取失败', '无效的字符串值']) {
   await permission.selectOption({label:'允许导出'});
   await expect(action).toBeEnabled();
   await permission.selectOption({label:choice});
   await expect(action).toHaveCount(0);
 }
 await permission.selectOption({label:'允许导出'});
 const exported=await spreadsheet(page);
 const fixture=JSON.parse(readFileSync(new URL('../../../../tools/dqe-sim/fixtures/ioc-opportunity-list.json',import.meta.url),'utf8'));
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
