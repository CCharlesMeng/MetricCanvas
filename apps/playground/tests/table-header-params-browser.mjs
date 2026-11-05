import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const ExcelJS=createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const base=process.env.HEADER_PARAMS_BASE_URL??'http://127.0.0.1:5206';
const output=process.argv[2]??'/tmp/mc-table-header-params';await mkdir(output,{recursive:true});
const fixture=JSON.parse(await readFile(new URL('../../../pages/capabilities/table/table-header-filter-defaults.json',import.meta.url),'utf8'));
const simRows=JSON.parse(await readFile(new URL('../../../tools/dqe-sim/fixtures/object-query.json',import.meta.url),'utf8'));
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
const errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{if(request.method()==='POST'&&request.url().includes('/dsl/execute'))requests.push(request.postDataJSON());});
const table=title=>page.locator('.table-widget').filter({has:page.getByRole('heading',{name:title,exact:true})});
const menu=(target,column)=>target.getByRole('columnheader',{name:column,exact:true}).locator('details.filter');
async function open(target,column){const control=menu(target,column);await control.locator('summary').click();return control;}
async function clear(target,column){const control=await open(target,column);await control.getByRole('button',{name:'清除筛选',exact:true}).click();await control.locator('summary').click();}
async function exportRows(target,filename){
 const pending=page.waitForEvent('download');await target.getByRole('button',{name:'导出',exact:true}).click();
 const download=await pending,local=path.join(output,filename);await download.saveAs(local);
 const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(local);return workbook.worksheets[0].rowCount-1;
}
async function local(){
 await page.goto(base+'/pages/'+fixture.id+'?is-valid=是');
 const target=table('参数初值（全选不限）'),values=table('参数初值（显式值集合）');
 await expect(target.getByRole('cell',{name:'有效记录',exact:true})).toBeVisible();
 const control=await open(target,'是否有效意见');await expect(control.getByRole('checkbox',{name:'是',exact:true})).toBeChecked();
 await control.getByRole('checkbox',{name:'是',exact:true}).uncheck();await control.getByRole('checkbox',{name:'否',exact:true}).check();await control.locator('summary').click();
 await expect(target.getByRole('cell',{name:'无效记录',exact:true})).toBeVisible();expect(await exportRows(target,'no.xlsx')).toBe(1);
 await clear(target,'是否有效意见');expect(await exportRows(target,'cleared.xlsx')).toBe(4);
 await target.getByRole('button',{name:'下一页',exact:true}).click();await expect(target.getByRole('cell',{name:'未知记录',exact:true})).toBeVisible();
 const all=await open(target,'是否有效意见');await all.getByRole('checkbox',{name:'是',exact:true}).check();await all.getByRole('checkbox',{name:'否',exact:true}).check();
 await expect(all.locator('summary')).not.toHaveClass(/active/);await expect(all.getByRole('checkbox',{name:'是',exact:true})).not.toBeChecked();await all.locator('summary').click();expect(await exportRows(target,'all-unrestricted.xlsx')).toBe(4);
 const finite=await open(values,'是否有效意见');await finite.getByRole('checkbox',{name:'否',exact:true}).check();await finite.locator('summary').click();expect(await exportRows(values,'all-values.xlsx')).toBe(2);
 const tab=table('参数 Tab 会话');await clear(tab,'是否有效意见');await page.getByRole('tab',{name:'其他面板',exact:true}).click();await page.getByRole('tab',{name:'参数明细',exact:true}).click();
 await expect(menu(tab,'是否有效意见').locator('summary')).not.toHaveClass(/active/);expect(await exportRows(tab,'tab-cleared.xlsx')).toBe(4);
 await page.screenshot({path:path.join(output,'local-cleared.png'),fullPage:true});
 await page.goto(base+'/pages/'+fixture.id+'?is-valid=是&is-valid=否');await expect(menu(target,'是否有效意见').locator('summary')).not.toHaveClass(/active/);expect(await exportRows(target,'total-entry.xlsx')).toBe(4);
 await page.goto(base+'/pages/'+fixture.id);expect(await exportRows(target,'no-input.xlsx')).toBe(4);
 await page.goto(base+'/pages/'+fixture.id+'?is-valid=是');expect(await exportRows(target,'reopened.xlsx')).toBe(1);
 await page.setViewportSize({width:390,height:900});await page.screenshot({path:path.join(output,'local-390.png'),fullPage:true});
}
function objectQueries(){return requests.flatMap(body=>body.dsl_list??[]).filter(item=>item.object_type==='Demo/Approval Details'&&item.output_fields?.length===4);}
async function entryNavigation(){
 await page.goto(base+'/pages/table-header-filter-param-source');
 await page.getByRole('button',{name:'有效意见数',exact:true}).click();
 await expect(page.locator('.table-widget').first().getByRole('heading')).toHaveText('参数初值（全选不限）');
 await page.getByRole('button',{name:'URL：否',exact:true}).click();await expect(page).toHaveURL(/is-valid=%E5%90%A6/);
 await expect(table('参数初值（全选不限）').getByRole('cell',{name:'无效记录',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'URL：是',exact:true}).click();
 await expect(table('参数初值（全选不限）').getByRole('cell',{name:'有效记录',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'URL：不限',exact:true}).click();
 await expect(menu(table('参数初值（全选不限）'),'是否有效意见').locator('summary')).not.toHaveClass(/active/);
 await expect(table('参数初值（全选不限）')).toContainText('总条数：  4');
}
async function remote(){
 await page.setViewportSize({width:1440,height:1100});requests.length=0;
 await page.goto(base+'/pages/table-header-filter-defaults-query?region-input=西区');
 const target=table('参数初始化区域（合成 DQE）');await expect(target.getByRole('cell',{name:'R002',exact:true})).toBeVisible();
 const first=objectQueries();expect(first).toHaveLength(2);expect(first.map(q=>q.filter.fields[0].value_list[0]).sort()).toEqual(['东区','西区']);
 expect(await exportRows(target,'remote-west.xlsx')).toBe(simRows.filter(row=>row['区域']==='西区').length);
 await clear(target,'区域');await expect(target.getByRole('cell',{name:'R001',exact:true})).toBeVisible();
 await target.getByRole('button',{name:'下一页',exact:true}).click();await expect(target.getByRole('cell',{name:'R003',exact:true})).toBeVisible();
 expect(await exportRows(target,'remote-cleared.xlsx')).toBe(simRows.length);expect(objectQueries().at(-1).filter.fields).toEqual([]);
 await page.screenshot({path:path.join(output,'remote-cleared.png'),fullPage:true});
}
async function invalid(){
 for(const query of ['is-valid=','is-valid=是&is-valid=是','is-valid=unknown','is-valid=%5B%22是%22%5D']){
  await page.goto(base+'/pages/'+fixture.id+'?'+query);await expect(page.locator('.table-widget')).toHaveCount(0);
  await expect(page.locator('body')).toContainText(/参数|initialParam/);
 }
 await page.goto(base+'/pages/table-header-filter-param-source');await page.getByRole('button',{name:'有效意见数',exact:true}).click();await expect(table('参数初值（全选不限）').getByRole('cell',{name:'有效记录',exact:true})).toBeVisible();
}
try{await entryNavigation();await local();await remote();await invalid();expect(errors).toEqual([]);await writeFile(path.join(output,'result.json'),JSON.stringify({base,browser:'Chrome',passed:['first visible table uses URL','same-page URL navigation yes no unrestricted','first URL value','manual no','clear pagination and export','all unrestricted includes null unknown','values retains explicit set','Tab retains clear','new instance','optional absent','repeated full enum','390px','HTTP first requests','remote query pagination export','invalid URL rejection','source navigation'],requests,errors},null,2));}finally{await browser.close();}
