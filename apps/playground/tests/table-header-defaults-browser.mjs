import {chromium,expect} from '../../../packages/embed/node_modules/@playwright/test/index.mjs';
import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const require=createRequire(import.meta.url);
const ExcelJS=createRequire(require.resolve('@metriccanvas/engine/ui'))('exceljs');
const base=process.env.HEADER_DEFAULTS_BASE_URL??'http://127.0.0.1:5202';
const output=process.argv[2]??'/tmp/mc-table-header-defaults';
await mkdir(output,{recursive:true});
const document=JSON.parse(await readFile(new URL('../../../pages/capabilities/table/table-header-filter-defaults.json',import.meta.url),'utf8'));
const simRows=JSON.parse(await readFile(new URL('../../../tools/dqe-sim/fixtures/object-query.json',import.meta.url),'utf8'));
const eastCount=simRows.filter(row=>row['区域']==='东区').length;
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true});
const errors=[],requests=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('request',request=>{
  if(request.method()==='POST'&&request.url().includes('/dsl/execute'))requests.push(request.postDataJSON());
});
const table=title=>page.locator('.table-widget').filter({has:page.getByRole('heading',{name:title,exact:true})});
const menu=(target,column)=>target.getByRole('columnheader',{name:column,exact:true}).locator('details.filter');
async function clear(target,column){
  const control=menu(target,column);
  await control.locator('summary').click();
  const checked=control.locator('input[type=checkbox]:checked');
  while(await checked.count())await checked.first().uncheck();
  await control.locator('summary').click();
}
async function exportRows(target,filename){
  const pending=page.waitForEvent('download');
  await target.getByRole('button',{name:'导出',exact:true}).click();
  const download=await pending,local=path.join(output,filename);
  await download.saveAs(local);
  const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(local);
  return workbook.worksheets[0].rowCount-1;
}
async function localDefaults(){
  await page.goto(base+'/pages/'+document.id);
  const first=table('待审批且编码为1'),second=table('同源独立默认值'),missing=table('默认值当前无匹配记录');
  await expect(first.getByRole('cell',{name:'A001',exact:true})).toBeVisible();
  await expect(first.getByRole('cell',{name:'A003',exact:true})).toBeVisible();
  await expect(second.getByRole('cell',{name:'A002',exact:true})).toBeVisible();
  await expect(second.getByRole('cell',{name:'A005',exact:true})).toBeVisible();
  expect(await exportRows(first,'initial-defaults.xlsx')).toBe(2);
  await menu(missing,'审批状态').locator('summary').click();
  await expect(missing.getByRole('checkbox',{name:/archived/})).toBeChecked();
  await menu(missing,'审批状态').locator('summary').click();
  await page.screenshot({path:path.join(output,'defaults-1440.png'),fullPage:true});
  await clear(first,'审批状态');
  await page.getByRole('button',{name:'审批状态列',exact:true}).click();
  await page.getByRole('option',{name:'隐藏审批状态',exact:true}).click();
  await expect(first.getByRole('columnheader',{name:'审批状态',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'审批状态列',exact:true}).click();
  await page.getByRole('option',{name:'显示审批状态',exact:true}).click();
  await expect(menu(first,'审批状态').locator('summary')).not.toHaveClass(/active/);
  await clear(first,'数值编码');
  expect(await exportRows(first,'cleared-defaults.xlsx')).toBe(6);
  await expect(second.getByRole('cell',{name:'A005',exact:true})).toBeVisible();
  await page.setViewportSize({width:390,height:900});
  await page.screenshot({path:path.join(output,'cleared-390.png'),fullPage:true});
  await page.reload();
  await expect(menu(first,'审批状态').locator('summary')).toHaveClass(/active/);
  expect(await exportRows(first,'reopened-defaults.xlsx')).toBe(2);
}
function mainQueries(){
  return requests.flatMap(body=>body.dsl_list??[]).filter(item=>item.object_type==='Demo/Approval Details'&&item.output_fields?.length===4);
}
async function remoteDefaults(){
  await page.setViewportSize({width:1440,height:1100});
  await page.goto(base+'/pages/table-header-filter-defaults-query');
  const target=table('东区审批记录（合成 DQE）');
  await expect(target.getByRole('cell',{name:'R001',exact:true})).toBeVisible();
  await expect(target.getByRole('cell',{name:'R003',exact:true})).toBeVisible();
  expect(mainQueries()[0].filter.fields).toEqual([{field_name:'区域',operator:'=',value_list:['东区']}]);
  await target.getByRole('button',{name:'下一页',exact:true}).click();
  await expect(target.getByRole('cell',{name:'R005',exact:true})).toBeVisible();
  expect(mainQueries().at(-1).filter.fields).toEqual(mainQueries()[0].filter.fields);
  expect(await exportRows(target,'remote-defaults.xlsx')).toBe(eastCount);
  await clear(target,'区域');
  await expect(target.getByRole('cell',{name:'R002',exact:true})).toBeVisible();
  expect(await exportRows(target,'remote-cleared.xlsx')).toBe(simRows.length);
  await page.screenshot({path:path.join(output,'query-cleared.png'),fullPage:true});
}
try{
  await localDefaults();
  await remoteDefaults();
  expect(errors).toEqual([]);
  await writeFile(path.join(output,'result.json'),JSON.stringify({base,browser:'Chrome',passed:['atomic initial defaults','raw numeric value','independent shared inline source','missing selected candidate retained','hide and show without restoring','cleared local XLSX','new page instance reapplies defaults','HTTP first-query default','remote pagination','remote XLSX defaults and clearing','390px'],errors,requests},null,2));
}finally{await browser.close();}
